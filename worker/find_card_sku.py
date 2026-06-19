#!/usr/bin/env python3
"""Find the correct Prodigi greeting-card SKU WITHOUT placing an order.

Asks Prodigi's product catalogue (GET /products/{sku}) for a list of likely
greeting-card SKUs and prints which ones are real, plus their print areas and
attributes (so we wire the order correctly). Run on the worker:

    python find_card_sku.py
"""
import json
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import prodigi_client as pc  # noqa: E402

CANDIDATES = [
    "GLOBAL-GRE-4X6", "GLOBAL-GRE-5X5", "GLOBAL-GRE-5X7", "GLOBAL-GRE-7X5",
    "GLOBAL-GRE-A4", "GLOBAL-GRE-A5", "GLOBAL-GRE-A6", "GLOBAL-GRE-6X4",
    "GLOBAL-GRE-10X15", "GLOBAL-GRE-15X10", "GLOBAL-GRE-12X18",
    "GLOBAL-GRE-CARD-5X7", "GLOBAL-GRE-GRE-5X7",
    "GLOBAL-GRE-5X7-MOH", "GLOBAL-GRE-5X7-GLOSS",
    "GLOBAL-GRE-FAP-5X7", "GLOBAL-GRE-FAP-A5",
    "CLASSIC-GRE-FEDR", "CLASSIC-GRE-FEDR-5X7", "CLASSIC-GRE-FEDR-A5",
    "CLASSIC-GRE-FEDR-6X8.5",
]


def main():
    key = "".join(os.environ.get("PRODIGI_API_KEY", "").split())
    base = pc._base_url()
    if not key:
        print("PRODIGI_API_KEY not set")
        return
    print(f"checking catalogue at {base}\n")
    found = []
    for sku in CANDIDATES:
        try:
            r = requests.get(f"{base}/products/{sku}",
                             headers={"X-API-Key": key}, timeout=30)
        except Exception as e:  # noqa: BLE001
            print(f"  ERR  {sku}: {e}")
            continue
        if r.status_code == 200:
            p = (r.json() or {}).get("product", {})
            areas = list((p.get("printAreas") or {}).keys())
            print(f"VALID  {sku}")
            print(f"       desc: {p.get('description', '')}")
            print(f"       printAreas: {areas}")
            print(f"       attributes: {json.dumps(p.get('attributes', {}))[:300]}")
            found.append(sku)
        else:
            print(f"  ---  {sku} -> {r.status_code}")
    print("\nVALID SKUS:", found or "none — tell me and I'll widen the search")


if __name__ == "__main__":
    main()
