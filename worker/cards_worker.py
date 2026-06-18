#!/usr/bin/env python3
"""
KETABI GREETING-CARD FULFILLMENT

card_orders flow:
  pending → rendering → submitted (Prodigi) → printing → shipped | failed

For each paid card order the worker:
  1. Renders the outside + inside print spreads by driving the deployed
     /cards/print route with headless Chromium (Playwright) at the exact
     Prodigi artboard size (2551 x 1819 px).
  2. Uploads both PNGs to the public "card-assets" bucket.
  3. Places a Prodigi order (SKU GLOBAL-GRE-FAP-A6) with the two assets and a
     white-label packing slip, so the parcel arrives blind, from the sender.
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
from urllib.parse import urlencode  # noqa: F401 (kept for legacy _print_url)

import requests

import emailer
from pipeline import prodigi_client, card_pipeline

# Vetted card catalog (content keyed by item_id) — mirrors lib/cards.ts, read by
# the PIL renderer so the print asset is produced directly (no headless browser).
CARDS_CATALOG = json.loads(
    (Path(__file__).resolve().parent / "pipeline" / "cards_catalog.json")
    .read_text("utf-8"))

SB = "".join(os.environ["SUPABASE_URL"].split()).rstrip("/")
KEY = "".join(os.environ["SUPABASE_SERVICE_KEY"].split())
HDRS = {"Authorization": f"Bearer {KEY}", "apikey": KEY,
        "Content-Type": "application/json"}

# Prodigi artboard for GLOBAL-GRE-FAP-A6: 216 x 154 mm @ 300 DPI.
RENDER_W = 2551
RENDER_H = 1819


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
def _print_url(order, face):
    """Build a /cards/print URL for one face from the order's design fields,
    using the EXACT query-param names app/cards/print/page.tsx reads."""
    site = "".join(os.environ.get("SITE_URL", "").split()).rstrip("/")
    params = {
        "style": order.get("collection") or "arch",
        "item": order.get("item_id") or "eid",
        "name": order.get("recipient_name") or "",
        "customFront": order.get("custom_front") or "",
        "arabicIndex": str(order.get("arabic_index") or 0),
        "accent": order.get("accent") or "#b35c3c",
        "message": order.get("message") or "",
        "sender": order.get("sender") or "",
        "photo": order.get("photo_url") or "",
        "face": face,
    }
    if order.get("show_name"):
        params["showName"] = "1"
    if order.get("arabic_off"):
        params["arabicOff"] = "1"
    return f"{site}/cards/print?{urlencode(params)}"


def _render_face(page, url) -> bytes:
    """Navigate to a /cards/print URL and screenshot the spread as PNG bytes."""
    page.goto(url, wait_until="networkidle", timeout=60000)
    try:
        page.evaluate("document.fonts.ready")
    except Exception:  # noqa: BLE001
        pass
    page.wait_for_timeout(500)
    return page.screenshot(full_page=False)


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


# ── per-order processing ────────────────────────────────────────────
def process_card(order):
    """Render → upload → submit one paid card order to Prodigi.

    The print spreads are rendered directly with PIL (card_pipeline) in the
    premium house style — no headless browser — so what we preview is what
    prints, and the cards match the keepsakes by construction."""
    oid = order["id"]
    try:
        set_card_status(oid, "rendering")

        item_id = order.get("item_id") or "eid"
        card = CARDS_CATALOG.get(item_id)
        if not card:
            raise RuntimeError(f"unknown card item_id: {item_id!r}")

        workdir = Path(f"/tmp/card-{oid}")
        op, ip = card_pipeline.build(
            card, workdir,
            recipient=(order.get("recipient_name") or "")
            if order.get("show_name") else "",
            message=order.get("message") or card.get("msg", ""),
            sign_off=order.get("sender") or "",
            arabic_index=int(order.get("arabic_index") or 0),
            arabic_off=bool(order.get("arabic_off")),
            accent_hex=order.get("accent") or None,
        )
        outside_png = Path(op).read_bytes()
        inside_png = Path(ip).read_bytes()

        outside_path = storage_upload(
            "card-assets", f"renders/{oid}-outside.png", outside_png, "image/png")
        inside_path = storage_upload(
            "card-assets", f"renders/{oid}-inside.png", inside_png, "image/png")
        outside_public = public_url("card-assets", outside_path)
        inside_public = public_url("card-assets", inside_path)

        db("PATCH", f"card_orders?id=eq.{oid}",
           json={"outside_asset_url": outside_public,
                 "inside_asset_url": inside_public})

        resp = prodigi_client.create_order(
            merchant_reference=str(oid),
            recipient=_recipient_from_shipping(order),
            copies=1,
            assets=[
                {"printArea": "outside", "url": outside_public},
                {"printArea": "inside", "url": inside_public},
            ],
        )
        prodigi_order = ((resp or {}).get("order") or {})
        prodigi_order_id = prodigi_order.get("id")
        if not resp or not prodigi_order_id:
            raise RuntimeError(f"Prodigi order rejected: {json.dumps(resp)[:500]}")

        set_card_status(oid, "submitted",
                        prodigi_order_id=str(prodigi_order_id))
        log_card_event(oid, "submitted",
                       {"prodigi_order_id": str(prodigi_order_id)})
        print(f"[card {oid}] submitted to Prodigi as {prodigi_order_id}")
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
