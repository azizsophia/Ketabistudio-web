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

    f_k = ImageFont.truetype(SANS, 24)
    f_ar = ImageFont.truetype(AMIRI, 168)
    f_tr = ImageFont.truetype(PLAY, 60)
    f_gl = ImageFont.truetype(ITAL, 50)
    bb = d.textbbox((0, 0), day["letters"], font=f_ar); arh = bb[3] - bb[1]

    # Vertical rhythm between blocks. We measure the full stack, then center it
    # in the writable band so top and bottom margins are equal, no dead space.
    FOOT_TOP = 1690           # brand block lives below this
    TOP, BOT = 250, FOOT_TOP - 70
    f_ln, ln, lgap = None, None, 0
    KICK_H, RULE1_G = 24, 24 + 30            # kicker text, then gap to top rule
    ARAB_G = 118                             # rule -> arabic
    TR_G = 84                                # arabic -> translit
    GL_G = 58                                # translit -> gloss
    LINE_G = 104                            # gloss -> first editorial line
    for s in (60, 56, 52, 48, 44):
        f = ImageFont.truetype(ITAL, s); w = _wrap(d, line, f, W - 190); g = int(s * 1.26)
        stack = (KICK_H + RULE1_G + ARAB_G + arh + TR_G + 60 + GL_G + 50
                 + LINE_G + g * len(w))
        if stack <= BOT - TOP:
            f_ln, ln, lgap = f, w, g; break
    else:
        f_ln = ImageFont.truetype(ITAL, 44); ln = _wrap(d, line, f_ln, W - 190); lgap = 56

    stack_h = (KICK_H + RULE1_G + ARAB_G + arh + TR_G + 60 + GL_G + 50
               + LINE_G + lgap * len(ln))
    y = TOP + max(0, (BOT - TOP - stack_h) / 2)

    _ctext(d, "ONE WORD FROM THE QUR'AN", f_k, GOLD, y, 6); y += RULE1_G
    d.line([(W / 2 - 40, y), (W / 2 + 40, y)], fill=GOLD, width=2); y += ARAB_G
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1]), day["letters"], font=f_ar, fill=GREEN)
    y += arh + TR_G
    _ctext(d, key.upper(), f_tr, INK, y, 6); y += 60 + GL_G
    _ctext(d, day["gloss"], f_gl, SOFT, y); y += 50 + LINE_G
    for t in ln:
        _ctext(d, t, f_ln, INK, y); y += lgap
    d.line([(W / 2 - 46, y + 26), (W / 2 + 46, y + 26)], fill=GOLD, width=3)

    _ctext(d, "K E T A B I   S T U D I O", ImageFont.truetype(SANS, 24), GOLD, 1740, 4)
    _ctext(d, "ketabistudio.com", ImageFont.truetype(SANS, 20), SOFT, 1780)
    im.save(out, quality=94); return out


if __name__ == "__main__":
    keys = sys.argv[1:] or ["sabr", "tawakkul", "yusr", "shukr", "sakinah", "fitra", "rizq", "barakah"]
    outdir = os.path.join(D, "_word_wallpapers"); os.makedirs(outdir, exist_ok=True)
    for k in keys:
        wallpaper(k, os.path.join(outdir, f"wp_{k}.jpg")); print("rendered", k)
