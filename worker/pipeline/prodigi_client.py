"""
Prodigi Print API client for greeting-card fulfillment (Python port of
lib/prodigi.ts).

Cards are fulfilled as A6 folded greeting cards via Prodigi
(SKU GLOBAL-GRE-FAP-A6). Each card needs two print assets:
  - "outside" print area: back panel | front face
  - "inside"  print area: blank panel | inside face
Those assets are produced by the headless render of /cards/print.

Auth: X-API-Key header read from PRODIGI_API_KEY (never hardcoded). Base URL
is selected by PRODIGI_ENV ("live" vs sandbox). Every helper returns parsed
JSON on success or None on failure (network / non-2xx / parse errors are
caught and logged, matching lib/prodigi.ts).
"""
import os

import requests

CARD_SKU = "GLOBAL-GRE-FAP-A6"


def _base_url() -> str:
    env = "".join(os.environ.get("PRODIGI_ENV", "").split()).lower()
    # Accept live / production / prod so it can't silently stay in sandbox.
    if env in ("live", "production", "prod"):
        return "https://api.prodigi.com/v4.0"
    return "https://api.sandbox.prodigi.com/v4.0"


def _request(method: str, path: str, json_body=None):
    api_key = "".join(os.environ.get("PRODIGI_API_KEY", "").split())
    if not api_key:
        print("[prodigi] PRODIGI_API_KEY is not set")
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
            print(
                f"[prodigi] {method} {path} -> {res.status_code} "
                f"{res.reason} {res.text[:500]}"
            )
            return None
        return res.json() if res.text else None
    except Exception as err:  # noqa: BLE001
        print(f"[prodigi] request to {path} failed: {err}")
        return None


def create_order(
    merchant_reference: str,
    recipient: dict,
    copies: int,
    assets: list,
    shipping_method: str = "Standard",
    sizing: str = "fillPrintArea",
):
    """POST /orders — place a fulfillment order for one personalised card.

    The line item carries the outside + inside print assets and a white-label
    (no branding) packing slip so the parcel arrives blind, from the sender.

    recipient shape (per Prodigi):
      { name, email?, address: { line1, line2?, postalOrZipCode,
        countryCode, townOrCity, stateOrCounty? } }
    assets: list of { "printArea": "outside"|"inside", "url": <public url> }
    """
    # Branded packing slip (PDF hosted on the site). Falls back to white-label
    # (no slip) if neither PACKING_SLIP_URL nor SITE_URL is configured.
    site = "".join(os.environ.get("SITE_URL", "").split()).rstrip("/")
    slip_url = os.environ.get("PACKING_SLIP_URL") or (
        f"{site}/packing-slip.pdf" if site else None
    )
    body = {
        "merchantReference": merchant_reference,
        "shippingMethod": shipping_method,
        "recipient": recipient,
        "packingSlip": {"url": slip_url},
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
    return _request("POST", "/orders", body)


def get_order_status(order_id: str):
    """GET /orders/{id} — fetch fulfillment status for a placed order."""
    return _request("GET", f"/orders/{requests.utils.quote(str(order_id))}")
