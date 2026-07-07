#!/usr/bin/env python3
# Full-brand homepage mockup in a refined, non-AI identity. Warm paper, deep
# pine, a TERRACOTTA accent instead of trend-gold; editorial serif; real product
# photos (not gradients). Shows the whole catalog: books, keepsakes, cards, the
# journal, the app. 1280 wide desktop homepage.
import os
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(os.path.dirname(D), "worker", "fonts")
SP = "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad"
IMG = os.path.join(os.path.dirname(D), "public", "images")
LORA = os.path.join(F, "Lora.ttf")
LORA_I = os.path.join(F, "Cormorant-Italic.ttf")
SANS = os.path.join(F, "DejaVuSans.ttf")
AMIRI = os.path.join(F, "Amiri-Bold.ttf")

W = 1280
PAPER = (240, 234, 223)
PINE = (34, 52, 41)
INK = (40, 44, 40)
FAINT = (122, 120, 108)
TERRA = (176, 92, 60)     # terracotta accent — warm, distinct from trend-gold
CARDBG = (247, 243, 234)


def load(path, w, h):
    im = Image.open(path).convert("RGB")
    return ImageOps.fit(im, (w, h), Image.LANCZOS)


def sp(d, t, f, fill, cx, y, ls, anchor="c"):
    w = sum(d.textlength(c, font=f) + ls for c in t) - ls
    x = cx - w / 2 if anchor == "c" else (cx if anchor == "l" else cx - w)
    for c in t:
        d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls
    return w


# ── measure total height, then draw
H = 2340
im = Image.new("RGB", (W, H), PAPER)
a = np.asarray(im).astype(np.float32) + np.random.default_rng(4).normal(0, 2.4, (H, W, 1))
im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
d = ImageDraw.Draw(im)
MX = 96

# ── top bar (pine)
d.rectangle([0, 0, W, 92], fill=PINE)
sp(d, "KETABI STUDIO", ImageFont.truetype(SANS, 24), PAPER, MX + 90, 32, 6, "c")
sp(d, "BOOKS    KEEPSAKES    CARDS    THE JOURNAL    THE APP",
   ImageFont.truetype(SANS, 17), (214, 224, 214), W - MX, 36, 2, "r")

# ── hero: editorial split (text column kept left of the image, no overlap)
hy = 150
COLW = 560   # hero text never crosses this, so it can't run under the image
sp(d, "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ", ImageFont.truetype(AMIRI, 30), TERRA, MX, hy, 0, "l")
fH = ImageFont.truetype(LORA, 62)
d.text((MX, hy + 64), "Islamic keepsakes,", font=fH, fill=INK)
d.text((MX, hy + 138), "books & cards,", font=fH, fill=INK)
d.text((MX, hy + 216), "for every age.", font=ImageFont.truetype(LORA_I, 72), fill=TERRA)
fsub = ImageFont.truetype(LORA, 27)
subtext = ("Hand-made, verified, and built to be kept. From your child's own "
           "storybook, to a card you send in a moment, to a journal through "
           "the language of the Qur'an.")
words, ln, cur = subtext.split(), [], ""
for w in words:
    t = (cur + " " + w).strip()
    if d.textlength(t, font=fsub) <= COLW:
        cur = t
    else:
        ln.append(cur); cur = w
if cur:
    ln.append(cur)
for i, line in enumerate(ln):
    d.text((MX, hy + 320 + i * 40), line, font=fsub, fill=(70, 68, 60))
# hero buttons
bx, by = MX, hy + 540
d.rectangle([bx, by, bx + 260, by + 66], fill=PINE)
sp(d, "SEE WHAT WE MAKE", ImageFont.truetype(SANS, 19), PAPER, bx + 130, by + 21, 2)
sp(d, "read our story  →", ImageFont.truetype(LORA_I, 30), TERRA, bx + 300, by + 16, 0, "l")
# hero image (a personalized book character), framed
himg = load(os.path.join(IMG, "hero-light-black-long-straight.jpg"), 430, 560)
ix = W - MX - 430
d.rectangle([ix - 14, hy + 44, ix + 430 + 14, hy + 44 + 560 + 14], fill=CARDBG)
im.paste(himg, (ix, hy + 58))
d.rectangle([ix, hy + 58, ix + 430, hy + 58 + 560], outline=TERRA, width=2)

# ── "our worlds" grid
gy = 920
d.line([(MX, gy), (W - MX, gy)], fill=(214, 206, 192), width=2)
sp(d, "WHAT WE MAKE", ImageFont.truetype(SANS, 20), TERRA, W / 2, gy + 34, 6)
tiles = [
    (os.path.join(IMG, "book-amira.jpg"), "Children's Books", "Personalized storybooks that make your child the star of their own dua."),
    (os.path.join(SP, "keepsake_home.png"), "Keepsakes & Prints", "Verified duas and blessings, personalized and made to keep on a wall."),
    (os.path.join(SP, "ad", "digital-card-cover-plum.png"), "Cards, Sent & Printed", "A card they open like a gift, digital in a moment or printed by post."),
    (os.path.join(SP, "COVER-FOR-JOURNAL.jpg"), "The Journal", "Thirty Arabic roots, traced to their source. A quiet study you keep."),
    (os.path.join(IMG, "app-journal.jpg"), "The App", "Daily adhkar, a Quran journal, your Garden in Jannah. Free, ad-free."),
    (os.path.join(IMG, "book-maryam.jpg"), "Short Films & More", "The Quran's wonders and our history, the videos that started it all."),
]
cols, cw, ch, gpx, gpy = 3, 340, 300, 40, 150
gx0 = (W - (cols * cw + (cols - 1) * gpx)) // 2
ty0 = gy + 90
fh2 = ImageFont.truetype(LORA, 32)
flab = ImageFont.truetype(SANS, 18)
fdesc = ImageFont.truetype(LORA, 22)
for i, (path, title, desc) in enumerate(tiles):
    r, c = divmod(i, cols)
    x = gx0 + c * (cw + gpx); y = ty0 + r * (ch + gpy)
    try:
        pic = load(path, cw, ch - 96)
    except Exception:
        pic = Image.new("RGB", (cw, ch - 96), CARDBG)
    im.paste(pic, (x, y))
    d.rectangle([x, y, x + cw, y + ch - 96], outline=(210, 202, 188), width=1)
    d.text((x, y + ch - 84), title, font=fh2, fill=PINE)
    # wrap desc
    words, ln, cur = desc.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=fdesc) <= cw:
            cur = t
        else:
            ln.append(cur); cur = w
    if cur:
        ln.append(cur)
    for j, t in enumerate(ln[:2]):
        d.text((x, y + ch - 42 + j * 26), t, font=fdesc, fill=(96, 92, 82))

# ── footer band (pine)
fy = H - 150
d.rectangle([0, fy, W, H], fill=PINE)
sp(d, "Made with care, sourced with proof.", ImageFont.truetype(LORA_I, 34), PAPER, W / 2, fy + 34, 0)
sp(d, "KETABISTUDIO.COM      @KETABISTUDIO      TIKTOK · YOUTUBE",
   ImageFont.truetype(SANS, 17), (200, 212, 200), W / 2, fy + 92, 3)

out = os.path.join(D, "_dict", "site_home_full.jpg")
os.makedirs(os.path.dirname(out), exist_ok=True)
im.save(out, quality=92)
print("wrote", out)
