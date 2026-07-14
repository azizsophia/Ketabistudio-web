#!/usr/bin/env python3
"""
Keepsake waitlist reel (1080x1920, silent) over REAL photos.

Emotional 5-frame arc on the Ketabi brand system (DM Serif Display, cream/gold,
italic emphasis word, KETABI STUDIO mark tucked under the text). Each frame is a
full-bleed photo, warm-graded, with a legibility scrim so cream text always
reads. compose() (shared shape with gen_dua_reel) stitches a slow ken-burns zoom
+ crossfades, silent (-an), under Vercel's ~4.5MB upload limit.

Photos are chosen by the caller (build_keepsake_reel) — modest Muslim-family
imagery, hijab only (no uncovered hair), no exposed faces required to carry it.
"""
import os, subprocess, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter


def _ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


FFMPEG = _ffmpeg()
FF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "worker", "fonts")
DM = os.path.join(FF, "DMSerifDisplay.ttf")
DM_IT = os.path.join(FF, "DMSerifDisplay-Italic.ttf")
DEJA = os.path.join(FF, "DejaVuSans.ttf")
W, H = 1080, 1920
CREAM = (248, 242, 232); GOLD = (214, 180, 92); SOFT = (208, 198, 182)


def F(p, s):
    return ImageFont.truetype(p, s, layout_engine=ImageFont.Layout.RAQM)


def cover(im, w=W, h=H):
    """Cover-crop a PIL image to w x h (centre, slightly high for faces)."""
    im = im.convert("RGB")
    tr = w / h; iw, ih = im.size; r = iw / ih
    if r > tr:
        nw = int(ih * tr); x = (iw - nw) // 2
        im = im.crop((x, 0, x + nw, ih))
    else:
        nh = int(iw / tr); y = int((ih - nh) * 0.42)  # bias up: keep faces/subjects
        im = im.crop((0, y, iw, y + nh))
    return im.resize((w, h), Image.LANCZOS)


def _grade(im):
    """Warm cinematic grade + vignette so the brand palette carries across any photo."""
    a = np.array(im, float)
    # gentle warm push + slight contrast
    a[..., 0] = np.clip(a[..., 0] * 1.05 + 4, 0, 255)
    a[..., 2] = np.clip(a[..., 2] * 0.96, 0, 255)
    a = np.clip((a - 128) * 1.06 + 128, 0, 255)
    # vignette
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = W / 2, H * 0.46
    d = np.sqrt(((xx - cx) / (W * 0.72)) ** 2 + ((yy - cy) / (H * 0.62)) ** 2)
    vig = np.clip(1 - (d - 0.6) * 0.55, 0.55, 1)[:, :, None]
    a = a * vig
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"), "RGB")


def _scrim(im, mode="lower"):
    """Darken so cream text reads. 'lower' = strong bottom, 'full' = even veil."""
    ov = np.zeros((H, W, 4), "uint8")
    yy = np.linspace(0, 1, H)[:, None]
    if mode == "full":
        alpha = np.full((H, 1), 132.0)
    elif mode == "center":
        alpha = (120 + 90 * np.clip(1 - np.abs(yy - 0.5) * 2.3, 0, 1)) * 0.9
    else:  # lower third heaviest, soft toward top
        alpha = np.clip((yy - 0.18) / 0.82, 0, 1) ** 1.4 * 205 + 40
    ov[..., 3] = np.repeat(alpha.astype("uint8"), W, axis=1)
    base = im.convert("RGBA")
    base.alpha_composite(Image.fromarray(ov, "RGBA"))
    return base.convert("RGB")


def _spaced(d, y, text, font, fill, tr=6, cx=W // 2):
    total = sum(d.textlength(c, font=font) + tr for c in text) - tr
    x = cx - total / 2
    for c in text:
        d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + tr


def _diamond(d, cx, y, width=150, color=GOLD):
    d.line([cx - width // 2, y, cx - 13, y], fill=color, width=2)
    d.line([cx + 13, y, cx + width // 2, y], fill=color, width=2)
    s = 6; d.polygon([(cx, y - s), (cx + s, y), (cx, y + s), (cx - s, y)], fill=color)


def _line(d, y, text, font, fill, shadow=True):
    w = d.textlength(text, font=font); x = (W - w) / 2
    if shadow:
        d.text((x + 2, y + 3), text, font=font, fill=(0, 0, 0))
    d.text((x, y), text, font=font, fill=fill)


def _mark(d):
    _spaced(d, H - 150, "K E T A B I   S T U D I O", F(DEJA, 22), SOFT, tr=5)


def frame(photo, scrim, eyebrow, lines, emphasis=None, cta=None):
    """lines: list of (text, kind) where kind in {'big','it','sub'}.
       emphasis: a word rendered in gold italic inline is done by passing an
       ('it') line; here we keep it simple line-based for reliability."""
    im = _scrim(_grade(cover(photo)), scrim)
    d = ImageDraw.Draw(im)
    big, itf, sub = F(DM, 92), F(DM_IT, 92), F(DEJA, 34)
    # measure block height to vertically place it in the lower-middle
    heights = []
    for t, k in lines:
        heights.append(120 if k in ("big", "it") else 54)
    block_h = sum(heights)
    y = int(H * 0.60) - block_h // 2
    if eyebrow:
        _spaced(d, y - 74, eyebrow, F(DEJA, 26), GOLD, tr=7)
    for (t, k), hh in zip(lines, heights):
        if k == "big":
            _line(d, y, t, big, CREAM)
        elif k == "it":
            _line(d, y, t, itf, GOLD)
        else:
            _line(d, y, t, F(DEJA, 32), SOFT, shadow=True)
        y += hh
    _diamond(d, W // 2, y + 26)
    if cta:
        _spaced(d, y + 66, cta, F(DEJA, 26), CREAM, tr=4)
    _mark(d)
    return im


def compose(frames_durations, out_path, tmpdir, fps=30, xfade=0.6):
    clips = []
    for i, (img, dur) in enumerate(frames_durations):
        p = os.path.join(tmpdir, f"f{i}.png"); img.save(p)
        c = os.path.join(tmpdir, f"c{i}.mp4"); nf = int(dur * fps)
        subprocess.run([
            FFMPEG, "-y", "-loop", "1", "-i", p, "-t", f"{dur}",
            "-vf", (f"scale=1350:2400,zoompan=z='min(zoom+0.00032,1.09)':d={nf}:"
                    f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps},"
                    f"format=yuv420p"),
            "-r", str(fps), c
        ], check=True, capture_output=True)
        clips.append((c, dur))
    inputs = []
    for c, _ in clips:
        inputs += ["-i", c]
    fc = []; prev = "0:v"; offset = clips[0][1] - xfade
    for i in range(1, len(clips)):
        out = f"x{i}"
        fc.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={xfade}:offset={offset:.3f}[{out}]")
        prev = out; offset += clips[i][1] - xfade
    subprocess.run([
        FFMPEG, "-y", *inputs, "-filter_complex", ";".join(fc), "-map", f"[{prev}]",
        "-c:v", "libx264", "-b:v", "1750k", "-maxrate", "2000k", "-bufsize", "4000k",
        "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out_path
    ], check=True, capture_output=True)
    return out_path
