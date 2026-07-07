#!/usr/bin/env python3
# Friday dua PHONE WALLPAPER (9:16, 1080x1920). Same paper/ink/gold brand as the
# Living Dictionary, but formatted as a lock screen: top third kept calm for the
# clock, the dua sits in the lower-middle, verified source on the card. Content
# from etsy/deck_data.py (Qur'an/graded-hadith, verified upstream). Short du'as
# only — a wallpaper must breathe. Zoom-QC the Arabic before publishing.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont

D = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(os.path.dirname(D), "worker", "fonts")
AMIRI = os.path.join(F, "Amiri-Bold.ttf")
PLAY = os.path.join(F, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(F, "PlayfairDisplay-Italic.ttf")
ITAL = os.path.join(F, "Cormorant-Italic.ttf")
SANS = os.path.join(F, "DejaVuSans.ttf")
W, H = 1080, 1920
PAPER = (243, 238, 228)
INK = (42, 39, 34)
SOFT = (120, 112, 100)
GOLD = (170, 134, 66)
GREEN = (58, 74, 62)          # deep pine accent, from the brand
M = 110

_MEAS = ImageDraw.Draw(Image.new("RGB", (4, 4)))


def paper():
    a = np.full((H, W, 3), PAPER, np.float32)
    a += np.random.default_rng(7).normal(0, 3.0, (H, W, 1))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = 1 - 0.05 * (((xx - .5 * W) / W) ** 2 + ((yy - .55 * H) / H) ** 2)
    a *= v[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def _wrap(text, font, maxw):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if _MEAS.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur:
                out.append(cur)
            cur = w
    if cur:
        out.append(cur)
    return out or [""]


def _fit(text, path, sizes, maxw, max_lines):
    for s in sizes:
        f = ImageFont.truetype(path, s)
        ln = _wrap(text, f, maxw)
        if len(ln) <= max_lines:
            return f, ln
    f = ImageFont.truetype(path, sizes[-1])
    return f, _wrap(text, f, maxw)


def _center(d, lines, font, fill, y, gap):
    for t in lines:
        d.text(((W - d.textlength(t, font=font)) / 2, y), t, font=font, fill=fill); y += gap
    return y


def _tracked(d, text, font, fill, y, ls):
    w = sum(d.textlength(c, font=font) + ls for c in text) - ls
    x = (W - w) / 2
    for c in text:
        d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + ls


def wallpaper(entry, out, theme="ivory"):
    im = paper(); d = ImageDraw.Draw(im)

    # ---- fit every element first, then lay the whole stack out with measured
    #      gaps and vertically centre it, so nothing hugs and nothing floats ----
    f_ar, ar = _fit(entry["arabic"], AMIRI, [104, 92, 82, 74, 66, 60], W - 2 * M, 3)
    f_tr, tr = _fit(entry["translit"], ITAL, [50, 46, 42, 38], W - 2 * M - 20, 4)
    f_tn, tn = _fit(entry["translation"], PLAY, [42, 39, 36, 33, 30], W - 2 * M - 10, 5)
    f_src, src = _fit(entry["source"], PLAY, [27, 25, 23], W - 2 * M - 20, 3)
    f_k = ImageFont.truetype(SANS, 24)

    ar_lh = f_ar.size + 40      # Arabic needs room for harakat
    tr_lh = f_tr.size + 16
    tn_lh = f_tn.size + 18
    src_lh = f_src.size + 10

    # section blocks: (height, gap_before)
    KICK_H = 30
    RULE1_GAP = 24
    AR_GAP = 96                 # kicker rule -> Arabic
    TR_GAP = 66                 # Arabic -> translit  (was too tight)
    TN_GAP = 52                 # translit -> translation
    RULE2_GAP = 50              # translation -> rule
    SRC_GAP = 40                # rule -> source

    ar_h = ar_lh * len(ar)
    tr_h = tr_lh * len(tr)
    tn_h = tn_lh * len(tn)
    src_h = src_lh * len(src)
    total = (KICK_H + RULE1_GAP + AR_GAP + ar_h + TR_GAP + tr_h +
             TN_GAP + tn_h + RULE2_GAP + SRC_GAP + src_h)

    # centre the stack a touch below the middle; top stays calm for the clock
    y = H * 0.52 - total / 2

    _tracked(d, "A DU'A FOR YOUR WEEK", f_k, GOLD, y, 6); y += KICK_H
    y += RULE1_GAP
    d.line([(W / 2 - 40, y), (W / 2 + 40, y)], fill=GOLD, width=2)
    y += AR_GAP
    for t in ar:
        d.text(((W - d.textlength(t, font=f_ar)) / 2, y), t, font=f_ar, fill=GREEN); y += ar_lh
    y += TR_GAP
    for t in tr:
        d.text(((W - d.textlength(t, font=f_tr)) / 2, y), t, font=f_tr, fill=SOFT); y += tr_lh
    y += TN_GAP
    for t in tn:
        d.text(((W - d.textlength(t, font=f_tn)) / 2, y), t, font=f_tn, fill=INK); y += tn_lh
    y += RULE2_GAP
    d.line([(W / 2 - 34, y), (W / 2 + 34, y)], fill=GOLD, width=2)
    y += SRC_GAP
    for t in src:
        d.text(((W - d.textlength(t, font=f_src)) / 2, y), t, font=f_src, fill=SOFT); y += src_lh

    # brand mark pinned at the bottom (clear of the home-bar)
    _tracked(d, "K E T A B I   S T U D I O", ImageFont.truetype(SANS, 24), GOLD, 1748, 4)
    site = ImageFont.truetype(SANS, 20)
    d.text(((W - d.textlength("ketabistudio.com", font=site)) / 2, 1790), "ketabistudio.com", font=site, fill=SOFT)

    im.save(out, quality=95)
    return out


def _deck():
    sys.path.insert(0, os.path.join(D, "etsy"))
    from deck_data import DECK1
    try:
        from deck_data import DECK2
    except Exception:
        DECK2 = []
    return DECK1 + DECK2


if __name__ == "__main__":
    deck = _deck()
    # default: the "O Turner of hearts" du'a — short, beloved, perfect wallpaper
    pick = next((e for e in deck if "muqallib" in e["translit"].lower()), deck[0])
    out = os.path.join(D, "_dua_wallpaper_sample.jpg")
    wallpaper(pick, out)
    print("rendered", out, "->", pick["translit"][:40])
