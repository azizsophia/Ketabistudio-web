#!/usr/bin/env python3
"""Render a marketing INSERT card (A6, 300 DPI) in the Ketabi house style, to
upload in Prodigi → Settings → Inserts so it ships in every parcel."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "pipeline"))
from PIL import Image, ImageDraw  # noqa: E402
from photobook_pipeline import (  # noqa: E402
    PF, CG, ls, ctext, wrap, BONE, ESPRESSO, GOLD, GOLD_DEEP, STONE, INK,
)

W, H = 1240, 1748  # A6 @ 300 DPI (portrait)


def hairline(d, cx, y, half, color=GOLD, w=2):
    d.line([cx - half, y, cx + half, y], fill=color, width=w)


def main():
    img = Image.new("RGB", (W, H), BONE)
    d = ImageDraw.Draw(img)
    cx = W // 2
    # fine gold keyline frame
    d.rectangle([70, 70, W - 70, H - 70], outline=GOLD_DEEP, width=2)

    ls(d, "KETABI STUDIO", PF(34, 500), cx, 150, GOLD, 12)

    ctext(d, "Thank you", PF(132, 500, it=True), cx, 360, ESPRESSO)
    ctext(d, "Jazāk Allāhu khayran", CG(52, 520, it=True), cx, 540, STONE)

    hairline(d, cx, 650, 150)

    body = ("Your card was printed to order and sealed with a dua. "
            "May it carry a little barakah to whoever opens it.")
    y = 740
    bf = CG(50, 520)
    for ln in wrap(d, body, bf, W - 320):
        ctext(d, ln, bf, cx, y, INK)
        y += 76

    y += 70
    ls(d, "MORE FROM KETABI STUDIO", PF(32, 500), cx, y, GOLD, 6)
    y += 90
    ctext(d, "Keepsakes  ·  Storybooks  ·  Cards", CG(50, 520, it=True),
          cx, y, ESPRESSO)
    y += 120
    ctext(d, "ketabistudio.com", PF(60, 500), cx, y, GOLD_DEEP)
    y += 96
    ctext(d, "@ketabi.studio", CG(46, 520, it=True), cx, y, STONE)

    ctext(d, "Made with intention", CG(44, 520, it=True), cx, H - 170, STONE)

    out = Path(__file__).resolve().parent.parent / "public" / "images" / "marketing"
    out.mkdir(parents=True, exist_ok=True)
    p = out / "card-insert.png"
    img.save(p, "PNG")
    img.save("/tmp/card-insert.png", "PNG")
    print("wrote", p)


if __name__ == "__main__":
    main()
