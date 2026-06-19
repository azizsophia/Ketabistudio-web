#!/usr/bin/env python3
"""
KETABI GREETING-CARD FULFILLMENT

card_orders flow:
  pending → rendering → submitted (Prodigi) → printing → shipped | failed

For each paid card order the worker:
  1. Renders the single stitched Prodigi artboard (all four panels) directly
     with PIL (card_pipeline) at the exact template size (6117 x 2161 px).
  2. Uploads the PNG to the public "card-assets" bucket.
  3. Places a Prodigi order (SKU GLOBAL-GRE-MOH-7X5-DIR) with the one asset on
     the "default" print area, white-label, so the parcel arrives blind.
  4. Polls Prodigi for shipping and emails the customer when shipped.

Env:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
  SITE_URL            deployed site the worker renders /cards/print from
  PRODIGI_API_KEY, PRODIGI_ENV (sandbox|live)
  RESEND_API_KEY, EMAIL_FROM   (optional, via emailer)

These functions are called from worker.py's main loop AFTER the book
processing, each wrapped so a card error never breaks book fulfillment.
"""
import json
import os
import time
import traceback
from pathlib import Path

import requests

import emailer
import hashlib

from pipeline import prodigi_client, card_pipeline, gelato_client, cloudprinter_client

# Vetted card catalog (content keyed by item_id) — mirrors lib/cards.ts, read by
# the PIL renderer so the print asset is produced directly (no headless browser).
CARDS_CATALOG = json.loads(
    (Path(__file__).resolve().parent / "pipeline" / "cards_catalog.json")
    .read_text("utf-8"))

# Destination routing: US (CLOUDPRINTER_COUNTRIES) prints locally in the US via
# Cloudprinter (folded card, cheap domestic shipping) instead of Prodigi's
# pricey UK->US shipping. Everything else -> Prodigi.
CLOUDPRINTER_COUNTRIES = set(
    (os.environ.get("CLOUDPRINTER_COUNTRIES", "US") or "")
    .upper().replace(" ", "").split(","))
GELATO_COUNTRIES = set(
    (os.environ.get("GELATO_COUNTRIES", "") or "")
    .upper().replace(" ", "").split(",")) - {""}


def _provider_for(country: str) -> str:
    """Pick the cheapest fulfiller for a destination."""
    c = (country or "").upper()
    if c in CLOUDPRINTER_COUNTRIES:
        return "cloudprinter"
    if c in GELATO_COUNTRIES:
        return "gelato"
    return "prodigi"

SB = "".join(os.environ["SUPABASE_URL"].split()).rstrip("/")
KEY = "".join(os.environ["SUPABASE_SERVICE_KEY"].split())
HDRS = {"Authorization": f"Bearer {KEY}", "apikey": KEY,
        "Content-Type": "application/json"}

# Prodigi artboard for GLOBAL-GRE-MOH-7X5: all four panels stitched, @ 300 DPI.
RENDER_W = 6117
RENDER_H = 2161


# ── supabase helpers (match worker.py) ──────────────────────────────
def db(method, path, **kw):
    r = requests.request(method, f"{SB}/rest/v1/{path}", headers=HDRS,
                         timeout=30, **kw)
    r.raise_for_status()
    return r.json() if r.text else None


def set_card_status(oid, status, **fields):
    db("PATCH", f"card_orders?id=eq.{oid}",
       json={"status": status, **fields})
    db("POST", "card_order_events",
       json={"card_order_id": oid, "event": status,
             "detail": fields.get("notes")})


def log_card_event(oid, event, detail=None):
    db("POST", "card_order_events",
       json={"card_order_id": oid, "event": event, "detail": detail})


def storage_upload(bucket, path, data: bytes, ctype):
    r = requests.post(f"{SB}/storage/v1/object/{bucket}/{path}",
                      headers={"Authorization": f"Bearer {KEY}",
                               "Content-Type": ctype,
                               "x-upsert": "true"},
                      data=data, timeout=300)
    r.raise_for_status()
    return path


def public_url(bucket, path):
    return f"{SB}/storage/v1/object/public/{bucket}/{path}"


