#!/usr/bin/env python3
# Journal listing HERO thumbnail (square, so Etsy search never crops it). Shows
# the real cover with two real inside-pages fanned behind it, so a buyer sees at
# a glance that it is a full journal, plus an accurate badge: printable PDF, 30
# days, instant download. No stock props, no false claims. 1600x1600.
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

_HERE = os.path.dirname(os.path.abspath(__file__))
_FONTS = os.path.join(_HERE, "..", "..", "worker", "fonts")
PLAY = os.path.join(_FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(_FONTS, "PlayfairDisplay-Italic.ttf")

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/journal2"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/journal_hero.jpg"
S = 1600
BG = (236, 230, 219)
INK = (52, 46, 38)
GOLD = (172, 138, 66)
SOFT = (120, 110, 96)


def _bg():
    a = np.full((S, S, 3), BG, np.float32)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    v = 1 - 0.08 * (((xx - .5 * S) / S) ** 2 + ((yy - .46 * S) / S) ** 2)
    a *= v[..., None]
    a += np.random.default_rng(5).normal(0, 2.0, (S, S, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8")).convert("RGBA")


def _page_layer(path, w, angle):
    """A page scaled to width w, given a thin border + drop shadow, rotated."""
    im = Image.open(path).convert("RGB")
    h = int(w * im.height / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    card.paste(im, (0, 0))
    ImageDraw.Draw(card).rectangle([0, 0, w - 1, h - 1], outline=(206, 196, 176, 255), width=3)
    pad = 90
    big = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", big.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([pad + 10, pad + 22, pad + w + 10, pad + h + 22],
                                 fill=(30, 24, 16, 105))
    sh = sh.filter(ImageFilter.GaussianBlur(26))
    big = Image.alpha_composite(big, sh)
    big.alpha_composite(card, (pad, pad))
    return big.rotate(angle, expand=True, resample=Image.BICUBIC)


def _center(d, t, f, fill, y, ls=0):
    if ls:
        w = sum(d.textlength(c, font=f) + ls for c in t) - ls
        x = (S - w) / 2
        for c in t:
            d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls
    else:
        d.text(((S - d.textlength(t, font=f)) / 2, y), t, font=f, fill=fill)


def main():
    im = _bg()
    # fan the two inside pages behind, cover in front
    back_w = 560
    write = _page_layer(os.path.join(SRC, "p001b_write.png"), back_w, 7)
    story = _page_layer(os.path.join(SRC, "p001a_story.png"), back_w, -7)
    cover = _page_layer(os.path.join(SRC, "p000_title.png"), 620, -2)
    cy = 500
    im.alpha_composite(write, (S // 2 - back_w // 2 - 250, cy - 30))
    im.alpha_composite(story, (S // 2 - back_w // 2 + 250, cy - 30))
    im.alpha_composite(cover, (S // 2 - 380, cy - 70))

    d = ImageDraw.Draw(im)
    # top headline
    _center(d, "From One Root", ImageFont.truetype(PLAY, 96), INK, 96)
    _center(d, "a 30-day journey through the language of the Qur'an",
            ImageFont.truetype(PLAY_IT, 40), SOFT, 224)
    d.line([(S / 2 - 60, 300), (S / 2 + 60, 300)], fill=GOLD, width=3)
    # bottom badge: accurate product facts
    fb = ImageFont.truetype(PLAY, 34)
    _center(d, "30 ROOTS  ·  PRINTABLE PDF  ·  INSTANT DOWNLOAD", fb, GOLD, S - 150, ls=4)
    _center(d, "every root verified, every source cited",
            ImageFont.truetype(PLAY_IT, 34), SOFT, S - 96)
    im.convert("RGB").save(OUT, quality=94)
    print("hero:", OUT)


if __name__ == "__main__":
    main()
