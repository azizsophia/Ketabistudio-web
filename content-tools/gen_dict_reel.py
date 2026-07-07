#!/usr/bin/env python3
# Living Dictionary REEL (light, editorial — matches the cards/carousels, NOT the
# old dark filmic style). Kinetic typography on paper: the root appears, then the
# meaning, then the line, then the journal CTA. Cross-faded scenes with a subtle
# zoom. 1080x1920. Verified content (journal_data + gen_dictionary_card.CONTENT).
import os, sys, subprocess, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_dictionary_card as G
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import imageio_ffmpeg

D = os.path.dirname(os.path.abspath(__file__))
F = G.F
W, H = 1080, 1920
PAPER, INK, ACCENT, FAINT = G.PAPER, G.INK, G.ACCENT, G.FAINT
FPS = 25


def _paper():
    a = np.full((H, W, 3), PAPER, np.float32) + np.random.default_rng(4).normal(0, 3, (H, W, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def _sp(d, t, f, fill, cx, y, ls):
    w = sum(d.textlength(c, font=f) + ls for c in t) - ls
    x = cx - w / 2
    for c in t:
        d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls


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


def _block(d, lines, font, fill, cy, gap):
    y = cy - gap * (len(lines) - 1) / 2
    for t in lines:
        d.text(((W - d.textlength(t, font=font)) / 2, y), t, font=font, fill=fill); y += gap


def _header(d, num):
    _sp(d, "KETABI  ·  A LIVING DICTIONARY", ImageFont.truetype(F + "/DejaVuSans.ttf", 24), FAINT, W / 2, 150, 5)
    d.line([(140, 210), (W - 140, 210)], fill=INK, width=2)
    _sp(d, f"N.º {num:02d}", ImageFont.truetype(F + "/DejaVuSans.ttf", 22), FAINT, W / 2, 236, 4)


def sc_root(letters, word, tl, num):
    im = _paper(); d = ImageDraw.Draw(im); _header(d, num)
    f_root = ImageFont.truetype(G.AMIRI, 250)
    al = letters.split(); nL = len(al); gap = 230
    xs = [W / 2 + gap * (k - (nL - 1) / 2) for k in range(nL)]
    ry = 760; maxbot = ry
    for k in range(nL):
        x = xs[nL - 1 - k]; w = d.textlength(al[k], font=f_root)
        d.text((x - w / 2, ry), al[k], font=f_root, fill=INK)
        maxbot = max(maxbot, d.textbbox((x - w / 2, ry), al[k], font=f_root)[3])
    f_tr = ImageFont.truetype(F + "/DejaVuSans.ttf", 44); f_mark = ImageFont.truetype(F + "/DejaVuSans.ttf", 60)
    for k in range(nL):
        ch = tl[k].upper()
        if ch == "'":
            _sp(d, "’", f_mark, ACCENT, xs[nL - 1 - k], maxbot + 20, 0)
        else:
            _sp(d, ch, f_tr, ACCENT, xs[nL - 1 - k], maxbot + 34, 4)
    _sp(d, word.upper(), ImageFont.truetype(F + "/Lora.ttf", 52), INK, W / 2, maxbot + 130, 5)
    return im


def sc_meaning(defs, num):
    im = _paper(); d = ImageDraw.Draw(im); _header(d, num)
    _sp(d, "MEANING", ImageFont.truetype(F + "/DejaVuSans.ttf", 26), ACCENT, W / 2, 720, 8)
    _block(d, [f"{i}.  {x}" for i, x in enumerate(defs, 1)], ImageFont.truetype(F + "/Lora.ttf", 72), INK, H * 0.5, 100)
    return im


def sc_line(line, cite, num):
    im = _paper(); d = ImageDraw.Draw(im); _header(d, num)
    f = ImageFont.truetype(F + "/Cormorant-Italic.ttf", 82)
    ln = _wrap(d, line, f, W - 220)
    _block(d, ln, f, INK, H * 0.46, 100)
    _sp(d, cite, ImageFont.truetype(F + "/DejaVuSans.ttf", 24), FAINT, W / 2, H * 0.46 + 100 * len(ln) / 2 + 110, 3)
    return im


def sc_cta(num, journal=True):
    im = _paper(); d = ImageDraw.Draw(im); _header(d, num)
    _sp(d, "FROM ONE ROOT", ImageFont.truetype(F + "/Lora.ttf", 68), INK, W / 2, 760, 6)
    f = ImageFont.truetype(F + "/Cormorant-Italic.ttf", 56)
    if journal:
        _block(d, ["This is one of thirty roots.", "The full journal, every source cited,", "is on my Etsy."], f, (80, 74, 66), 980, 82)
    else:
        _block(d, ["one Arabic root, every day,", "traced back to where it begins."], f, (80, 74, 66), 980, 82)
    d.line([(W / 2 - 50, 1180), (W / 2 + 50, 1180)], fill=ACCENT, width=3)
    _sp(d, "FOLLOW  @KETABISTUDIO", ImageFont.truetype(F + "/DejaVuSans.ttf", 30), INK, W / 2, 1240, 4)
    _sp(d, "KETABISTUDIO.COM", ImageFont.truetype(F + "/DejaVuSans.ttf", 24), FAINT, W / 2, 1300, 4)
    return im


def _lookup(key):
    sys.path.insert(0, os.path.join(D, "etsy")); from journal_data import DAYS
    for i, dd in enumerate(DAYS, 1):
        k = dd["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0]
        if k == key:
            return dd, i
    raise KeyError(key)


def build(key, out, journal=True):
    day, num = _lookup(key)
    letters = day["letters"]; defs, line = G.CONTENT[key]
    tl = [G.AR_TR.get(c, c) for c in letters.split()]
    cite = day["citation"].split("·")[0].strip()
    scenes = [sc_root(letters, key, tl, num), sc_meaning(defs, num),
              sc_line(line, cite, num), sc_cta(num, journal)]
    arr = [np.asarray(s).astype(np.float32) for s in scenes]
    holds = [58, 46, 78, 60]   # frames per scene (~ at 25fps: 2.3s,1.8s,3.1s,2.4s)
    xf = 12                    # cross-fade frames
    fr = os.path.join(D, "_reelframes"); os.makedirs(fr, exist_ok=True)
    for f in glob.glob(fr + "/*.png"):
        os.remove(f)
    idx = 0

    def emit(a):
        nonlocal idx
        Image.fromarray(np.clip(a, 0, 255).astype("uint8")).save(f"{fr}/f{idx:04d}.png"); idx += 1

    for si, a in enumerate(arr):
        for j in range(holds[si]):
            # subtle zoom for life
            z = 1.0 + 0.02 * (j / max(1, holds[si]))
            emit(_zoom(a, z))
        if si < len(arr) - 1:
            for j in range(xf):
                t = (j + 1) / (xf + 1)
                emit(arr[si] * (1 - t) + arr[si + 1] * t)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ff, "-y", "-framerate", str(FPS), "-i", f"{fr}/f%04d.png",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23",
                    "-movflags", "+faststart", "-vf", "scale=1080:1920", out],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("ENCODED", out, round(os.path.getsize(out) / 1024 / 1024, 2), "MB")
    return out


def _zoom(a, z):
    if z <= 1.001:
        return a
    nh, nw = int(H / z), int(W / z)
    y0, x0 = (H - nh) // 2, (W - nw) // 2
    crop = a[y0:y0 + nh, x0:x0 + nw]
    im = Image.fromarray(np.clip(crop, 0, 255).astype("uint8")).resize((W, H), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else "sabr"
    out = os.path.join(D, f"_reel_{key}.mp4")
    build(key, out)