# ── render helpers ──────────────────────────────────────────────────
def _recipient_from_shipping(order):
    """Map our shipping jsonb to the Prodigi recipient shape."""
    ship = order.get("shipping") or {}
    address = {
        "line1": ship.get("line1") or "",
        "postalOrZipCode": ship.get("postcode") or "",
        "countryCode": ship.get("country_code") or "",
        "townOrCity": ship.get("city") or "",
    }
    if ship.get("line2"):
        address["line2"] = ship["line2"]
    if ship.get("state"):
        address["stateOrCounty"] = ship["state"]
    recipient = {"name": ship.get("name") or "", "address": address}
    if order.get("customer_email"):
        recipient["email"] = order["customer_email"]
    return recipient


def _gelato_address(order):
    """Map our shipping jsonb to the Gelato shippingAddress shape."""
    ship = order.get("shipping") or {}
    name = (ship.get("name") or "").strip()
    first, _, last = name.partition(" ")
    return {
        "firstName": first or name or "Friend",
        "lastName": last or first or name or "Friend",
        "addressLine1": ship.get("line1") or "",
        "addressLine2": ship.get("line2") or "",
        "city": ship.get("city") or "",
        "postCode": ship.get("postcode") or "",
        "state": ship.get("state") or "",
        "country": ship.get("country_code") or "",
        "email": order.get("customer_email") or "",
    }


def _submit_gelato(oid, order, asset_url, country):
    """Place a US (or GELATO_COUNTRIES) order via Gelato — local printing, cheap
    domestic shipping. Gated: until the Gelato product + renderer are confirmed
    (GELATO_ENABLED=1 and a product uid), the order is HELD, not sent, so no
    wrong-format order or charge can happen."""
    if not (gelato_client.configured() and os.environ.get("GELATO_ENABLED") == "1"):
        note = (f"routed to Gelato for {country} — finishing Gelato setup "
                f"(API key / product / renderer). Not charged.")
        set_card_status(oid, "held", notes=json.dumps({"hold": note}))
        print(f"[card {oid}] HELD (Gelato pending) — {note}", flush=True)
        return

    addr = _gelato_address(order)
    cap = float(os.environ.get("PRODIGI_MAX_COST", "12") or 12)

    # cost guard via a Gelato quote (no charge); pick the cheapest shipment
    q = gelato_client.quote(addr, asset_url, 1)
    quotes = ((q or {}).get("quotes") or [])
    best = None
    for qu in quotes:
        prod_total = sum(float(p.get("price", 0) or 0)
                         for p in (qu.get("products") or []))
        for sm in (qu.get("shipmentMethods") or [{}]):
            ship_cost = float(sm.get("price", 0) or 0)
            total = prod_total + ship_cost
            cand = {"method": sm.get("shipmentMethodUid"),
                    "total": total, "items": prod_total,
                    "shipping": ship_cost,
                    "currency": (qu.get("currency") or "USD")}
            if best is None or total < best["total"]:
                best = cand
    if not best:
        raise RuntimeError(
            f"could not get a Gelato quote for {country}: "
            f"{getattr(gelato_client, '_LAST_ERROR', None)}")
    if best["total"] > cap:
        note = (f"held: Gelato cost {best['total']:.2f} {best['currency']} "
                f"(cap {cap:.2f}) to {country}")
        set_card_status(oid, "held", notes=json.dumps({"hold": note, "quote": best}))
        print(f"[card {oid}] HELD, NOT ordered — {note}", flush=True)
        return

    resp = gelato_client.create_order(
        order_reference_id=str(oid), shipping_address=addr, file_url=asset_url,
        quantity=1, shipment_method_uid=best["method"])
    gid = (resp or {}).get("id") or (resp or {}).get("orderReferenceId")
    if not resp or not gid:
        detail = getattr(gelato_client, "_LAST_ERROR", None) or json.dumps(resp)[:500]
        raise RuntimeError(f"Gelato order rejected: {detail}")
    set_card_status(oid, "submitted", prodigi_order_id=f"gelato:{gid}")
    log_card_event(oid, "submitted",
                   {"gelato_order_id": str(gid), "cost": best})
    print(f"[card {oid}] submitted to Gelato as {gid} "
          f"({best['total']:.2f} {best['currency']})")


