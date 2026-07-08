#!/usr/bin/env python3
# "One word from the Qur'an" phone wallpapers (9:16) from the journal's verified
# roots. Saveable, on-brand, each a preview of a From One Root page. Adaptive
# line block so long editorial lines still fit. Content: journal_data (letters,
# gloss) + gen_dictionary_card.CONTENT (the verified shareable line).
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import gen_dictionary_card as G
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "etsy"))
from journal_data import DAYS

D = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(os.path.dirname(D), "worker", "fonts")
AMIRI = os.path.join(FF, "Amiri-Bold.ttf"); PLAY = os.path.join(FF, "PlayfairDisplay.ttf")
ITAL = os.path.join(FF, "Cormorant-Italic.ttf"); SANS = os.path.join(FF, "DejaVuSans.ttf")
W, H = 1080, 1920
PAPER = (243, 238, 228); INK = (42, 39, 34); SOFT = (120, 112, 100)
GOLD = (170, 134, 66); GREEN = (58, 74, 62)

BYKEY = {}
for dd in DAYS:
    k = dd["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0]
    BYKEY[k] = dd


def _paper():
    a = np.full((H, W, 3), PAPER, np.float32) + np.random.default_rng(7).normal(0, 3, (H, W, 1))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    a *= (1 - 0.05 * (((xx - .5 * W) / W) ** 2 + ((yy - .55 * H) / H) ** 2))[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def _ctext(d, t, f, fill, y, ls=0):
    w = sum(d.textlength(c, font=f) + ls for c in t) - ls
    x = (W - w) / 2
    for c in t:
        d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls


def _wrap(d, t, f, mw):
    out, cur = [], ""
    for w in t.split():
        if d.textlength((cur + " " + w).strip(), font=f) <= mw:
            cur = (cur + " " + w).strip()
        else:
            out.append(cur); cur = w
    out.append(cur)
    return out


def wallpaper(key, out):
    day = BYKEY[key]; line = G.CONTENT[key][1]
    im = _paper(); d = ImageDraw.Draw(im)
    _ctext(d, "ONE WORD FROM THE QUR'AN", ImageFont.truetype(SANS, 24), GOLD, 440, 6)
    d.line([(W / 2 - 40, 490), (W / 2 + 40, 490)], fill=GOLD, width=2)
    f_ar = ImageFont.truetype(AMIRI, 168)
    bb = d.textbbox((0, 0), day["letters"], font=f_ar); arh = bb[3] - bb[1]
    ary = 600
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], ary - bb[1]), day["letters"], font=f_ar, fill=GREEN)
    y = ary + arh + 70
    _ctext(d, key.upper(), ImageFont.truetype(PLAY, 60), INK, y, 6); y += 108
    _ctext(d, day["gloss"], ImageFont.truetype(ITAL, 50), SOFT, y); y += 120
    # adaptive editorial line: shrink to fit between here and the footer
    top, bot = y, H - 300
    chosen = None
    for s in (60, 56, 52, 48, 44):
        f = ImageFont.truetype(ITAL, s); ln = _wrap(d, line, f, W - 190)
        gap = int(s * 1.24); hgt = gap * len(ln)
        if top + hgt <= bot:
            chosen = (f, ln, gap, hgt); break
    if chosen is None:
        f = ImageFont.truetype(ITAL, 44); ln = _wrap(d, line, f, W - 190); gap = 55; hgt = gap * len(ln)
        chosen = (f, ln, gap, hgt)
    f, ln, gap, hgt = chosen
    cy = (top + bot) / 2 - hgt / 2
    for t in ln:
        _ctext(d, t, f, INK, cy); cy += gap
    d.line([(W / 2 - 46, cy + 26), (W / 2 + 46, cy + 26)], fill=GOLD, width=3)
    _ctext(d, "K E T A B I   S T U D I O", ImageFont.truetype(SANS, 24), GOLD, 1720, 4)
    _ctext(d, "ketabistudio.com", ImageFont.truetype(SANS, 20), SOFT, 1760)
    im.save(out, quality=94); return out


if __name__ == "__main__":
    keys = sys.argv[1:] or ["sabr", "tawakkul", "yusr", "shukr", "sakinah", "fitra", "rizq", "barakah"]
    outdir = os.path.join(D, "_word_wallpapers"); os.makedirs(outdir, exist_ok=True)
    for k in keys:
        wallpaper(k, os.path.join(outdir, f"wp_{k}.jpg")); print("rendered", k)
