#!/usr/bin/env python3
# Instagram/Facebook carousel in the Living Dictionary style (matches the Threads
# cards). 4 slides per root: hook, meaning, the shareable line, CTA. 1080x1350.
# Reuses gen_dictionary_card for palette/fonts/helpers so the brand is identical.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_dictionary_card as G
from PIL import Image, ImageDraw, ImageFont
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1350
F = G.F
PAPER, INK, ACCENT, FAINT = G.PAPER, G.INK, G.ACCENT, G.FAINT


def _canvas():
    a = np.full((H, W, 3), PAPER, np.float32) + np.random.default_rng(4).normal(0, 3, (H, W, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def _header(d, num):
    G._sp(d, "KETABI  ·  A LIVING DICTIONARY", ImageFont.truetype(F + "/DejaVuSans.ttf", 20), FAINT, 96, 74, 4, "l")
    G._sp(d, f"N.º {num:02d}", ImageFont.truetype(F + "/DejaVuSans.ttf", 20), FAINT, W - 96, 74, 4, "r")
    d.line([(96, 116), (W - 96, 116)], fill=INK, width=2)


def _footer_tag(d):
    f = ImageFont.truetype(F + "/Cormorant-Italic.ttf", 38)
    t = "the language of the Qur'an, one root at a time"
    d.text(((W - d.textlength(t, font=f)) / 2, H - 110), t, font=f, fill=(96, 90, 80))


def slide_hook(letters, word, tl, num):
    im = _canvas(); d = ImageDraw.Draw(im); _header(d, num)
    f_root = ImageFont.truetype(G.AMIRI, 210)
    al = letters.split(); nL = len(al); gap = 190
    xs = [W / 2 + gap * (k - (nL - 1) / 2) for k in range(nL)]
    ry = 430; maxbot = ry
    for k in range(nL):
        x = xs[nL - 1 - k]; w = d.textlength(al[k], font=f_root)
        d.text((x - w / 2, ry), al[k], font=f_root, fill=INK)
        maxbot = max(maxbot, d.textbbox((x - w / 2, ry), al[k], font=f_root)[3])
    f_tr = ImageFont.truetype(F + "/DejaVuSans.ttf", 38); f_mark = ImageFont.truetype(F + "/DejaVuSans.ttf", 52)
    for k in range(nL):
        ch = tl[k].upper()
        if ch == "'":
            G._sp(d, "’", f_mark, ACCENT, xs[nL - 1 - k], maxbot + 16, 0)
        else:
            G._sp(d, ch, f_tr, ACCENT, xs[nL - 1 - k], maxbot + 28, 4)
    G._sp(d, word.upper(), ImageFont.truetype(F + "/Lora.ttf", 44), INK, W / 2, maxbot + 110, 4)
    G._sp(d, "SWIPE  →", ImageFont.truetype(F + "/DejaVuSans.ttf", 22), FAINT, W / 2, H - 170, 6)
    _footer_tag(d); return im


def _center_block(d, im, lines, font, fill, cy, gap):
    y = cy - gap * (len(lines) - 1) / 2
    for t in lines:
        d.text(((W - d.textlength(t, font=font)) / 2, y), t, font=font, fill=fill); y += gap


def _wrap(d, text, font, maxw):
    words, ln, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw:
            cur = t
        else:
            ln.append(cur); cur = w
    if cur:
        ln.append(cur)
    return ln


def slide_meaning(defs, num):
    im = _canvas(); d = ImageDraw.Draw(im); _header(d, num)
    G._sp(d, "MEANING", ImageFont.truetype(F + "/DejaVuSans.ttf", 22), ACCENT, W / 2, 300, 8)
    f = ImageFont.truetype(F + "/Lora.ttf", 58)
    _center_block(d, im, [f"{i}.  {x}" for i, x in enumerate(defs, 1)], f, INK, H * 0.46, 82)
    _footer_tag(d); return im


def slide_line(line, cite, num):
    im = _canvas(); d = ImageDraw.Draw(im); _header(d, num)
    f = ImageFont.truetype(F + "/Cormorant-Italic.ttf", 66)
    ln = _wrap(d, line, f, W - 200)
    _center_block(d, im, ln, f, INK, H * 0.44, 84)
    G._sp(d, cite, ImageFont.truetype(F + "/DejaVuSans.ttf", 22), FAINT, W / 2, H * 0.44 + 84 * len(ln) / 2 + 90, 3)
    _footer_tag(d); return im


def slide_cta(num):
    im = _canvas(); d = ImageDraw.Draw(im); _header(d, num)
    G._sp(d, "FROM ONE ROOT", ImageFont.truetype(F + "/Lora.ttf", 56), INK, W / 2, 470, 6)
    f = ImageFont.truetype(F + "/Cormorant-Italic.ttf", 46)
    _center_block(d, im, ["one Arabic root, every day,", "traced back to where it begins."], f, (80, 74, 66), 640, 66)
    d.line([(W / 2 - 46, 800), (W / 2 + 46, 800)], fill=ACCENT, width=3)
    G._sp(d, "FOLLOW  @KETABISTUDIO", ImageFont.truetype(F + "/DejaVuSans.ttf", 26), INK, W / 2, 860, 4)
    G._sp(d, "KETABISTUDIO.COM", ImageFont.truetype(F + "/DejaVuSans.ttf", 22), FAINT, W / 2, 920, 4)
    _footer_tag(d); return im


def carousel(key, num, outdir):
    day = _lookup(key)
    letters = day["letters"]; defs, line = G.CONTENT[key]
    tl = [G.AR_TR.get(c, c) for c in letters.split()]
    cite = day["citation"].split("·")[0].strip()
    slides = [slide_hook(letters, key, tl, num), slide_meaning(defs, num),
              slide_line(line, cite, num), slide_cta(num)]
    paths = []
    for i, s in enumerate(slides, 1):
        p = os.path.join(outdir, f"car_{key}_{i}.jpg"); s.save(p, quality=93); paths.append(p)
    return paths


def _lookup(key):
    sys.path.insert(0, os.path.join(D, "etsy")); from journal_data import DAYS
    for dd in DAYS:
        k = dd["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0]
        if k == key:
            return dd
    raise KeyError(key)


if __name__ == "__main__":
    outdir = os.path.join(D, "_carousels"); os.makedirs(outdir, exist_ok=True)
    key = sys.argv[1] if len(sys.argv) > 1 else "sabr"
    num = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    ps = carousel(key, num, outdir)
    print("wrote carousel", key, "->", len(ps), "slides")