def _cloudprinter_address(order):
    """Map our shipping jsonb to the Cloudprinter delivery address shape."""
    ship = order.get("shipping") or {}
    name = (ship.get("name") or "").strip()
    first, _, last = name.partition(" ")
    return {
        "firstname": first or name or "Friend",
        "lastname": last or first or name or "Friend",
        "street1": ship.get("line1") or "",
        "street2": ship.get("line2") or "",
        "zip": ship.get("postcode") or "",
        "city": ship.get("city") or "",
        "state": ship.get("state") or "",
        "country": ship.get("country_code") or "",
        "email": order.get("customer_email") or "",
        "phone": ship.get("phone") or "",
    }


def _submit_cloudprinter(oid, order, card, workdir, common, country):
    """Render the folded 2-page PDF, upload it, quote (cheapest shipment), cost-
    guard, and place the Cloudprinter order. US prints locally + ships cheap."""
    if not cloudprinter_client.configured():
        note = (f"routed to Cloudprinter for {country} — finishing setup "
                f"(CLOUDPRINTER_API_KEY in Render). Not charged.")
        set_card_status(oid, "held", notes=json.dumps({"hold": note}))
        print(f"[card {oid}] HELD (Cloudprinter pending) — {note}", flush=True)
        return

    pdf_path = card_pipeline.build_cloudprinter(card, workdir, **common)
    pdf = Path(pdf_path).read_bytes()
    md5 = hashlib.md5(pdf).hexdigest()
    public = public_url("card-assets", storage_upload(
        "card-assets", f"renders/{oid}-card.pdf", pdf, "application/pdf"))
    db("PATCH", f"card_orders?id=eq.{oid}",
       json={"outside_asset_url": public, "inside_asset_url": public})

    addr = _cloudprinter_address(order)
    q = cloudprinter_client.quote(country, count=1, options=[])
    if not q:
        raise RuntimeError(
            f"Cloudprinter quote failed for {country}: "
            f"{getattr(cloudprinter_client, '_LAST_ERROR', None)}")
    prod_price = float(q.get("price") or 0)
    best = None
    for sh in (q.get("shipments") or []):
        for qq in (sh.get("quotes") or []):
            ship = float(qq.get("price") or 0)
            total = prod_price + ship
            if best is None or total < best["total"]:
                best = {"hash": qq.get("quote"), "ship": ship, "total": total,
                        "currency": qq.get("currency") or q.get("currency") or "EUR",
                        "service": qq.get("service")}
    if not best or not best["hash"]:
        raise RuntimeError(f"no Cloudprinter shipping quote for {country}")

    # cost guard (convert EUR->USD with a buffer; hold if above the cap)
    fx = float(os.environ.get("CP_EUR_USD", "1.12") or 1.12)
    cap = float(os.environ.get("CLOUDPRINTER_MAX_COST", "13.5") or 13.5)
    total_usd = best["total"] * fx
    if total_usd > cap:
        note = (f"held: Cloudprinter ~${total_usd:.2f} "
                f"({best['total']:.2f} {best['currency']}, cap ${cap:.2f}) "
                f"to {country}")
        set_card_status(oid, "held", notes=json.dumps({"hold": note, "quote": best}))
        print(f"[card {oid}] HELD, NOT ordered — {note}", flush=True)
        return

    resp = cloudprinter_client.create_order(
        reference=str(oid), email=order.get("customer_email") or "",
        address=addr, file_url=public, quote_hash=best["hash"], md5sum=md5)
    if resp is None:
        detail = getattr(cloudprinter_client, "_LAST_ERROR", None) or "unknown"
        raise RuntimeError(f"Cloudprinter order rejected: {detail}")

    set_card_status(oid, "submitted", prodigi_order_id=f"cloudprinter:{oid}")
    log_card_event(oid, "submitted",
                   {"cloudprinter_reference": str(oid), "cost": best})
    print(f"[card {oid}] submitted to Cloudprinter "
          f"({best['total']:.2f} {best['currency']} ~${total_usd:.2f}, "
          f"{best['service']})")


