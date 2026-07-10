#!/usr/bin/env python3
# Ketabi ayah REELS (IG) — hook / verse / end-card over real Pexels footage.
#   - Footage policy = same as photos (see gen_ayah_wallpaper.py header):
#     real video only, hand-checked frames, NO people, no tombs, never reuse.
#   - Verses verified against quran.com; translations Clear Quran verbatim.
#   - Every text layer gets a soft drop shadow + a full-width scrim band so
#     type stays readable over moving water/cloud (owner request 2026-07-10).
#   - End card shows the From One Root cover and states DIGITAL DOWNLOAD
#     (the Etsy listing is a PDF; never imply a shipped book).
# Usage: gen_ayah_reel.py <spec.json> <out.mp4>   (spec: see SPEC_EXAMPLE)
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

D = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(os.path.dirname(D), "worker", "fonts")
AMIRI = os.path.join(FF, "Amiri-Bold.ttf")
PLAY = os.path.join(FF, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FF, "PlayfairDisplay-Italic.ttf")
SANS = os.path.join(FF, "DejaVuSans.ttf")
COVER = os.path.join(os.path.dirname(D), "worker", "assets", "journal", "journal_cover_front.png")
W, H = 1080, 1920
CREAM = (242, 236, 224)
CREAM_S = (222, 214, 199)
GOLD = (198, 172, 122)

SPEC_EXAMPLE = {
    "video": "/tmp/vid_35257540.mp4",
    "hook": ["The Quran says it twice,", "back to back"],
    "ar": ["فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا"],
    "en": ["So, surely with hardship comes ease."],
    "cite": "QUR'AN 94:5-6",
    "verse_yc": 470,
    "duration": 12.0,
}


def _shadowed(layer):
    """Soft drop shadow built from the layer's own alpha: black copy, offset
    down, blurred, composited beneath. Keeps whisper type readable on motion."""
    a = np.asarray(layer, np.uint8).copy()
    a[..., 0:3] = 12
    shadow = Image.fromarray(a)
    shadow = shadow.transform(shadow.size, Image.AFFINE, (1, 0, 0, 0, 1, -4))
    shadow = shadow.filter(ImageFilter.GaussianBlur(9))
    sa = np.asarray(shadow, np.uint8).copy()
    sa[..., 3] = (sa[..., 3].astype(np.float32) * 0.85).astype(np.uint8)
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    out.alpha_composite(Image.fromarray(sa))
    out.alpha_composite(layer)
    return out


def _scrim(im, yc, hgt, peak=150):
    a = np.zeros((H, W, 4), np.float32)
    yy = np.mgrid[0:H].astype(np.float32)
    wgt = np.clip(1 - np.abs(yy - yc) / (hgt * 0.85), 0, 1) ** 1.4
    a[..., 3] = (wgt * peak)[:, None]
    im.alpha_composite(Image.fromarray(a.astype("uint8")))


def _ctext(d, t, f, fill, y, ls=0):
    w = sum(d.textlength(c, font=f) + ls for c in t) - ls if ls else d.textlength(t, font=f)
    x = (W - w) / 2
    if ls:
        cx = x
        for c in t:
            d.text((cx, y), c, font=f, fill=fill)
            cx += d.textlength(c, font=f) + ls
    else:
        d.text((x, y), t, font=f, fill=fill)


def hook_png(lines, out, y0=430):
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    _scrim(base, y0 + 40 * len(lines), 240, 120)
    txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    f = ImageFont.truetype(PLAY, 50)
    y = y0
    for ln in lines:
        _ctext(d, ln, f, CREAM, y)
        y += 72
    base.alpha_composite(_shadowed(txt))
    base.save(out)


def verse_png(ar, en, cite, out, yc=640):
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    f_ar = ImageFont.truetype(AMIRI, 80)
    ms = [d.textbbox((0, 0), ln, font=f_ar) for ln in ar]
    while any(m[2] - m[0] > W - 220 for m in ms):
        f_ar = ImageFont.truetype(AMIRI, f_ar.size - 8)
        ms = [d.textbbox((0, 0), ln, font=f_ar) for ln in ar]
    hs = [m[3] - m[1] for m in ms]
    ag = int(f_ar.size * 0.5)
    total = sum(hs) + ag * (len(hs) - 1) + 56 + 46 + 58 * len(en) + 44 + 26
    _scrim(base, yc, int(total * 0.80), 170)
    y = yc - total // 2
    for i, ln in enumerate(ar):
        m = ms[i]
        x = (W - (m[2] - m[0])) / 2 - m[0]
        d.text((x, y - m[1]), ln, font=f_ar, fill=CREAM)
        y += hs[i] + (ag if i < len(hs) - 1 else 0)
    y += 56
    d.line([(W / 2 - 26, y), (W / 2 + 26, y)], fill=GOLD, width=2)
    y += 46
    f_en = ImageFont.truetype(PLAY_IT, 40)
    for ln in en:
        _ctext(d, ln, f_en, CREAM_S, y)
        y += 58
    y += 44
    _ctext(d, cite, ImageFont.truetype(SANS, 22), GOLD, y, ls=6)
    base.alpha_composite(_shadowed(txt))
    base.save(out)


