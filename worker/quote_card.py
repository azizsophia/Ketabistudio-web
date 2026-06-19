#!/usr/bin/env python3
"""Print REAL Prodigi prices (print + shipping) for the greeting-card SKU to a
few destinations, using a live QUOTE (no order placed, no charge).

Run on the worker (where PRODIGI_API_KEY / PRODIGI_ENV are set):

    python quote_card.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import prodigi_client as pc  # noqa: E402

DESTS = [
    ("US", "United States"),
    ("GB", "United Kingdom"),
    ("SA", "Saudi Arabia (Riyadh)"),
]
METHODS = ["Budget", "Standard", "Express"]


def quote(cc, method):
    body = {
        "shippingMethod": method,
        "destinationCountryCode": cc,
        "items": [{
            "sku": pc.CARD_SKU,
            "copies": 1,
            "attributes": {},
            "assets": [{"printArea": pc.first_print_area()}],
        }],
    }
    return pc._request("POST", "/quotes", body)


if __name__ == "__main__":
    print(f"SKU {pc.CARD_SKU}  (env via PRODIGI_ENV)\n")
    for cc, label in DESTS:
        print(f"=== {label} [{cc}] ===")
        for m in METHODS:
            r = quote(cc, m)
            quotes = (r or {}).get("quotes") or []
            if not quotes:
                print(f"  {m:9}  (no quote)")
                continue
            cs = quotes[0].get("costSummary", {}) or {}
            items = cs.get("items", {}) or {}
            ship = cs.get("shipping", {}) or {}
            cur = items.get("currency") or ship.get("currency") or ""
            ia = float(items.get("amount", 0) or 0)
            sa = float(ship.get("amount", 0) or 0)
            print(f"  {m:9}  print {ia:6.2f} + shipping {sa:6.2f} "
                  f"= {ia + sa:6.2f} {cur}")
        print()
