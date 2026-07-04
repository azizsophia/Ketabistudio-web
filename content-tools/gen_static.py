#!/usr/bin/env python3
# Filmic faceless reminder statics — same aesthetic as the reel so feed + reels
# read as one brand. 1080x1350 (4:5). Film-graded faceless background, a soft
# radial band scrim so the light Playfair-italic line always stays legible, and
# a held KETABI STUDIO footer with a gold rule.
import sys, os
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageFont
import numpy as np

FONTS = "/home/user/Ketabistudio-web/worker/fonts"
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
W, H = 1080, 1350

def grade(src):
    sw, sh = src.size
    s = max(W/sw, H/sh)
    src = src.resize((int(sw*s+.5), int(sh*s+.5)), Image.LANCZOS)
    nw, nh = src.size
    src = src.crop(((nw-W)//2, int((nh-H)*0.40), (nw-W)//2+W, int((nh-H)*0.40)+H))
    a = np.asarray(src).astype(np.float32)
    a = a*0.90 + 16
    a[...,0] *= 1.05; a[...,2] *= 0.93
    a = np.clip(a, 0, 255)
    im = Image.fromarray(a.astype("uint8"))
    im = ImageEnhance.Color(im).enhance(0.85)
    soft = im.filter(ImageFilter.GaussianBlur(14))
    im = Image.blend(im, soft, 0.13)
    a = np.asarray(im).astype(np.float32)
    g = np.random.default_rng(7).normal(0, 8, (H, W, 1))
    return Image.fromarray(np.clip(a+g, 0, 255).astype("uint8"))

def radial_band(cx, cy, rx, ry, strength):
    # soft dark elliptical scrim centered at (cx,cy) as fraction of W,H
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx-cx*W)/(rx*W))**2 + ((yy-cy*H)/(ry*H))**2
    m = np.clip(1.0 - d, 0, 1)**1.3
    return (m*strength)

def wrap(draw, text, font, maxw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur+" "+w).strip()
        if draw.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def make(bg_path, lines_text, out_path, sub="made with love, for mamas like you"):
    im = grade(Image.open(bg_path).convert("RGB"))
    # bottom gradient scrim (dark base) + radial band behind the text
    a = np.asarray(im).astype(np.float32)
    yy = np.mgrid[0:H, 0:W][0].astype(np.float32)/H
    base = np.clip((yy-0.30)/0.70, 0, 1)**1.2 * 150   # darken lower half
    band = radial_band(0.5, 0.60, 0.62, 0.24, 150)     # behind the line
    endband = radial_band(0.5, 0.82, 0.55, 0.12, 120)  # behind footer
    dark = np.maximum(np.maximum(base, band), endband)[...,None]
    a = a*(1 - dark/255*0.82)
    im = Image.fromarray(np.clip(a,0,255).astype("uint8"))

    d = ImageDraw.Draw(im)
    # main line — Playfair italic, cream
    fs = 66
    font = ImageFont.truetype(PLAY_IT, fs)
    lines = []
    lines_text = lines_text.replace("\\n", "\n")
    for para in lines_text.split("\n"):
        lines += wrap(d, para, font, W-200)
    lh = int(fs*1.28)
    total = lh*len(lines)
    y = int(H*0.60) - total//2
    for ln in lines:
        w = d.textlength(ln, font=font)
        x = (W-w)//2
        # soft shadow
        d.text((x, y+2), ln, font=font, fill=(0,0,0,160))
        d.text((x, y), ln, font=font, fill=(248,243,234))
        y += lh

    # footer: KETABI STUDIO + gold rule + sub
    fmark = ImageFont.truetype(PLAY, 30)
    mark = "K E T A B I   S T U D I O"
    mw = d.textlength(mark, font=fmark)
    my = int(H*0.80)
    d.text(((W-mw)//2, my+2), mark, font=fmark, fill=(0,0,0,150))
    d.text(((W-mw)//2, my), mark, font=fmark, fill=(244,236,219))
    # gold rule
    ry = my+52
    d.line([(W//2-34, ry),(W//2+34, ry)], fill=(201,168,76), width=2)
    fsub = ImageFont.truetype(PLAY_IT, 32)
    sw = d.textlength(sub, font=fsub)
    d.text(((W-sw)//2, ry+20), sub, font=fsub, fill=(227,220,203))

    im.save(out_path, quality=92)
    print("saved", out_path)

if __name__ == "__main__":
    bg, line, out = sys.argv[1], sys.argv[2], sys.argv[3]
    sub = sys.argv[4] if len(sys.argv) > 4 else "made with love, for mamas like you"
    make(bg, line, out, sub)
