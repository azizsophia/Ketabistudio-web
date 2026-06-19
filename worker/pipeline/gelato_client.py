"""
Gelato Print API client for greeting-card fulfilment (sibling of
prodigi_client.py). Gelato prints LOCALLY in 30+ countries, so US orders print
in the US and ship domestically — used to fix Prodigi's expensive US shipping.

Auth: X-API-KEY header read from GELATO_API_KEY (never hardcoded).
Bases (Gelato splits the API across hosts):
  order   -> https://order.gelatoapis.com      (orders, quotes)
  product -> https://product.gelatoapis.com    (catalogs, products, prices)

Every helper returns parsed JSON on success or None on failure (network /
non-2xx / parse errors are caught and logged), matching prodigi_client.
"""
import os

import requests

ORDER_BASE = "https://order.gelatoapis.com"
PRODUCT_BASE = "https://product.gelatoapis.com"

# The greeting-card product to fulfil with. Gelato identifies products by a long
# "productUid" (e.g. cards_pf_5r7_..._hor_..._4-4). Set once confirmed via
# gelato_setup.py. Until set, the Gelato path stays disabled in the worker.
CARD_PRODUCT_UID = (os.environ.get("GELATO_CARD_PRODUCT_UID") or "").strip()

_LAST_ERROR = None


def api_key() -> str:
    return "".join(os.environ.get("GELATO_API_KEY", "").split())


def configured() -> bool:
    """True only when we have both a key and a chosen card product."""
    return bool(api_key() and CARD_PRODUCT_UID)


def _request(method: str, base: str, path: str, json_body=None, params=None):
    global _LAST_ERROR
    _LAST_ERROR = None
    key = api_key()
    if not key:
        _LAST_ERROR = "GELATO_API_KEY is not set"
        print("[gelato] GELATO_API_KEY is not set", flush=True)
        return None
    try:
        res = requests.request(
            method, f"{base}{path}",
            headers={"Content-Type": "application/json", "X-API-KEY": key},
            json=json_body, params=params, timeout=60)
        if not res.ok:
            _LAST_ERROR = f"{res.status_code} {res.reason}: {res.text[:400]}"
            print(f"[gelato] {method} {path} -> {_LAST_ERROR}", flush=True)
            return None
        return res.json() if res.text else None
    except Exception as err:  # noqa: BLE001
        _LAST_ERROR = f"request to {path} failed: {err}"
        print(f"[gelato] {_LAST_ERROR}", flush=True)
        return None


# ── catalog / product discovery (used by gelato_setup.py) ────────────
def list_catalogs():
    return _request("GET", PRODUCT_BASE, "/v3/catalogs")


def search_products(catalog_uid: str, attributes=None, limit: int = 50):
    body = {"limit": limit}
    if attributes:
        body["attributeFilters"] = attributes
    return _request("POST", PRODUCT_BASE,
                    f"/v3/catalogs/{catalog_uid}/products:search", body)


def get_product(product_uid: str):
    return _request("GET", PRODUCT_BASE, f"/v3/products/{product_uid}")


def get_prices(product_uid: str, country="US", currency="USD"):
    return _request("GET", PRODUCT_BASE, f"/v3/products/{product_uid}/prices",
                    params={"country": country, "currency": currency})


# ── quotes & orders ─────────────────────────────────────────────────
def quote(shipping_address: dict, file_url: str, quantity: int = 1,
          currency: str = "USD", product_uid: str = None):
    """POST /v4/orders:quote — price + shipping options, no order created."""
    body = {
        "orderReferenceId": "quote",
        "customerReferenceId": "ketabi",
        "currency": currency,
        "products": [{
            "itemReferenceId": "card",
            "productUid": product_uid or CARD_PRODUCT_UID,
            "files": [{"type": "default", "url": file_url}],
            "quantity": quantity,
        }],
        "recipient": shipping_address,
    }
    return _request("POST", ORDER_BASE, "/v4/orders:quote", body)


def create_order(order_reference_id: str, shipping_address: dict, file_url: str,
                 quantity: int = 1, currency: str = "USD",
                 shipment_method_uid: str = None, product_uid: str = None):
    """POST /v4/orders — place a fulfilment order for one card."""
    item = {
        "itemReferenceId": order_reference_id,
        "productUid": product_uid or CARD_PRODUCT_UID,
        "files": [{"type": "default", "url": file_url}],
        "quantity": quantity,
    }
    body = {
        "orderType": "order",
        "orderReferenceId": order_reference_id,
        "customerReferenceId": "ketabi",
        "currency": currency,
        "items": [item],
        "shippingAddress": shipping_address,
    }
    if shipment_method_uid:
        body["shipmentMethodUid"] = shipment_method_uid
    return _request("POST", ORDER_BASE, "/v4/orders", body)


def get_order(order_id: str):
    return _request("GET", ORDER_BASE, f"/v4/orders/{order_id}")


def cancel_order(order_id: str):
    return _request("POST", ORDER_BASE, f"/v4/orders/{order_id}:cancel")
