"""
Prodigi Print API client for greeting-card fulfillment (Python port of
lib/prodigi.ts).

Cards are fulfilled as fine-art folded greeting cards via Prodigi
(SKU GLOBAL-GRE-MOH-7X5-DIR). Prodigi takes ONE flattened artboard that
carries all four panels (outer rear | outer front | inside front | inside
back), bleed included, uploaded to the single "default" print area. That
artboard is produced directly by card_pipeline.render_artboard at the exact
template size (6117 x 2161 px @ 300 DPI).

Auth: X-API-Key header read from PRODIGI_API_KEY (never hardcoded). Base URL
is selected by PRODIGI_ENV ("live" vs sandbox). Every helper returns parsed
JSON on success or None on failure (network / non-2xx / parse errors are
caught and logged, matching lib/prodigi.ts).
"""
import os

import requests

# The greeting-card product SKU. Override via PRODIGI_CARD_SKU if you switch
# product (e.g. -BLA self-send vs -DIR direct-to-recipient).
CARD_SKU = (os.environ.get("PRODIGI_CARD_SKU") or "GLOBAL-GRE-MOH-7X5-DIR").strip()

# Fine-art greeting cards take ONE stitched artboard on a single print area.
# Override via PRODIGI_CARD_PRINT_AREA only if the product reports a different
# name; first_print_area() below confirms it from the live product at runtime.
CARD_PRINT_AREA = (os.environ.get("PRODIGI_CARD_PRINT_AREA") or "default").strip()


def _base_url() -> str:
    env = "".join(os.environ.get("PRODIGI_ENV", "").split()).lower()
    # Accept live / production / prod so it can't silently stay in sandbox.
    if env in ("live", "production", "prod"):
        return "https://api.prodigi.com/v4.0"
    return "https://api.sandbox.prodigi.com/v4.0"


_LAST_ERROR = None


def _request(method: str, path: str, json_body=None):
    global _LAST_ERROR
    _LAST_ERROR = None
    api_key = "".join(os.environ.get("PRODIGI_API_KEY", "").split())
    if not api_key:
        _LAST_ERROR = "PRODIGI_API_KEY is not set"
        print("[prodigi] PRODIGI_API_KEY is not set", flush=True)
        return None
    try:
        res = requests.request(
            method,
            f"{_base_url()}{path}",
            headers={"Content-Type": "application/json", "X-API-Key": api_key},
            json=json_body,
            timeout=60,
        )
        if not res.ok:
            _LAST_ERROR = f"{res.status_code} {res.reason}: {res.text[:400]}"
            print(f"[prodigi] {method} {path} -> {_LAST_ERROR}", flush=True)
            return None
        return res.json() if res.text else None
    except Exception as err:  # noqa: BLE001
        _LAST_ERROR = f"request to {path} failed: {err}"
        print(f"[prodigi] {_LAST_ERROR}", flush=True)
        return None


def get_product(sku: str = None):
    """GET /products/{sku} — returns the parsed product dict (or None)."""
    sku = (sku or CARD_SKU).strip()
    res = _request("GET", f"/products/{requests.utils.quote(sku)}")
    return (res or {}).get("product") if isinstance(res, dict) else None


def first_print_area(sku: str = None) -> str:
    """Resolve the print-area name to upload the stitched artboard under.

    Asks the live product for its printAreas and returns the single key (fine-
    art cards expose one). Falls back to CARD_PRINT_AREA ("default") if the
    lookup fails so an order can still be attempted."""
    product = get_product(sku)
    areas = list((product or {}).get("printAreas", {}).keys())
    if len(areas) == 1:
        return areas[0]
    if CARD_PRINT_AREA in areas:
        return CARD_PRINT_AREA
    return areas[0] if areas else CARD_PRINT_AREA


