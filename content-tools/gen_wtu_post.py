#!/usr/bin/env python3
"""
Ketabi "We The Urban, but ours" Instagram post generator.

One type system, one texture engine, many formats. Every post:
  - DM Serif Display, title case, italic emphasis words
  - a soft watercolor wash (a different color per post, generated fresh)
  - the KETABI STUDIO mark tucked directly UNDER the text (crop-proof)
  - silent, 1080x1350 (IG 4:5)

Content rules (enforced by the caller / builder, not this renderer):
  - Quran verses appear ONCE, quoted verbatim + cited. Never tiled/remixed.
  - Tiled dhikr walls use dhikr phrases or our own words only.
  - His/Him/He capitalized for Allah. No em dashes. No music.

render(spec, out_path) takes a dict spec; see build_wtu_week.py for examples.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "worker", "fonts")
DM = os.path.join(FF, "DMSerifDisplay.ttf")
DM_IT = os.path.join(FF, "DMSerifDisplay-Italic.ttf")
DEJA = os.path.join(FF, "DejaVuSans.ttf")
AMIRI_B = os.path.join(FF, "Amiri-Bold.ttf")
RUQAA = os.path.join(FF, "ArefRuqaa-Regular.ttf")

W, H = 1080, 1350
INK = (32, 28, 24)
CREAM_TXT = (248, 242, 232)
GOLD = (208, 176, 88)

# curated wash palette; (base_rgb, dark_text?) — one per post, rotated by caller
PALETTE = {
    "terra":   ((176, 104, 74), True),
    "sage":    ((150, 168, 148), True),
    "blue":    ((120, 142, 168), True),
    "plum":    ((110, 74, 96), False),
    "ochre":   ((196, 158, 78), True),
    "rose":    ((196, 148, 148), True),
    "forest":  ((52, 82, 66), False),
    "aubergine": ((58, 46, 64), False),
    "clay":    ((162, 92, 70), True),
    "moss":    ((104, 120, 96), False),
}


def F(path, size):
    return ImageFont.truetype(path, size, layout_engine=ImageFont.Layout.RAQM)


def _fractal(seed):
    rng = np.random.default_rng(seed)
    field = np.zeros((H, W), float)
    amp = 1.0
    for scale in [4, 8, 16, 32, 64]:
        small = rng.random((scale, scale))
        up = np.array(Image.fromarray((small * 255).astype("uint8")).resize((W, H), Image.BICUBIC), float) / 255
        field += up * amp
        amp *= 0.6
    return (field - field.min()) / (field.max() - field.min())


def watercolor(base, seed=1, depth=34, dark_text=True):
    """soft painted wash: two cloud fields, blooms toward light, paper grain"""
    light = (252, 248, 240) if dark_text else (250, 246, 238)
    cloud = 0.6 * _fractal(seed) + 0.4 * _fractal(seed + 99)
    cloud = (cloud - cloud.min()) / (cloud.max() - cloud.min())
    base = np.array(base, float)
    lightc = np.array(light, float)
    t = (cloud[:, :, None] - 0.5)
    col = base[None, None, :] + t * depth
    bloom = np.clip((cloud - 0.62) / 0.38, 0, 1)[:, :, None]
    col = col * (1 - bloom * 0.5) + lightc[None, None, :] * (bloom * 0.5)
    grain = (np.random.default_rng(seed + 7).random((H, W)) - 0.5) * 9
    col = col + grain[:, :, None]
    return Image.fromarray(np.clip(col, 0, 255).astype("uint8"), "RGB").filter(ImageFilter.GaussianBlur(1.1))


def _spaced(d, y, text, font, fill, tr=5, cx=W // 2):
    total = sum(d.textlength(c, font=font) + tr for c in text) - tr
    x = cx - total / 2
    for c in text:
        d.text((x, y), c, font=font, fill=fill)
        x += d.textlength(c, font=font) + tr


def _diamond(d, cx, y, width=140, color=GOLD):
    d.line([cx - width // 2, y, cx - 12, y], fill=color, width=2)
    d.line([cx + 12, y, cx + width // 2, y], fill=color, width=2)
    s = 5
    d.polygon([(cx, y - s), (cx + s, y), (cx, y + s), (cx - s, y)], fill=color)


def _mark(d, y, txt, base):
    mc = tuple(int(c * 0.6 + b * 0.4) for c, b in zip(txt, base))
    _spaced(d, y, "K E T A B I   S T U D I O", F(DEJA, 20), mc, tr=5)


def _wrap_mixed(d, segs, rf, itf, maxw):
    """segs: list of (text, is_italic). Returns wrapped lines of (word, italic)."""
    words = []
    for text, isit in segs:
        for w in text.split(" "):
            if w:
                words.append((w, isit))
    wsp = d.textlength(" ", font=rf)

    def wl(w, i):
        return d.textlength(w, font=(itf if i else rf))
    lines = [[]]
    cur = 0
    for w, i in words:
        ww = wl(w, i)
        if cur + ww > maxw and lines[-1]:
            lines.append([])
            cur = 0
        lines[-1].append((w, i))
        cur += ww + wsp
    return lines, wsp, wl


def _text_block(img, segs, size, txt, cy, sub_lines=None, sub_size=44, sub_col=None):
    """title case + italic emphasis, centered on cy; optional italic sub lines"""
    d = ImageDraw.Draw(img)
    rf, itf = F(DM, size), F(DM_IT, size)
    lines, wsp, wl = _wrap_mixed(d, segs, rf, itf, 900)
    lh = int(size * 1.12)
    sub_lh = int(sub_size * 1.32)
    total = lh * len(lines) + ((26 + sub_lh * len(sub_lines)) if sub_lines else 0)
    y = int(cy - total / 2)
    for line in lines:
        tot = sum(wl(w, i) for w, i in line) + wsp * (len(line) - 1)
        x = (W - tot) / 2
        for w, i in line:
            f = itf if i else rf
            d.text((x, y), w, font=f, fill=txt)
            x += wl(w, i) + wsp
        y += lh
    if sub_lines:
        y += 20
        sf = F(DM_IT, sub_size)
        sc = sub_col or tuple(min(255, c + 16) for c in txt)
        for ln in sub_lines:
            wpx = d.textlength(ln, font=sf)
            d.text(((W - wpx) / 2, y), ln, font=sf, fill=sc)
            y += sub_lh
    return y


# ── format renderers ───────────────────────────────────────────────────
def _fmt_reminder(img, spec, base, txt):
    """title(+italic word) [+ optional italic sub lines]"""
    endy = _text_block(img, spec["title"], spec.get("size", 84), txt, H // 2 - 30,
                       sub_lines=spec.get("sub"), sub_size=spec.get("sub_size", 44),
                       sub_col=spec.get("sub_col"))
    ImageDraw.Draw(img)
    _mark(ImageDraw.Draw(img), endy + 22, txt, base)


def _fmt_verse(img, spec, base, txt):
    """reminder line, gold diamond, verse (italic), citation, mark under"""
    d = ImageDraw.Draw(img)
    endy = _text_block(img, spec["title"], spec.get("size", 80), txt, H // 2 - 90)
    _diamond(d, W // 2, endy + 34, color=GOLD)
    vf = F(DM_IT, spec.get("verse_size", 44))
    y = endy + 74
    for ln in spec["verse_lines"]:
        wpx = d.textlength(ln, font=vf)
        d.text(((W - wpx) / 2, y), ln, font=vf, fill=txt)
        y += int(spec.get("verse_size", 44) * 1.34)
    cc = tuple(int(c * 0.72 + b * 0.28) for c, b in zip(txt, base))
    _spaced(d, y + 6, spec["cite"], F(DEJA, 21), cc, tr=4)
    _mark(d, y + 52, txt, base)


def _fmt_wall(img, spec, base, txt):
    """dhikr phrase tiled in Amiri, English italic closing line, mark under"""
    d = ImageDraw.Draw(img)
    ar = spec["arabic"]
    rows = spec.get("rows", 12)
    ar_size = spec.get("ar_size", 62)
    row_h = spec.get("row_h", 74)
    af = F(AMIRI_B, ar_size)
    wpx = d.textlength(ar, font=af, direction="rtl", language="ar")
    top = 138
    fade = spec.get("fade", False)
    for i in range(rows):
        y = top + i * row_h
        col = txt
        if fade:
            f = 1 - (i / rows) * 0.4
            col = tuple(int(c * f + b * (1 - f)) for c, b in zip(txt, base))
        d.text(((W - wpx) / 2, y), ar, font=af, fill=col, direction="rtl", language="ar")
    ey = top + rows * row_h + 42
    ef = F(DM_IT, spec.get("en_size", 58))
    ewpx = d.textlength(spec["closing"], font=ef)
    d.text(((W - ewpx) / 2, ey), spec["closing"], font=ef, fill=txt)
    _mark(d, ey + spec.get("en_size", 58) + 26, txt, base)


def _fmt_ameen(img, spec, base, txt):
    """Arabic hero (Ruqaa), reminder lines, 'type Ameen below' pill, mark under"""
    d = ImageDraw.Draw(img)
    cnv = Image.new("RGBA", (4200, 1200), (0, 0, 0, 0))
    dc = ImageDraw.Draw(cnv)
    dc.text((120, 300), spec["arabic"], font=F(RUQAA, 300), fill=GOLD + (255,),
            direction="rtl", language="ar")
    art = cnv.crop(cnv.getbbox())
    scale = spec.get("ar_w", 540) / art.width
    art = art.resize((spec.get("ar_w", 540), int(art.height * scale)), Image.LANCZOS)
    ax = (W - art.width) // 2
    ay = spec.get("ar_y", 330)
    img.paste(art, (ax, ay), art)
    endy = _text_block(img, spec["title"], spec.get("size", 76), txt, ay + art.height + 150)
    _diamond(d, W // 2, endy + 32, color=GOLD)
    pf = F(DEJA, 26)
    pill = spec.get("pill", "type  AMEEN  below")
    tw = sum(d.textlength(ch, font=pf) + 5 for ch in pill) - 5
    px, py = (W - tw) / 2 - 34, endy + 58
    d.rounded_rectangle([px, py, px + tw + 68, py + 60], radius=30, outline=GOLD, width=2)
    _spaced(d, py + 16, pill, pf, GOLD, tr=5)
    _mark(d, py + 96, txt, base)


FORMATS = {
    "reminder": _fmt_reminder,
    "verse": _fmt_verse,
    "wall": _fmt_wall,
    "ameen": _fmt_ameen,
}


def render(spec, out_path):
    """spec: {format, color, seed, ...format-specific fields}"""
    base, dark = PALETTE[spec["color"]]
    img = watercolor(base, seed=spec.get("seed", 1), dark_text=dark)
    txt = INK if dark else CREAM_TXT
    FORMATS[spec["format"]](img, spec, base, txt)
    img.save(out_path)
    return out_path


if __name__ == "__main__":
    # smoke test
    render({"format": "reminder", "color": "terra", "seed": 3,
            "title": [("You are ", False), ("good enough.", True),
                      (" You always have been.", False)]},
           "/tmp/_wtu_smoke.png")
    print("ok /tmp/_wtu_smoke.png")