# ── per-order processing ────────────────────────────────────────────
def process_card(order):
    """Render → upload → submit one paid card order to Prodigi.

    The single stitched artboard is rendered directly with PIL (card_pipeline)
    in the premium house style — no headless browser — so what we preview is
    what prints, and the cards match the keepsakes by construction."""
    oid = order["id"]
    try:
        set_card_status(oid, "rendering")

        item_id = order.get("item_id") or "eid"
        card = CARDS_CATALOG.get(item_id)
        if not card:
            raise RuntimeError(f"unknown card item_id: {item_id!r}")

        workdir = Path(f"/tmp/card-{oid}")
        common = dict(
            recipient=(order.get("recipient_name") or "")
            if order.get("show_name") else "",
            message=order.get("message") or card.get("msg", ""),
            sign_off=order.get("sender") or "",
            arabic_index=int(order.get("arabic_index") or 0),
            arabic_off=bool(order.get("arabic_off")),
            accent_hex=order.get("accent") or None,
            photo_url=order.get("photo_url") or None,
        )
        country = ((order.get("shipping") or {}).get("country_code") or "US")

        # DESTINATION ROUTING: US (CLOUDPRINTER_COUNTRIES) prints locally in the
        # US via Cloudprinter (folded 2-page PDF); everywhere else -> Prodigi.
        if _provider_for(country) == "cloudprinter":
            _submit_cloudprinter(oid, order, card, workdir, common, country)
            return

        # PRODIGI: render the stitched artboard PNG and upload it.
        ap = card_pipeline.build(card, workdir, **common)
        artboard_public = public_url("card-assets", storage_upload(
            "card-assets", f"renders/{oid}-artboard.png",
            Path(ap).read_bytes(), "image/png"))
        db("PATCH", f"card_orders?id=eq.{oid}",
           json={"outside_asset_url": artboard_public,
                 "inside_asset_url": artboard_public})

        # COST GUARD: quote the cheapest shipping first and refuse to place the
        # order if Prodigi's cost is above the cap (e.g. a pricey international
        # courier). This makes a runaway charge impossible — we never submit a
        # too-expensive order, so no charge happens. Tune via PRODIGI_MAX_COST.
        cap = float(os.environ.get("PRODIGI_MAX_COST", "12") or 12)
        best = prodigi_client.cheapest_shipping(country)
        if not best:
            raise RuntimeError(
                f"could not get a Prodigi shipping quote for {country}: "
                f"{getattr(prodigi_client, '_LAST_ERROR', None)}")
        if best["total"] > cap:
            note = (f"held: Prodigi cost {best['total']:.2f} {best['currency']} "
                    f"via {best['method']} (cap {cap:.2f}); "
                    f"print {best['items']:.2f} + shipping {best['shipping']:.2f} "
                    f"to {country}")
            set_card_status(oid, "held",
                            notes=json.dumps({"hold": note, "quote": best}))
            print(f"[card {oid}] HELD, NOT ordered — {note}", flush=True)
            return

        print_area = prodigi_client.first_print_area()
        resp = prodigi_client.create_order(
            merchant_reference=str(oid),
            recipient=_recipient_from_shipping(order),
            copies=1,
            assets=[{"printArea": print_area, "url": artboard_public}],
            shipping_method=best["method"],
        )
        prodigi_order = ((resp or {}).get("order") or {})
        prodigi_order_id = prodigi_order.get("id")
        if not resp or not prodigi_order_id:
            detail = getattr(prodigi_client, "_LAST_ERROR", None) or json.dumps(resp)[:500]
            print(f"[card {oid}] Prodigi rejected (printArea={print_area}). "
                  f"asset={artboard_public}", flush=True)
            raise RuntimeError(f"Prodigi order rejected: {detail}")

        set_card_status(oid, "submitted",
                        prodigi_order_id=str(prodigi_order_id))
        log_card_event(oid, "submitted",
                       {"prodigi_order_id": str(prodigi_order_id),
                        "cost": best})
        print(f"[card {oid}] submitted to Prodigi as {prodigi_order_id} "
              f"({best['method']} {best['total']:.2f} {best['currency']})")
    except Exception:  # noqa: BLE001
        err = traceback.format_exc()[-800:]
        try:
            set_card_status(oid, "failed",
                            notes=json.dumps({"failure": err}))
        except Exception:  # noqa: BLE001
            pass
        traceback.print_exc()


def tick_cards():
    """Process every paid (pending) card order."""
    rows = db("GET", "card_orders?status=eq.pending&order=created_at") or []
    for order in rows:
        process_card(order)


