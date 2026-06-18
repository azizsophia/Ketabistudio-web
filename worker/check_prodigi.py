#!/usr/bin/env python3
"""Confirm the Prodigi API key works WITHOUT placing an order.

Run it on the worker (where PRODIGI_API_KEY / PRODIGI_ENV are set) — e.g. in the
Render service Shell:

    python check_prodigi.py

It asks Prodigi for a price QUOTE on the greeting-card SKU. A quote creates no
order and costs nothing; a 200 means the key is valid and the product is
recognised.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import prodigi_client  # noqa: E402

if __name__ == "__main__":
    r = prodigi_client.check_connection()
    print(json.dumps(r, indent=2))
    if r.get("ok"):
        print(f"\n✅ Prodigi connected — key accepted (env: {r.get('env')}, "
              f"endpoint: {r.get('base')}).")
        sys.exit(0)
    print(f"\n❌ Prodigi check failed: {r.get('reason')}")
    sys.exit(1)
