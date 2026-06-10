#!/usr/bin/env python3
"""
Ketabi Studio — Front/back matter pages for "(Name) and Her Beautiful Hijab"
Brings the interior to Lulu's 32-page minimum with pages that add value:
  2  Copyright
  3  Dedication
  29 The End
  30 Closing blessing
  31 Bookplate ("This book belongs to ...")
  32 Ketabi Studio
All match the title-page aesthetic (cream bg, brand fonts/colors).
"""
from PIL import Image, ImageDraw, ImageFont
from title_page import (
    _bg_layer, _motif_layer, _divider_layer, _text_layer, _add_bleed,
    _sanitize, FONT_BJOLA, FONT_CROC,
    FOREST, CREAM, TEAL, GOLD, DEEP_GOLD, WARM_BROWN, CANVAS, BLEED, DPI,
)

FONT_AMIRI = "fonts/Amiri-Bold.ttf"


# ── Kaf app-icon (forest-green rounded square + cream kaf) ───────────
def build_kaf_icon(size=600):
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    radius = int(size * 0.22)
    # vertical forest gradient (hsl 152,35%,35% -> 22%)
    grad = Image.new("RGB", (size, size))
    gd = ImageDraw.Draw(grad)
    top, bot = (58, 120, 91), (36, 75, 57)
    for y in range(size):
        t = y / size
        gd.line([(0, y), (size, y)], fill=(
            int(top[0]*(1-t)+bot[0]*t),
            int(top[1]*(1-t)+bot[1]*t),
            int(top[2]*(1-t)+bot[2]*t)))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size-1, size-1], radius=radius, fill=255)
    icon.paste(grad, (0, 0), mask)
    # kaf, centered, cream
    kfont = ImageFont.truetype(FONT_AMIRI, int(size*0.6))
    kd = ImageDraw.Draw(icon)
    kaf = "\u0643"
    bb = kfont.getbbox(kaf)
    kw, kh = bb[2]-bb[0], bb[3]-bb[1]
    kx = (size-kw)//2 - bb[0]
    ky = (size-kh)//2 - bb[1]
    kd.text((kx, ky), kaf, font=kfont, fill=(250, 248, 242, 255))
    return icon


# ── Shared multi-line centered text ─────────────────────────────────
def _multiline(layer, lines, font, fill, y_start, line_gap=1.4, size=CANVAS):
    d = ImageDraw.Draw(layer)
    ref = font.getbbox("Ay")
    lh = int((ref[3]-ref[1]) * line_gap)
    y = y_start
    for ln in lines:
        ln = _sanitize(ln)
        bb = d.textbbox((0, 0), ln, font=font)
        x = (size - (bb[2]-bb[0])) // 2
        d.text((x, y - bb[1]), ln, font=font, fill=fill)
        y += lh
    return y


def _compose(layers, add_bleed=True):
    flat = layers[0]
    for ly in layers[1:]:
        flat = Image.alpha_composite(flat, ly)
    rgb = flat.convert("RGB")
    return _add_bleed(rgb, BLEED) if add_bleed else rgb


# ── Page builders ────────────────────────────────────────────────────
def copyright_page(child_name, year=2026, add_bleed=True):
    size = CANVAS
    bg = _bg_layer(size)
    txt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    title_f = ImageFont.truetype(FONT_BJOLA, int(size*0.04))
    body_f = ImageFont.truetype(FONT_CROC, int(size*0.026))
    _multiline(txt, [f"{child_name} and Her Beautiful Hijab"],
               title_f, FOREST+(255,), int(size*0.40))
    _multiline(txt, [
        f"Copyright (c) {year} Ketabi Studio",
        "All rights reserved.",
        "",
        "No part of this book may be reproduced",
        "without written permission.",
        "",
        "ketabistudio.com",
    ], body_f, WARM_BROWN+(255,), int(size*0.48), line_gap=1.5)
    return _compose([bg, txt], add_bleed)


def dedication_page(child_name, add_bleed=True):
    size = CANVAS
    bg = _bg_layer(size)
    motif = _motif_layer(size)
    txt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    small_f = ImageFont.truetype(FONT_CROC, int(size*0.035))
    name_f = ImageFont.truetype(FONT_BJOLA, int(size*0.075))
    _multiline(txt, ["Made especially for"], small_f, WARM_BROWN+(255,),
               int(size*0.43))
    _multiline(txt, [child_name], name_f, DEEP_GOLD+(255,), int(size*0.50))
    div = _divider_layer(size, 0.62)
    end = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    _multiline(end, ["with love"], small_f, WARM_BROWN+(255,), int(size*0.66))
    return _compose([bg, motif, txt, div, end], add_bleed)


def the_end_page(add_bleed=True):
    size = CANVAS
    bg = _bg_layer(size)
    motif = _motif_layer(size)
    txt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    end_f = ImageFont.truetype(FONT_BJOLA, int(size*0.09))
    _multiline(txt, ["The End"], end_f, FOREST+(255,), int(size*0.44))
    div = _divider_layer(size, 0.58)
    return _compose([bg, motif, txt, div], add_bleed)


def blessing_page(add_bleed=True):
    size = CANVAS
    bg = _bg_layer(size)
    motif = _motif_layer(size)
    txt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    body_f = ImageFont.truetype(FONT_CROC, int(size*0.044))
    _multiline(txt, [
        "May your hijab always remind you",
        "to be kind, to be brave,",
        "and to be beautifully you.",
    ], body_f, FOREST+(255,), int(size*0.42), line_gap=1.5)
    return _compose([bg, motif, txt], add_bleed)


def bookplate_page(child_name, add_bleed=True):
    size = CANVAS
    bg = _bg_layer(size)
    txt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    small_f = ImageFont.truetype(FONT_CROC, int(size*0.038))
    name_f = ImageFont.truetype(FONT_BJOLA, int(size*0.072))
    _multiline(txt, ["This book belongs to"], small_f, WARM_BROWN+(255,),
               int(size*0.42))
    _multiline(txt, [child_name], name_f, DEEP_GOLD+(255,), int(size*0.50))
    div = _divider_layer(size, 0.63)
    return _compose([bg, txt, div], add_bleed)


def studio_page(add_bleed=True):
    size = CANVAS
    bg = _bg_layer(size)
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    kaf = build_kaf_icon(int(size*0.22))
    icon.paste(kaf, ((size - kaf.width)//2, int(size*0.30)), kaf)
    txt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    name_f = ImageFont.truetype(FONT_BJOLA, int(size*0.05))
    tag_f = ImageFont.truetype(FONT_CROC, int(size*0.028))
    _multiline(txt, ["Ketabi Studio"], name_f, FOREST+(255,), int(size*0.56))
    _multiline(txt, ["Stories that help little hearts grow.",
                     "ketabistudio.com"],
               tag_f, WARM_BROWN+(255,), int(size*0.63), line_gap=1.6)
    return _compose([bg, icon, txt], add_bleed)


if __name__ == "__main__":
    import sys
    name = sys.argv[1] if len(sys.argv) > 1 else "Amira"
    builders = {
        "copyright": lambda: copyright_page(name, add_bleed=False),
        "dedication": lambda: dedication_page(name, add_bleed=False),
        "theend": lambda: the_end_page(add_bleed=False),
        "blessing": lambda: blessing_page(add_bleed=False),
        "bookplate": lambda: bookplate_page(name, add_bleed=False),
        "studio": lambda: studio_page(add_bleed=False),
    }
    for k, fn in builders.items():
        img = fn()
        img.save(f"output/matter_{k}.jpg", "JPEG", quality=90)
        print(f"Built matter_{k}.jpg")