def endcard_png(out):
    im = Image.new("RGBA", (W, H), (16, 15, 13, 255))
    a = np.asarray(im, np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    g = np.exp(-(((xx - W / 2) / (W * 0.7)) ** 2 + ((yy - H * 0.42) / (H * 0.55)) ** 2)) * 14
    a[..., 0] += g
    a[..., 1] += g * 0.9
    a[..., 2] += g * 0.7
    a[..., :3] += np.random.default_rng(7).normal(0, 3.5, (H, W, 1))
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    cov = Image.open(COVER).convert("RGB")
    cov.thumbnail((470, 700))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    x0 = (W - cov.width) // 2
    y0 = 470
    ds.rounded_rectangle([x0 - 10, y0 + 16, x0 + cov.width + 10, y0 + cov.height + 26], 28, fill=(0, 0, 0, 120))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    im.alpha_composite(sh)
    im.paste(cov, (x0, y0))
    txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    _ctext(d, "From One Root", ImageFont.truetype(PLAY, 66), CREAM, 240)
    _ctext(d, "a 30-day Quran journal", ImageFont.truetype(PLAY_IT, 42), CREAM_S, 330)
    y = y0 + cov.height + 70
    d.line([(W / 2 - 26, y), (W / 2 + 26, y)], fill=GOLD, width=2)
    y += 44
    _ctext(d, "DIGITAL DOWNLOAD ON ETSY", ImageFont.truetype(SANS, 26), GOLD, y, ls=8)
    y += 52
    _ctext(d, "linked in profile", ImageFont.truetype(PLAY_IT, 36), CREAM_S, y)
    _ctext(d, "K E T A B I", ImageFont.truetype(SANS, 18), (150, 136, 108), H - 84, 6)
    im.alpha_composite(_shadowed(txt))
    im.save(out)


def build(spec, out):
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    tmp = out + ".layers"
    os.makedirs(tmp, exist_ok=True)
    hook_png(spec["hook"], f"{tmp}/hook.png")
    verse_png(spec["ar"], spec["en"], spec["cite"], f"{tmp}/verse.png", yc=spec.get("verse_yc", 640))
    endcard_png(f"{tmp}/end.png")
    dur = spec.get("duration", 12.0)
    vf = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
        "eq=contrast=0.88:saturation=0.72:brightness=-0.05,"
        "colorbalance=rs=.03:bs=-.03,noise=alls=5:allf=t+u,format=yuv420p[bg];"
        "[1:v]format=rgba,fade=in:st=0.3:d=0.5:alpha=1,fade=out:st=2.9:d=0.5:alpha=1[hk];"
        "[2:v]format=rgba,fade=in:st=3.6:d=0.6:alpha=1,fade=out:st=8.8:d=0.6:alpha=1[vs];"
        "[3:v]format=rgba,fade=in:st=9.6:d=0.7:alpha=1[ec];"
        "[bg][hk]overlay=0:0[a];[a][vs]overlay=0:0[b];[b][ec]overlay=0:0[v]"
    )
    cmd = [
        ffmpeg, "-y",
        # loop the footage so a clip shorter than `dur` never freezes on its
        # last frame; the -t on the output trims to the target length.
        "-stream_loop", "-1", "-i", spec["video"],
        "-loop", "1", "-t", str(dur), "-i", f"{tmp}/hook.png",
        "-loop", "1", "-t", str(dur), "-i", f"{tmp}/verse.png",
        "-loop", "1", "-t", str(dur), "-i", f"{tmp}/end.png",
        "-filter_complex", vf, "-map", "[v]",
        # target ~3-3.5MB for an ~11.5s reel so the upload stays under the
        # serverless request-body limit; IG re-encodes anyway. Silent by
        # design (no music) — drop the source audio entirely.
        "-t", str(dur), "-r", "30", "-c:v", "libx264",
        "-b:v", "2300k", "-maxrate", "2600k", "-bufsize", "4600k",
        "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(r.stderr[-500:])
    return out


if __name__ == "__main__":
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    print("built:", build(spec, sys.argv[2]))
