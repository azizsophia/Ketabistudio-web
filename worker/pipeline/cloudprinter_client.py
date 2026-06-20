"""
Cloudprinter Cloud Core API client for US folded greeting-card fulfilment
(sibling of prodigi_client / gelato_client). Cloudprinter prints locally
(incl. the US), does true folded cards with an inside, and its API returns
real-time print + shipping prices — which feeds our cost guard.

API: Cloud Core v1.0. Base https://api.cloudprinter.com/cloudcore/1.0.
Auth: the API key is sent in the JSON BODY as "apikey" on every POST (not a
header). Key comes from CLOUDPRINTER_API_KEY (never hardcoded).

Flow: quote (returns a per-shipment quote `hash`) -> add order (the chosen
quote hash + files + address). Every helper returns parsed JSON or None.
"""
import os

import requests

BASE = "https://api.cloudprinter.com/cloudcore/1.0"

# The folded-card product reference (Cloudprinter's "product" code) + the
# file type its template expects. Default is the US 5x7 folded portrait card
# (printed in the US); override via env if needed.
CARD_PRODUCT = (os.environ.get("CLOUDPRINTER_CARD_PRODUCT")
                or "card_folded_us_500x700_p_double_fc_tnr").strip()
CARD_FILE_TYPE = (os.environ.get("CLOUDPRINTER_FILE_TYPE") or "product").strip()

# Include an envelope by default (a greeting card should ship with one). Set
# CLOUDPRINTER_ENVELOPE="none" to drop it.
CARD_ENVELOPE = (os.environ.get("CLOUDPRINTER_ENVELOPE")
                 or "envelope_standard").strip()


def _card_options(count: int = 1):
    if CARD_ENVELOPE and CARD_ENVELOPE.lower() not in ("none", "envelope_none", ""):
        return [{"option_reference": CARD_ENVELOPE, "count": str(count)}]
    return []

_LAST_ERROR = None


def api_key() -> str:
    return "".join(os.environ.get("CLOUDPRINTER_API_KEY", "").split())


def configured() -> bool:
    return bool(api_key() and CARD_PRODUCT)


def _post(path: str, body: dict = None):
    global _LAST_ERROR
    _LAST_ERROR = None
    key = api_key()
    if not key:
        _LAST_ERROR = "CLOUDPRINTER_API_KEY is not set"
        print("[cloudprinter] CLOUDPRINTER_API_KEY is not set", flush=True)
        return None
    payload = {"apikey": key}
    payload.update(body or {})
    try:
        r = requests.post(f"{BASE}{path}", json=payload,
                          headers={"Content-Type": "application/json"},
                          timeout=60)
        if not r.ok:
            _LAST_ERROR = f"{r.status_code} {r.reason}: {r.text[:400]}"
            print(f"[cloudprinter] POST {path} -> {_LAST_ERROR}", flush=True)
            return None
        return r.json() if r.text else {}
    except Exception as err:  # noqa: BLE001
        _LAST_ERROR = f"request to {path} failed: {err}"
        print(f"[cloudprinter] {_LAST_ERROR}", flush=True)
        return None


# ── catalog discovery (used by cloudprinter_setup.py / the setup route) ──
def list_products():
    return _post("/products/")


def product_info(product_ref: str):
    return _post("/products/info/", {"reference": product_ref})


# ── quotes & orders ─────────────────────────────────────────────────
def quote(country: str, count: int = 1, product: str = None, options=None,
          state: str = None):
    """POST /orders/quote/ — product + shipping prices for a destination.
    Returns shipments[].quotes[] each with a `hash` to use on the order. The
    item options (envelope) MUST match the order, or the quote hash is invalid."""
    body = {
        "country": country,
        "items": [{
            "reference": "card",
            "product": product or CARD_PRODUCT,
            "count": str(count),
            "options": _card_options(count) if options is None else options,
        }],
    }
    if state:
        body["state"] = state
    return _post("/orders/quote/", body)


def create_order(reference: str, email: str, address: dict, file_url: str,
                 quote_hash: str, md5sum: str, count: int = 1,
                 product: str = None, file_type: str = None):
    """POST /orders/add/ — place a fulfilment order for one folded card."""
    addr = dict(address)
    addr["type"] = "delivery"
    body = {
        "reference": reference,
        "email": email,
        "addresses": [addr],
        "items": [{
            "reference": "card",  # MUST match the quote item reference
            "product": product or CARD_PRODUCT,
            "count": str(count),
            "files": [{
                "type": file_type or CARD_FILE_TYPE,
                "url": file_url,
                "md5sum": md5sum,
            }],
            "options": _card_options(count),
            "quote": quote_hash,
        }],
    }
    return _post("/orders/add/", body)


def get_order(reference: str):
    return _post("/orders/info/", {"reference": reference})


def cancel_order(reference: str):
    return _post("/orders/cancel/", {"reference": reference})
