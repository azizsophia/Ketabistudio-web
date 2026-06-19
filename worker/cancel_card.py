#!/usr/bin/env python3
"""Cancel a Prodigi card order (to release a charge for a test order placed in
error). Only works while the order is still cancellable (not yet in production).

Usage on the worker (PRODIGI_API_KEY / PRODIGI_ENV must be set):

    python cancel_card.py                 # cancel the most recent card order
    python cancel_card.py <prodigiId>     # cancel a specific Prodigi order id

With no argument it looks up the latest card order's prodigi_order_id from the
database (SUPABASE_URL / SUPABASE_SERVICE_KEY) and cancels that one.
"""
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import prodigi_client as pc  # noqa: E402


def _latest_prodigi_id():
    sb = "".join(os.environ.get("SUPABASE_URL", "").split()).rstrip("/")
    key = "".join(os.environ.get("SUPABASE_SERVICE_KEY", "").split())
    if not sb or not key:
        return None
    r = requests.get(
        f"{sb}/rest/v1/card_orders",
        headers={"Authorization": f"Bearer {key}", "apikey": key},
        params={
            "select": "id,prodigi_order_id,status,created_at",
            "prodigi_order_id": "not.is.null",
            "order": "created_at.desc",
            "limit": "1",
        },
        timeout=30,
    )
    r.raise_for_status()
    rows = r.json() or []
    if not rows:
        return None
    print(f"latest card order {rows[0]['id']} -> Prodigi "
          f"{rows[0]['prodigi_order_id']} (status {rows[0]['status']})")
    return rows[0]["prodigi_order_id"]


def main():
    pid = sys.argv[1] if len(sys.argv) > 1 else _latest_prodigi_id()
    if not pid:
        print("No Prodigi order id given and none found in the database.")
        return
    print(f"cancelling Prodigi order {pid} at {pc._base_url()} ...")
    out = pc.cancel_order(pid)
    if out is None:
        print("Cancel request failed:",
              getattr(pc, "_LAST_ERROR", None) or "unknown error")
        print("If it says the order is no longer cancellable, it has started "
              "printing — email support@prodigi.com to request a refund.")
        return
    outcome = (out.get("outcome") if isinstance(out, dict) else None) or out
    print("Cancel outcome:", outcome)
    info = pc.get_order_status(pid)
    status = (((info or {}).get("order") or {}).get("status") or {})
    print("Order status now:", status.get("stage"), status.get("details"))


if __name__ == "__main__":
    main()
