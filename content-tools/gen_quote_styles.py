#!/usr/bin/env python3
# Three candidate SIGNATURE designs for Ketabi's Qur'an-quote posts (the new
# social direction). All verses verified; translations are Dr. Mustafa Khattab,
# The Clear Quran, verbatim. 1080x1350 (4:5). Zoom-QC the Arabic per render.
#   A  MIDNIGHT GLOW  dark luxe, luminous gold Arabic, italic cream English
#   B  TYPE POSTER    cream editorial, huge expressive serif, gold accent word
#   C  NEAR           extreme-minimal statement piece on deep forest green
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

D = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(os.path.dirname(D), "worker", "fonts")
AMIRI = os.path.join(FF, "Amiri-Bold.ttf")
PLAY = os.path.join(FF, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FF, "PlayfairDisplay-Italic.ttf")
SANS = os.path.join(FF, "DejaVuSans.ttf")
W, H = 1080, 1350

# ---- verified content (Clear Quran, Khattab, verbatim) ----
V_EASE = {
    "ar": "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    "en_lines": ["Surely with hardship", "comes ease."],
    "accent_word": "ease.",
    "cite": "QUR'AN 94:6",
}
V_HEARTS = {
    "ar": "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
    "en_lines": ["Surely in the remembrance of Allah", "do hearts find comfort."],
    "cite": "QUR'AN 13:28",
}
V_NEAR = {
    "ar": "فَإِنِّي قَرِيبٌ",
    "en_lines": ["I am truly near."],
    "cite": "QUR'AN 2:186",
}


def _grain(im, sigma=3.2, seed=7):
    a = np.asarray(im, np.float32) + np.random.default_rng(seed).normal(0, sigma, (im.height, im.width, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def _ctext(d, t, f, fill, y, ls=0):
    w = sum(d.textlength(c, font=f) + ls for c in t) - ls if ls else d.textlength(t, font=f)
    x = (W - w) / 2
    if ls:
        for c in t:
            d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls
    else:
        d.text((x, y), t, font=f, fill=fill)


def _ar_center(d, ar, f, fill, y):
    bb = d.textbbox((0, 0), ar, font=f)
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1]), ar, font=f, fill=fill)
    return bb[3] - bb[1]


def _brand(d, dark_ground):
    c = (176, 148, 94) if dark_ground else (150, 128, 90)
    _ctext(d, "K E T A B I", ImageFont.truetype(SANS, 21), c, H - 84, 6)


# ---- A: MIDNIGHT GLOW -------------------------------------------------------
def style_a(v, out):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.array((24, 22, 20), np.float32)
    glow = np.exp(-(((xx - W / 2) / (W * 0.55)) ** 2 + ((yy - H * 0.40) / (H * 0.42)) ** 2))
    a = base[None, None, :] + glow[..., None] * np.array((34, 27, 16), np.float32)
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    im = _grain(im, 2.6)
    d = ImageDraw.Draw(im)
    GOLD = (212, 174, 100); CREAM = (238, 230, 214); FAINT = (150, 132, 100)
    # size arabic to fit
    for s in (150, 136, 122, 108):
        f_ar = ImageFont.truetype(AMIRI, s)
        bb = d.textbbox((0, 0), v["ar"], font=f_ar)
        if bb[2] - bb[0] <= W - 160:
            break
    arh = _ar_center(d, v["ar"], f_ar, GOLD, 430)
    y = 430 + arh + 96
    d.line([(W / 2 - 40, y), (W / 2 + 40, y)], fill=(120, 100, 66), width=2); y += 74
    f_en = ImageFont.truetype(PLAY_IT, 54)
    for t in v["en_lines"]:
        _ctext(d, t, f_en, CREAM, y); y += 78
    y += 40
    _ctext(d, v["cite"], ImageFont.truetype(SANS, 24), FAINT, y, 8)
    _brand(d, True)
    im.save(out, quality=94); return out


# ---- B: TYPE POSTER ---------------------------------------------------------
def style_b(v, out):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    a = np.full((H, W, 3), (241, 235, 224), np.float32)
    a *= (1 - 0.05 * (((xx - .5 * W) / W) ** 2 + ((yy - .5 * H) / H) ** 2))[..., None]
    im = _grain(Image.fromarray(np.clip(a, 0, 255).astype("uint8")), 2.4)
    d = ImageDraw.Draw(im)
    INK = (44, 42, 38); GOLD = (170, 132, 62); SOFT = (128, 118, 102)
    # giant ghost quotation mark
    fq = ImageFont.truetype(PLAY, 560)
    d.text((60, -120), "“", font=fq, fill=(226, 216, 198))
    # small arabic up top
    f_ar = ImageFont.truetype(AMIRI, 66)
    _ar_center(d, v["ar"], f_ar, GOLD, 300)
    # HUGE english, accent word in gold italic
    y = 520
    f_big = ImageFont.truetype(PLAY, 108)
    f_big_it = ImageFont.truetype(PLAY_IT, 108)
    for t in v["en_lines"]:
        acc = v.get("accent_word")
        if acc and t.endswith(acc):
            head = t[: -len(acc)].rstrip()
            wh = d.textlength(head + " ", font=f_big); wa = d.textlength(acc, font=f_big_it)
            x = (W - wh - wa) / 2
            d.text((x, y), head + " ", font=f_big, fill=INK)
            d.text((x + wh, y), acc, font=f_big_it, fill=GOLD)
        else:
            _ctext(d, t, f_big, INK, y)
        y += 140
    y += 60
    d.line([(W / 2 - 46, y), (W / 2 + 46, y)], fill=GOLD, width=3); y += 56
    _ctext(d, v["cite"], ImageFont.truetype(SANS, 25), SOFT, y, 8)
    _brand(d, False)
    im.save(out, quality=94); return out


# ---- C: NEAR (statement minimal) -------------------------------------------
def style_c(v, out):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.array((30, 44, 36), np.float32)   # deep forest
    vig = 1 - 0.35 * (((xx - .5 * W) / W) ** 2 + ((yy - .45 * H) / H) ** 2)
    a = base[None, None, :] * (vig[..., None] + 0.62)
    im = _grain(Image.fromarray(np.clip(a, 0, 255).astype("uint8")), 2.8, seed=11)
    d = ImageDraw.Draw(im)
    GOLD = (214, 178, 106); CREAM = (236, 229, 214); FAINT = (150, 150, 128)
    f_ar = ImageFont.truetype(AMIRI, 210)
    bb = d.textbbox((0, 0), v["ar"], font=f_ar)
    if bb[2] - bb[0] > W - 140:
        f_ar = ImageFont.truetype(AMIRI, 170)
        bb = d.textbbox((0, 0), v["ar"], font=f_ar)
    arh = _ar_center(d, v["ar"], f_ar, GOLD, 500)
    y = 500 + arh + 110
    _ctext(d, v["en_lines"][0], ImageFont.truetype(PLAY_IT, 58), CREAM, y)
    y += 108
    _ctext(d, v["cite"], ImageFont.truetype(SANS, 24), FAINT, y, 8)
    _brand(d, True)
    im.save(out, quality=94); return out


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/quote_styles"
    os.makedirs(out, exist_ok=True)
    style_a(V_HEARTS, os.path.join(out, "A_midnight_hearts.jpg"))
    style_b(V_EASE, os.path.join(out, "B_typeposter_ease.jpg"))
    style_c(V_NEAR, os.path.join(out, "C_near.jpg"))
    print("styles rendered:", out)