def check_connection():
    """Validate PRODIGI_API_KEY by requesting a QUOTE (no order is created).
    Returns a dict {ok, status, env, base, key, reason}. A 200 means the key is
    accepted and the card SKU is recognised."""
    env = "".join(os.environ.get("PRODIGI_ENV", "").split()) or "sandbox"
    key = "".join(os.environ.get("PRODIGI_API_KEY", "").split())
    if not key:
        return {"ok": False, "env": env, "reason": "PRODIGI_API_KEY is not set"}
    masked = (key[:5] + "…" + key[-2:]) if len(key) > 8 else "set"
    body = {
        "shippingMethod": "Standard",
        "destinationCountryCode": "US",
        "items": [{
            "sku": CARD_SKU,
            "copies": 1,
            "attributes": {},
            "assets": [{"printArea": first_print_area()}],
        }],
    }
    try:
        res = requests.post(
            f"{_base_url()}/quotes",
            headers={"Content-Type": "application/json", "X-API-Key": key},
            json=body, timeout=60)
    except Exception as err:  # noqa: BLE001
        return {"ok": False, "env": env, "key": masked,
                "reason": f"network error: {err}"}
    out = {"status": res.status_code, "env": env, "key": masked,
           "base": _base_url()}
    if res.status_code in (401, 403):
        out.update(ok=False, reason="key rejected (401/403) — wrong key, or key "
                                    "doesn't match PRODIGI_ENV")
    elif not res.ok:
        out.update(ok=False, reason=res.text[:300])
    else:
        out.update(ok=True)
    return out


def quote_cost(country_code: str, shipping_method: str, copies: int = 1):
    """Return {method, items, shipping, total, currency} for one card to a
    destination, or None. No order is created (no charge)."""
    body = {
        "shippingMethod": shipping_method,
        "destinationCountryCode": country_code,
        "items": [{
            "sku": CARD_SKU,
            "copies": copies,
            "attributes": {},
            "assets": [{"printArea": first_print_area()}],
        }],
    }
    r = _request("POST", "/quotes", body)
    quotes = (r or {}).get("quotes") or []
    if not quotes:
        return None
    cs = quotes[0].get("costSummary", {}) or {}
    items = cs.get("items", {}) or {}
    ship = cs.get("shipping", {}) or {}
    ia = float(items.get("amount", 0) or 0)
    sa = float(ship.get("amount", 0) or 0)
    return {
        "method": shipping_method,
        "items": ia,
        "shipping": sa,
        "total": ia + sa,
        "currency": items.get("currency") or ship.get("currency") or "USD",
    }


def cheapest_shipping(country_code: str, copies: int = 1,
                      methods=("Budget", "Standard", "Express")):
    """Quote each shipping method and return the CHEAPEST valid one (a dict from
    quote_cost), or None. Used to avoid ever defaulting to pricey couriers."""
    best = None
    for m in methods:
        q = quote_cost(country_code, m, copies)
        if q and (best is None or q["total"] < best["total"]):
            best = q
    return best


def create_order(
    merchant_reference: str,
    recipient: dict,
    copies: int,
    assets: list,
    shipping_method: str = "Budget",
    sizing: str = "fillPrintArea",
):
    """POST /orders — place a fulfillment order for one personalised card.

    The line item carries the single stitched artboard asset (printArea
    "default") and ships white-label (blind, from the sender) since no custom
    packing slip is attached.

    recipient shape (per Prodigi):
      { name, email?, address: { line1, line2?, postalOrZipCode,
        countryCode, townOrCity, stateOrCounty? } }
    assets: list of { "printArea": <name>, "url": <public url> }
    """
    body = {
        "merchantReference": merchant_reference,
        "shippingMethod": shipping_method,
        "recipient": recipient,
        "items": [
            {
                "merchantReference": merchant_reference,
                "sku": CARD_SKU,
                "copies": copies,
                "sizing": sizing,
                "assets": [
                    {"printArea": a["printArea"], "url": a["url"]} for a in assets
                ],
            }
        ],
    }
    # Optional custom packing slip. Only include it if a real URL is set —
    # Prodigi rejects packingSlip.url=null. With it omitted, the parcel ships
    # white-label (blind) by default, which is what we want.
    slip_url = "".join(os.environ.get("PACKING_SLIP_URL", "").split())
    if slip_url:
        body["packingSlip"] = {"url": slip_url}
    return _request("POST", "/orders", body)


def get_order_status(order_id: str):
    """GET /orders/{id} — fetch fulfillment status for a placed order."""
    return _request("GET", f"/orders/{requests.utils.quote(str(order_id))}")


def cancel_order(order_id: str):
    """POST /orders/{id}/actions/cancel — cancel an order that has not yet gone
    to production. Returns the parsed outcome (or None). Prodigi only allows
    this while the order is cancellable; once printing it must go to support."""
    oid = requests.utils.quote(str(order_id))
    return _request("POST", f"/orders/{oid}/actions/cancel")
