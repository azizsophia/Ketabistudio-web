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
            "assets": [{"printArea": "outside"}, {"printArea": "inside"}],
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
