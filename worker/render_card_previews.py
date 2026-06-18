#!/usr/bin/env python3
"""Render web-optimised front-cover previews for every greeting card, from the
same PIL engine that prints them, into public/images/cards/<id>.jpg.

Run from the repo root:  python3 worker/render_card_previews.py
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "worker" / "pipeline"))
from PIL import Image  # noqa: E402
import card_pipeline as cp  # noqa: E402

CATALOG = json.loads(
    (ROOT / "worker" / "pipeline" / "cards_catalog.json").read_text("utf-8"))
WEB_W = 760


def main():
    out = ROOT / "public" / "images" / "cards"
    out.mkdir(parents=True, exist_ok=True)
    for cid, card in CATALOG.items():
        work = Path(f"/tmp/cardprev_{cid}")
        op, _ = cp.build(card, work)            # default sample message/dua
        spread = Image.open(op).convert("RGB")
        # the front cover is the RIGHT panel of the outside spread
        front = spread.crop((cp.PANEL_W, 0, cp.SPREAD_W, cp.SPREAD_H))
        h = int(front.height * (WEB_W / front.width))
        front.resize((WEB_W, h), Image.LANCZOS).save(
            out / f"{cid}.jpg", "JPEG", quality=86, optimize=True)
        shutil.rmtree(work, ignore_errors=True)
        print("wrote", cid)


if __name__ == "__main__":
    main()
