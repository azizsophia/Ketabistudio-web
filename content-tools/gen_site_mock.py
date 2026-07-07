#!/usr/bin/env python3
# Homepage mockup in the "Living Dictionary" identity: ink on paper, type-led,
# root-tree motif, oxblood accent. A concrete alternative to the beige-gold-
# Playfair trend. 1080x2160 (mobile homepage). Not a photo-quote look.
import os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(os.path.dirname(D), "worker", "fonts")
AMIRI = os.path.join(F, "Amiri-Bold.ttf")
LORA = os.path.join(F, "Lora.ttf")
SANS = os.path.join(F, "DejaVuSans.ttf")
W, H = 1080, 2160
PAPER = (243, 238, 228)
INK = (33, 30, 27)
FAINT = (120, 112, 100)
ACCENT = (138, 58, 44)
M = 90


def canvas(h=H):
    a = np.full((h, W, 3), PAPER, np.float32)
    a += np.random.default_rng(4).normal(0, 3.0, (h, W, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def sp(d, t, f, fill, cx, y, ls, anchor="c"):
    w = sum(d.textlength(c, font=f) + ls for c in t) - ls
    x = cx - w / 2 if anchor == "c" else (cx if anchor == "l" else cx - w)
    for c in t:
        d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls
    return w


def center(d, t, f, fill, y):
    w = d.textlength(t, font=f)
    d.text(((W - w) / 2, y), t, font=f, fill=fill)


def button(d, label, cy, fill=INK, text=PAPER):
    f = ImageFont.truetype(SANS, 24)
    w = sum(d.textlength(c, font=f) + 3 for c in label.upper()) - 3
    bw, bh = int(w + 90), 78
    x0 = (W - bw) // 2
    d.rectangle([x0, cy, x0 + bw, cy + bh], fill=fill)
    sp(d, label.upper(), f, text, W / 2, cy + 24, 3)
    return cy + bh


def rootlet(d, cx, cy, letters, s=64, branch=True):
    fa = ImageFont.truetype(AMIRI, s)
    al = letters.split()
    gap = int(s * 0.95)
    xs = [cx + gap * (k - (len(al) - 1) / 2) for k in range(len(al))]
    bot = cy
    for k, a in enumerate(al):
        x = xs[len(al) - 1 - k]
        w = d.textlength(a, font=fa)
        d.text((x - w / 2, cy), a, font=fa, fill=INK)
        bb = d.textbbox((x - w / 2, cy), a, font=fa)
        bot = max(bot, bb[3])
    if branch:
        ty = bot + 16
        d.line([(cx, ty), (cx, ty + 18)], fill=ACCENT, width=2)
        d.line([(xs[0], ty + 18), (xs[-1], ty + 18)], fill=ACCENT, width=2)
        for x in xs:
            d.line([(x, ty + 18), (x, ty + 34)], fill=ACCENT, width=2)
    return bot


im = canvas()
d = ImageDraw.Draw(im)

# ── nav
sp(d, "KETABI STUDIO", ImageFont.truetype(SANS, 26), INK, W / 2, 70, 8)
d.line([(M, 130), (W - M, 130)], fill=INK, width=2)
sp(d, "THE DICTIONARY      SHOP      JOURNAL      ABOUT",
   ImageFont.truetype(SANS, 17), FAINT, W / 2, 152, 2)

# ── hero
center(d, "Every word", ImageFont.truetype(LORA, 92), INK, 300)
center(d, "has a root.", ImageFont.truetype(LORA, 92), INK, 405)
sub = ImageFont.truetype(LORA, 34)
for i, line in enumerate([
    "We trace the words of the Qur'an back to where",
    "they begin. Verified against the classical",
    "dictionaries. Every source cited. Yours to keep."]):
    center(d, line, sub, (70, 64, 56), 560 + i * 50)
rootlet(d, W / 2, 760, "ر ح م", s=76)
by = button(d, "Explore the dictionary", 900)

# ── featured: the journal, as a dictionary entry
d.line([(M, 1080), (W - M, 1080)], fill=(210, 202, 190), width=2)
sp(d, "THE JOURNAL", ImageFont.truetype(SANS, 20), ACCENT, W / 2, 1120, 6)
center(d, "From One Root", ImageFont.truetype(LORA, 60), INK, 1170)
fj = ImageFont.truetype(LORA, 30)
for i, line in enumerate([
    "Thirty days. One Arabic root a day, traced to its",
    "source, with room to write. A quiet study of the",
    "language your prayers are already made of."]):
    center(d, line, fj, (70, 64, 56), 1260 + i * 44)
# a small tree row (three roots)
rootlet(d, W / 2 - 300, 1430, "ص ب ر", s=52)
rootlet(d, W / 2, 1430, "ن و ر", s=52)
rootlet(d, W / 2 + 300, 1430, "ش ك ر", s=52)
sp(d, "·  30 ROOTS  ·  EVERY SOURCE CITED  ·  PRINTABLE  ·",
   ImageFont.truetype(SANS, 18), FAINT, W / 2, 1560, 2)
button(d, "Shop the journal  —  $19", 1620)

# ── the idea strip
d.line([(M, 1820), (W - M, 1820)], fill=(210, 202, 190), width=2)
sp(d, "WHY IT IS DIFFERENT", ImageFont.truetype(SANS, 20), ACCENT, W / 2, 1860, 6)
fi = ImageFont.truetype(LORA, 31)
for i, line in enumerate([
    "Not another quote on a pretty background.",
    "A reference you will keep, sourced like scholarship,",
    "made to be read slowly and returned to."]):
    center(d, line, fi, INK, 1915 + i * 46)

# ── footer
d.line([(M, 2075), (W - M, 2075)], fill=INK, width=2)
sp(d, "KETABISTUDIO.COM", ImageFont.truetype(SANS, 18), FAINT, M, 2100, 2, "l")
sp(d, "@KETABISTUDIO", ImageFont.truetype(SANS, 18), FAINT, W - M, 2100, 2, "r")

out = os.path.join(D, "_dict", "site_home.jpg")
os.makedirs(os.path.dirname(out), exist_ok=True)
im.save(out, quality=94)
print("wrote", out)
