#!/usr/bin/env python3
"""Render a marketing INSERT card (A6, 300 DPI) in the Ketabi house style, to
upload in Prodigi -> Settings -> Inserts so it ships in every parcel."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "worker" / "pipeline"))
from PIL import Image, ImageDraw  # noqa: E402
from photobook_pipeline import (  # noqa: E402
    PF, CG, ls, ctext, wrap, star_n, BONE, ESPRESSO, GOLD, GOLD_DEEP, STONE, INK,
)

W, H = 1240, 1748  # A6 @ 300 DPI (portrait)


def hairline_star(d, cx, y, half):
    d.line([cx - half, y, cx - 26, y], fill=GOLD, width=2)
    d.line([cx + 26, y, cx + half, y], fill=GOLD, width=2)
    star_n(d, cx, y, 16, 8, fill=GOLD)


def main():
    img = Image.new("RGB", (W, H), BONE)
    d = ImageDraw.Draw(img)
    cx = W // 2
    d.rectangle([70, 70, W - 70, H - 70], outline=GOLD_DEEP, width=2)

    # brand logo lockup (mark + wordmark), centred near the top
    logo = Image.open(ROOT / "public" / "images" / "logo-vertical.png").convert("RGBA")
    lw = 300
    lh = int(logo.height * (lw / logo.width))
    logo = logo.resize((lw, lh), Image.LANCZOS)
    img.paste(logo, (cx - lw // 2, 130), logo)

    y = 130 + lh + 90
    ctext(d, "Thank you", PF(118, 500, it=True), cx, y, ESPRESSO)
    y += 170
    ctext(d, "Jazak Allahu khayran", CG(50, 520, it=True), cx, y, STONE)
    y += 110
    hairline_star(d, cx, y, 150)

    body = ("Your card was printed to order and sealed with a dua. "
            "May it carry a little barakah to whoever opens it.")
    y += 90
    bf = CG(50, 520)
    for ln in wrap(d, body, bf, W - 320):
        ctext(d, ln, bf, cx, y, INK)
        y += 76

    y += 80
    ls(d, "MORE FROM KETABI STUDIO", PF(32, 500), cx, y, GOLD, 6)
    y += 92
    ctext(d, "Keepsakes  ·  Storybooks  ·  Cards", CG(50, 520, it=True),
          cx, y, ESPRESSO)
    y += 124
    ctext(d, "ketabistudio.com", PF(62, 500), cx, y, GOLD_DEEP)
    y += 98
    ctext(d, "@ketabistudio", CG(46, 520, it=True), cx, y, STONE)

    ctext(d, "Made with intention", CG(44, 520, it=True), cx, H - 165, STONE)

    out = ROOT / "public" / "images" / "marketing"
    out.mkdir(parents=True, exist_ok=True)
    img.save(out / "card-insert.png", "PNG")
    img.save("/tmp/card-insert.png", "PNG")
    print("wrote", out / "card-insert.png")


if __name__ == "__main__":
    main()