def poll_card_shipping():
    """Advance submitted/printing card orders toward shipped via Prodigi."""
    rows = db(
        "GET",
        "card_orders?status=in.(submitted,printing)&order=created_at",
    ) or []
    for order in rows:
        oid = order["id"]
        prodigi_id = order.get("prodigi_order_id")
        if not prodigi_id:
            continue
        try:
            if str(prodigi_id).startswith("gelato:"):
                _poll_gelato(order, str(prodigi_id).split(":", 1)[1])
                continue
            if str(prodigi_id).startswith("cloudprinter:"):
                _poll_cloudprinter(order, str(prodigi_id).split(":", 1)[1])
                continue
            info = prodigi_client.get_order_status(prodigi_id)
            prodigi_order = ((info or {}).get("order") or {})
            status = prodigi_order.get("status") or {}
            stage = status.get("stage") or ""
            # Prodigi stages: InProgress, Complete, Shipped, Cancelled.
            if stage in ("InProgress", "Complete") and order["status"] != "printing":
                set_card_status(oid, "printing")
                print(f"[card {oid}] printing")
            elif stage == "Shipped":
                set_card_status(oid, "shipped")
                try:
                    if hasattr(emailer, "send_card_shipped"):
                        emailer.send_card_shipped(order)
                except Exception as e:  # noqa: BLE001
                    print(f"[card {oid}] shipped email error (non-fatal): {e}")
                print(f"[card {oid}] shipped")
            elif stage == "Cancelled":
                set_card_status(oid, "failed",
                                notes=json.dumps({"failure": "Prodigi Cancelled"}))
                print(f"[card {oid}] Prodigi Cancelled")
        except Exception:  # noqa: BLE001
            traceback.print_exc()


def _poll_cloudprinter(order, ref):
    """Advance a Cloudprinter-fulfilled card toward shipped. Cloudprinter order
    states include: ordered, inproduction, shipped, delivered, canceled, error."""
    oid = order["id"]
    info = cloudprinter_client.get_order(ref)
    blob = json.dumps(info or {}).lower()
    if ("shipped" in blob or "delivered" in blob) and order["status"] != "shipped":
        set_card_status(oid, "shipped")
        try:
            if hasattr(emailer, "send_card_shipped"):
                emailer.send_card_shipped(order)
        except Exception as e:  # noqa: BLE001
            print(f"[card {oid}] shipped email error (non-fatal): {e}")
        print(f"[card {oid}] shipped (Cloudprinter)")
    elif ("canceled" in blob or "cancelled" in blob or "error" in blob):
        set_card_status(oid, "failed",
                        notes=json.dumps({"failure": "Cloudprinter canceled/error"}))
        print(f"[card {oid}] Cloudprinter canceled/error")
    elif "inproduction" in blob and order["status"] != "printing":
        set_card_status(oid, "printing")
        print(f"[card {oid}] printing (Cloudprinter)")


def _poll_gelato(order, gid):
    """Advance a Gelato-fulfilled card toward shipped. Gelato fulfilmentStatus
    values include: created, passed, in_production, shipped, delivered,
    canceled, failed."""
    oid = order["id"]
    info = gelato_client.get_order(gid)
    stage = ((info or {}).get("fulfillmentStatus")
             or (info or {}).get("orderStatus") or "").lower()
    if stage in ("in_production", "printing", "passed") and order["status"] != "printing":
        set_card_status(oid, "printing")
        print(f"[card {oid}] printing (Gelato)")
    elif stage in ("shipped", "delivered"):
        set_card_status(oid, "shipped")
        try:
            if hasattr(emailer, "send_card_shipped"):
                emailer.send_card_shipped(order)
        except Exception as e:  # noqa: BLE001
            print(f"[card {oid}] shipped email error (non-fatal): {e}")
        print(f"[card {oid}] shipped (Gelato)")
    elif stage in ("canceled", "cancelled", "failed"):
        set_card_status(oid, "failed",
                        notes=json.dumps({"failure": f"Gelato {stage}"}))
        print(f"[card {oid}] Gelato {stage}")


if __name__ == "__main__":
    poll = int(os.environ.get("POLL_SECONDS", "30"))
    print("ketabi card worker (standalone) up;",
          os.environ.get("PRODIGI_ENV", "sandbox"))
    while True:
        try:
            tick_cards()
            poll_card_shipping()
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        time.sleep(poll)
