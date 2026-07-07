#!/usr/bin/env python3
# "Living dictionary" direction: type-led, ink on paper, no mood photo. The
# signature device is the ROOT TREE (the 3 letters branching into the words they
# grow into). Reads like a reference book / museum label, not an AI quote card.
# 1080x1350. Deliberately NOT the beige-gold-serif-on-a-photo formula.
import os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(os.path.dirname(D), "worker", "fonts")
AMIRI = os.path.join(F, "Amiri-Bold.ttf")
LORA = os.path.join(F, "Lora.ttf")
SANS = os.path.join(F, "DejaVuSans.ttf")
W, H = 1080, 1350
PAPER = (243, 238, 228)
INK = (33, 30, 27)
FAINT = (120, 112, 100)
ACCENT = (138, 58, 44)   # oxblood — scholarly press, not trend-gold


def paper():
    a = np.full((H, W, 3), PAPER, np.float32)
    a += np.random.default_rng(4).normal(0, 3.2, (H, W, 1))   # fine paper grain
    # faint warm unevenness, like real stock
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = 1 - 0.04 * (((xx - .5 * W) / W) ** 2 + ((yy - .4 * H) / H) ** 2)
    a *= v[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def _sp(d, text, font, fill, cx, y, ls, anchor="c"):
    w = sum(d.textlength(c, font=font) + ls for c in text) - ls
    x = cx - w / 2 if anchor == "c" else (cx if anchor == "l" else cx - w)
    for c in text:
        d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + ls
    return w


def card(letters, translit, defs, branches, line, cite, num, out):
    """letters: 'ر ح م'; translit: 'r · h · m'; defs: ['mercy','the womb'];
    branches: [(translit, gloss), ...]; line: one editorial sentence; cite: str."""
    im = paper(); d = ImageDraw.Draw(im)
    M = 96
    # header row
    f_lab = ImageFont.truetype(SANS, 20)
    _sp(d, "KETABI  ·  A LIVING DICTIONARY", f_lab, FAINT, M, 84, 4, "l")
    _sp(d, f"N.º {num:02d}", f_lab, FAINT, W - M, 84, 4, "r")
    d.line([(M, 128), (W - M, 128)], fill=INK, width=2)

    # the root, large and structural. Draw each letter at a fixed centre so its
    # transliteration lines up exactly beneath it. Arabic is RTL, so the first
    # root letter sits at the RIGHTMOST centre.
    f_root = ImageFont.truetype(AMIRI, 190)
    f_tr = ImageFont.truetype(SANS, 30)
    ry = 300
    al = letters.split()                              # ['ر','ح','م'] root order
    tl = [t.strip() for t in translit.split("·")]     # ['r','h','m']
    nL = len(al)
    gap = 178
    xs = [W / 2 + gap * (k - (nL - 1) / 2) for k in range(nL)]  # left->right
    maxbot = ry
    letters_x = []
    for k in range(nL):
        x = xs[nL - 1 - k]                            # RTL: root[k] -> right side
        w = d.textlength(al[k], font=f_root)
        d.text((x - w / 2, ry), al[k], font=f_root, fill=INK)
        bb = d.textbbox((x - w / 2, ry), al[k], font=f_root)
        maxbot = max(maxbot, bb[3])
        letters_x.append(x)
    # transliteration, aligned under each letter, clear of the glyph bodies
    tr_y = maxbot + 26
    for k in range(nL):
        if k < len(tl):
            _sp(d, tl[k].upper(), f_tr, ACCENT, xs[nL - 1 - k], tr_y, 4)

    # definitions, numbered like a dictionary entry
    f_def = ImageFont.truetype(LORA, 40)
    dy = tr_y + 66
    for i, dfn in enumerate(defs, 1):
        _sp(d, f"{i}.  {dfn}", f_def, INK, W / 2, dy, 0)
        dy += 56

    # ROOT TREE — the signature device (only when we have VERIFIED branches)
    if branches:
        tree_top = dy + 40
        d.line([(W / 2, tree_top), (W / 2, tree_top + 34)], fill=ACCENT, width=2)
        n = len(branches)
        span = 720
        xs = [int(W / 2 - span / 2 + span * (k + 0.5) / n) for k in range(n)]
        d.line([(xs[0], tree_top + 34), (xs[-1], tree_top + 34)], fill=ACCENT, width=2)
        f_br = ImageFont.truetype(LORA, 34)
        f_brg = ImageFont.truetype(SANS, 19)
        for x, (bt, bg) in zip(xs, branches):
            d.line([(x, tree_top + 34), (x, tree_top + 68)], fill=ACCENT, width=2)
            _sp(d, bt, f_br, INK, x, tree_top + 80, 0)
            _sp(d, bg.upper(), f_brg, FAINT, x, tree_top + 128, 3)
        line_anchor = tree_top + 230
    else:
        # no tree yet: a small centred rule, then the sentence
        d.line([(W / 2 - 46, dy + 40), (W / 2 + 46, dy + 40)], fill=ACCENT, width=3)
        line_anchor = dy + 100

    # editorial sentence
    f_line = ImageFont.truetype(os.path.join(F, "Lora.ttf"), 33)
    words, ln, cur = line.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f_line) <= W - 2 * M - 60:
            cur = t
        else:
            ln.append(cur); cur = w
    if cur:
        ln.append(cur)
    ly = line_anchor
    for t in ln:
        w = d.textlength(t, font=f_line)
        d.text(((W - w) / 2, ly), t, font=f_line, fill=INK); ly += 46

    # footer: citation like a scholarly source line
    d.line([(M, H - 150), (W - M, H - 150)], fill=INK, width=2)
    f_cite = ImageFont.truetype(SANS, 20)
    _sp(d, cite, f_cite, FAINT, M, H - 128, 2, "l")
    _sp(d, "KETABISTUDIO.COM", f_cite, FAINT, W - M, H - 128, 2, "r")
    im.save(out, quality=95)
    return out


AR_TR = {"ء": "'", "أ": "'", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h",
         "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
         "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "'", "غ": "gh", "ف": "f",
         "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y"}


def _defs(gloss):
    parts = [p.strip().lstrip("and ").strip() for p in gloss.split("·")]
    return [p for p in parts if p][:2]


def build_all(outdir):
    import sys
    sys.path.insert(0, os.path.join(D, "etsy"))
    from journal_data import DAYS
    made = []
    for i, day in enumerate(DAYS, 1):
        letters = day["letters"]
        tr = " · ".join(AR_TR.get(c, c) for c in letters.split())
        line = day["story"].split(". ")[0].rstrip(".") + "."
        cite = day["citation"].split("·")[0].strip() + "  ·  classical dictionaries of Arabic"
        key = day["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0]
        out = os.path.join(outdir, f"day_{i:02d}_{key}.jpg")
        card(letters, tr, _defs(day["gloss"]), [], line, cite, i, out)  # [] = no tree yet
        made.append((i, key, out))
    return made


if __name__ == "__main__":
    outdir = os.path.join(D, "_dict_daily")
    os.makedirs(outdir, exist_ok=True)
    m = build_all(outdir)
    print("wrote", len(m), "daily dictionary cards ->", outdir)
