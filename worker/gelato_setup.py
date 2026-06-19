#!/usr/bin/env python3
"""Discover Gelato's greeting-card product + the file/template spec we need to
render to, and price it for a few countries. No order is placed (no charge).

Run on the worker once GELATO_API_KEY is set in Render:

    python gelato_setup.py

It prints: the catalogs, the greeting-card products it can find (with their
productUid), the chosen/first card product's print-file requirements
(dimensions, pages, print areas), and US/UK/DE prices. Paste the output back
and the renderer + GELATO_CARD_PRODUCT_UID get finalised from it.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import gelato_client as gc  # noqa: E402


def show(obj, n=1400):
    print(json.dumps(obj, indent=2)[:n])


def main():
    if not gc.api_key():
        print("GELATO_API_KEY is not set in this environment.")
        return

    print("=== CATALOGS ===")
    cats = gc.list_catalogs() or []
    for c in cats:
        print(f"  {c.get('catalogUid')!r:24} {c.get('title','')}")
    # Gelato groups greeting cards under a "cards" catalog (name may vary).
    card_cat = next((c.get("catalogUid") for c in cats
                     if "card" in (c.get("catalogUid", "") + c.get("title", "")).lower()),
                    "cards")

    print(f"\n=== PRODUCTS in {card_cat!r} ===")
    res = gc.search_products(card_cat, limit=60) or {}
    products = res.get("products") or []
    folded = []
    for p in products:
        uid = p.get("productUid", "")
        if any(k in uid for k in ("5r7", "5x7", "7r5", "fold")):
            folded.append(uid)
        print(f"  {uid}")
    print(f"\n folded/5x7 candidates: {folded or '(none matched; see full list above)'}")

    target = gc.CARD_PRODUCT_UID or (folded[0] if folded else
                                     (products[0].get("productUid") if products else None))
    if not target:
        print("\nNo product found to inspect. Paste the product list above to me.")
        return

    print(f"\n=== PRODUCT DETAIL: {target} ===")
    show(gc.get_product(target))

    print("\n=== PRICES (qty 1) ===")
    for cc in ("US", "GB", "DE"):
        pr = gc.get_prices(target, country=cc) or []
        first = pr[0] if isinstance(pr, list) and pr else pr
        print(f"  {cc}: {json.dumps(first)[:200]}")


if __name__ == "__main__":
    main()
