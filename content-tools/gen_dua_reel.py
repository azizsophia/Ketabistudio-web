#!/usr/bin/env python3
"""
"Say this dua when you feel ___" reel generator (1080x1920, silent).

Three frames on the watercolor + DM Serif system:
  hook  → "Say this dua when you feel {feeling}"
  dua   → Arabic (Amiri) + transliteration (italic) + Clear Quran translation + cite
  end   → "Save it. Send it." + journal nudge

Compose(): ffmpeg stitches the frames with a slow ken-burns zoom and crossfades,
silent (-an), yuv420p. Duas are VERIFIED verbatim by the caller (build_dua_reels).
The ˹˺ editorial marks are stripped for display only (DM Serif lacks the glyphs);
every word is kept, so it stays the full Clear Quran wording.
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
AMIRI = os.path.join(FF, "Amiri-Bold.ttf")
DEJA = os.path.join(FF, "DejaVuSans.ttf")
W, H = 1080, 1920
INK = (32, 28, 24); CREAM = (248, 242, 232); GOLD = (208, 176, 88)


def F(p, s):
    return ImageFont.truetype(p, s, layout_engine=ImageFont.Layout.RAQM)


def _fractal(seed):
    rng = np.random.default_rng(seed)
    field = np.zeros((H, W), float); amp = 1.0
    for sc in [4, 8, 16, 32, 64]:
        small = rng.random((sc, sc))
        up = np.array(Image.fromarray((small * 255).astype("uint8")).resize((W, H), Image.BICUBIC), float) / 255
        field += up * amp; amp *= 0.6
    return (field - field.min()) / (field.max() - field.min())


def watercolor(base, seed, dark):
    light = (252, 248, 240) if dark else (250, 246, 238)
    cloud = 0.6 * _fractal(seed) + 0.4 * _fractal(seed + 99)
    cloud = (cloud - cloud.min()) / (cloud.max() - cloud.min())
    base = np.array(base, float); lightc = np.array(light, float)
    t = (cloud[:, :, None] - 0.5); col = base[None, None, :] + t * 34
    bloom = np.clip((cloud - 0.62) / 0.38, 0, 1)[:, :, None]
    col = col * (1 - bloom * 0.5) + lightc[None, None, :] * (bloom * 0.5)
    col = col + (np.random.default_rng(seed + 7).random((H, W)) - 0.5)[:, :, None] * 9
    return Image.fromarray(np.clip(col, 0, 255).astype("uint8"), "RGB").filter(ImageFilter.GaussianBlur(1.1))


def _spaced(d, y, text, font, fill, tr=5, cx=W // 2):
    total = sum(d.textlength(c, font=font) + tr for c in text) - tr
    x = cx - total / 2
    for c in text:
        d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + tr


def _diamond(d, cx, y, width=150, color=GOLD):
    d.line([cx - width // 2, y, cx - 13, y], fill=color, width=2)
    d.line([cx + 13, y, cx + width // 2, y], fill=color, width=2)
    s = 6; d.polygon([(cx, y - s), (cx + s, y), (cx, y + s), (cx - s, y)], fill=color)


def _wrap(d, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines


def _centered(d, y, lines, font, fill, lh):
    for ln in lines:
        w = d.textlength(ln, font=font); d.text(((W - w) / 2, y), ln, font=font, fill=fill); y += lh
    return y


def frame_hook(base, seed, dark, feeling):
    img = watercolor(base, seed, dark); d = ImageDraw.Draw(img)
    txt = INK if dark else CREAM
    _spaced(d, 470, "SAVE THIS DUA", F(DEJA, 26), tuple(int(c * 0.7 + b * 0.3) for c, b in zip(txt, base)), tr=7)
    rf, itf = F(DM, 96), F(DM_IT, 96)
    for i, ln in enumerate(["Say this dua", "when you feel"]):
        w = d.textlength(ln, font=rf); d.text(((W - w) / 2, 660 + i * 118), ln, font=rf, fill=txt)
    w = d.textlength(feeling, font=itf); d.text(((W - w) / 2, 660 + 2 * 118 + 10), feeling, font=itf, fill=txt)
    _diamond(d, W // 2, 660 + 3 * 118 + 40, color=GOLD)
    _spaced(d, H - 150, "K E T A B I   S T U D I O", F(DEJA, 22), tuple(int(c * 0.6 + b * 0.4) for c, b in zip(txt, base)), tr=5)
    return img


def frame_dua(base, seed, dark, arabic, translit, english, cite):
    img = watercolor(base, seed + 3, dark); d = ImageDraw.Draw(img)
    txt = INK if dark else CREAM
    cnv = Image.new("RGBA", (4400, 1000), (0, 0, 0, 0)); dc = ImageDraw.Draw(cnv)
    dc.text((120, 220), arabic, font=F(AMIRI, 190), fill=(GOLD if not dark else (150, 110, 40)) + (255,),
            direction="rtl", language="ar")
    ar = cnv.crop(cnv.getbbox()); scale = min(900 / ar.width, 1.0)
    ar = ar.resize((int(ar.width * scale), int(ar.height * scale)), Image.LANCZOS)
    img.paste(ar, ((W - ar.width) // 2, 500), ar)
    y = 500 + ar.height + 44
    tf = F(DM_IT, 46)
    y = _centered(d, y, _wrap(d, translit, tf, 940), tf, tuple(int(c * 0.8 + b * 0.2) for c, b in zip(txt, base)), 60)
    _diamond(d, W // 2, y + 28, color=GOLD); y += 72
    ef = F(DM, 52)
    y = _centered(d, y, _wrap(d, english, ef, 940), ef, txt, 68)
    _spaced(d, y + 22, cite, F(DEJA, 24), tuple(int(c * 0.7 + b * 0.3) for c, b in zip(txt, base)), tr=4)
    _spaced(d, H - 150, "K E T A B I   S T U D I O", F(DEJA, 22), tuple(int(c * 0.6 + b * 0.4) for c, b in zip(txt, base)), tr=5)
    return img


def frame_end(base, seed, dark):
    img = watercolor(base, seed + 9, dark); d = ImageDraw.Draw(img)
    txt = INK if dark else CREAM
    rf, itf = F(DM, 78), F(DM_IT, 60)
    w = d.textlength("Save it. Send it.", font=rf); d.text(((W - w) / 2, 720), "Save it. Send it.", font=rf, fill=txt)
    for i, ln in enumerate(["Make it for someone", "who needs it today."]):
        w = d.textlength(ln, font=itf); d.text(((W - w) / 2, 830 + i * 70), ln, font=itf, fill=txt)
    _diamond(d, W // 2, 1010, color=GOLD)
    _spaced(d, 1060, "30 DUAS IN OUR JOURNAL  ·  KETABISTUDIO.ETSY.COM", F(DEJA, 22),
            tuple(int(c * 0.7 + b * 0.3) for c, b in zip(txt, base)), tr=3)
    _spaced(d, H - 150, "K E T A B I   S T U D I O", F(DEJA, 22), tuple(int(c * 0.6 + b * 0.4) for c, b in zip(txt, base)), tr=5)
    return img


def compose(frames_durations, out_path, tmpdir, fps=30, xfade=0.6):
    """frames_durations: list of (PIL.Image, seconds). Ken-burns zoom + crossfade, silent."""
    clips = []
    for i, (img, dur) in enumerate(frames_durations):
        p = os.path.join(tmpdir, f"f{i}.png")
        img.save(p)
        c = os.path.join(tmpdir, f"c{i}.mp4")
        nf = int(dur * fps)
        subprocess.run([
            FFMPEG, "-y", "-loop", "1", "-i", p, "-t", f"{dur}",
            "-vf", (f"scale=1350:2400,zoompan=z='min(zoom+0.00035,1.09)':d={nf}:"
                    f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps},"
                    f"format=yuv420p"),
            "-r", str(fps), c
        ], check=True, capture_output=True)
        clips.append((c, dur))
    # build xfade chain
    inputs = []
    for c, _ in clips:
        inputs += ["-i", c]
    fc = []
    prev = "0:v"
    offset = clips[0][1] - xfade
    for i in range(1, len(clips)):
        out = f"x{i}"
        fc.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={xfade}:offset={offset:.3f}[{out}]")
        prev = out
        offset += clips[i][1] - xfade
    filt = ";".join(fc)
    subprocess.run([
        FFMPEG, "-y", *inputs, "-filter_complex", filt, "-map", f"[{prev}]",
        # keep the whole reel comfortably under Vercel's ~4.5MB upload body limit
        # (static frames + slow zoom compress cleanly at this bitrate)
        "-c:v", "libx264", "-b:v", "1750k", "-maxrate", "2000k", "-bufsize", "4000k",
        "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out_path
    ], check=True, capture_output=True)
    return out_path
