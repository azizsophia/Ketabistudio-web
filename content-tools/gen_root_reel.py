#!/usr/bin/env python3
# "From One Root" premium insight-reel renderer (browser-free PIL/numpy + ffmpeg).
# One Arabic root per reel: hook -> reveals -> GOLD Amiri hero moment -> the turn
# (fact->feeling) -> payoff -> held KETABI end card. Built for watch-time.
#
# Premium look (owner-approved 07-05): deep faded-black jewel grade, warm tint,
# vignette, bloom, grain; GOLD Amiri hero (cream only on bright/gold bgs). Text
# layer is sized to the true glyph bbox so Amiri descenders never clip. The end
# card fades in AFTER the payoff fully clears (no overlap). ~18.5s, <4.5MB.
#
# Usage: set BG + CARDS + END at the bottom, then `python3 gen_root_reel.py`.
# Auto-uploads to /api/social/video on finish and prints the public URL.
import os, glob, subprocess
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageFont
import numpy as np
import imageio_ffmpeg

D = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.path.dirname(D), "worker", "fonts")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
AMIRI = os.path.join(FONTS, "Amiri-Bold.ttf")
FPS, DUR = 25, 18.5
N = int(FPS * DUR)
W, H = 1080, 1920
GOLD = (214, 180, 112, 255)
CREAM = (248, 243, 234, 255)
SOFT = (226, 219, 202, 255)
ff = imageio_ffmpeg.get_ffmpeg_exe()

def c01(x): return max(0.0, min(1.0, x))
def oc(x): return 1 - (1 - x) ** 3
def io_(x): return 2 * x * x if x < .5 else 1 - ((-2 * x + 2) ** 2) / 2
def seg(t, a, b): return c01((t - a) / (b - a))

def prem_grade(src_path):
    # deep faded blacks, warm, desat, bloom, vignette, grain -> 1180x2100
    src = Image.open(src_path).convert("RGB")
    TW, TH = 1180, 2100
    sw, sh = src.size
    s = max(TW / sw, TH / sh)
    src = src.resize((int(sw * s + .5), int(sh * s + .5)), Image.LANCZOS)
    nw, nh = src.size
    src = src.crop(((nw - TW) // 2, int((nh - TH) * 0.42), (nw - TW) // 2 + TW, int((nh - TH) * 0.42) + TH))
    a = np.asarray(src).astype(np.float32) * 0.88 + 6
    a[..., 0] *= 1.06; a[..., 2] *= 0.90
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    im = ImageEnhance.Color(im).enhance(0.80)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(20)), 0.12)
    yy, xx = np.mgrid[0:TH, 0:TW].astype(np.float32)
    d = ((xx - .5 * TW) / (.72 * TW)) ** 2 + ((yy - .5 * TH) / (.72 * TH)) ** 2
    vig = np.clip(1 - 0.55 * np.clip(d, 0, 1), 0.30, 1)[..., None]
    a = np.asarray(im).astype(np.float32) * vig
    a += np.random.default_rng(7).normal(0, 7, (TH, TW, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))

def center_scrim():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.60 * W)) ** 2 + ((yy - .46 * H) / (.40 * H)) ** 2
    a = np.interp(np.clip(d, 0, 1), [0, .5, 1], [.58, .36, .10]).astype(np.float32)
    ov = np.zeros((H, W, 4), np.float32)
    ov[..., 0] = 10; ov[..., 1] = 11; ov[..., 2] = 9; ov[..., 3] = a * 255
    return ov

def text_block(lines, font, fill, gap=1.18, glow=False):
    # layer sized to real glyph extent (Amiri descenders were clipping); centered
    tmp = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    fs = font.size
    lh = int(fs * gap)
    pad = int(fs * 0.45)
    widths = [tmp.textlength(x, font=font) for x in lines] or [0]
    tops, bots = [], []
    for i, ln in enumerate(lines):
        bb = tmp.textbbox((0, i * lh), ln, font=font)
        tops.append(bb[1]); bots.append(bb[3])
    top = min(tops) if tops else 0
    bot = max(bots) if bots else fs
    layer = Image.new("RGBA", (W, (bot - top) + 2 * pad + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    off = pad - top
    for i, (ln, w) in enumerate(zip(lines, widths)):
        x = (W - w) / 2
        y = i * lh + off
        d.text((x, y + 2), ln, font=font, fill=(0, 0, 0, 150))
        d.text((x, y), ln, font=font, fill=fill)
    if glow:
        g = layer.filter(ImageFilter.GaussianBlur(14))
        base = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        base.alpha_composite(g); base.alpha_composite(layer)
        return base
    return layer

def render(name, bg_file, cards, end_lines, gold_arabic=True):
    bg_full = prem_grade(bg_file if os.path.isabs(bg_file) else os.path.join(D, bg_file))
    BW, BH = bg_full.size
    scr = center_scrim()
    f_en = ImageFont.truetype(PLAY_IT, 74)
    f_ar = ImageFont.truetype(AMIRI, 225)
    f_small = ImageFont.truetype(PLAY_IT, 46)
    f_mk = ImageFont.truetype(PLAY, 32)
    f_sub = ImageFont.truetype(PLAY_IT, 36)
    ar_fill = GOLD if gold_arabic else CREAM

    prepped = []
    for cd in cards:
        p = dict(cd)
        if cd.get("arabic"):
            p["arabic_l"] = text_block([cd["arabic"]], f_ar, ar_fill, gap=1.0, glow=True)
            p["small_l"] = text_block(cd["lines"], f_small, SOFT) if cd.get("lines") else None
        else:
            p["main_l"] = text_block(cd["lines"], f_en, CREAM)
        prepped.append(p)

    MK = text_block(["K E T A B I   S T U D I O"], f_mk, (224, 208, 168, 255))
    SBL = text_block(end_lines, f_sub, SOFT)

    fr = os.path.join(D, "_iframes")
    os.makedirs(fr, exist_ok=True)
    for f in glob.glob(fr + "/*.png"):
        os.remove(f)

    for i in range(N):
        t = i / FPS
        k = io_(seg(t, 0, DUR + 2))
        z = 1.07 - 0.07 * k
        cw, ch = W / z, H / z
        cx, cy = BW / 2, BH / 2 + k * 0.012 * BH
        frame = bg_full.resize((W, H), Image.LANCZOS, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)).convert("RGBA")
        fa = np.asarray(frame).astype(np.float32)
        sa = scr[..., 3:4] / 255.0
        fa[..., :3] = fa[..., :3] * (1 - sa) + scr[..., :3] * sa
        frame = Image.fromarray(np.clip(fa, 0, 255).astype("uint8"), "RGBA")

        def blit(layer, cyf, alpha, dy=0):
            if layer is None or alpha <= 0.004:
                return
            l = layer
            if alpha < 1:
                l = layer.copy()
                l.putalpha(l.split()[3].point(lambda v: int(v * alpha)))
            frame.alpha_composite(l, (0, int(H * cyf - layer.height / 2 + dy)))

        for cd in prepped:
            a_in = seg(t, cd["in"], cd["in"] + 0.55)
            a_out = 1 - seg(t, cd["out"] - 0.45, cd["out"])
            alpha = a_in * a_out
            if alpha <= 0.004:
                continue
            rise = (1 - oc(a_in)) * 26
            if cd.get("arabic"):
                blit(cd["arabic_l"], 0.42, alpha, dy=rise)
                blit(cd.get("small_l"), 0.66, alpha, dy=rise)
            else:
                blit(cd["main_l"], 0.47, alpha, dy=rise)

        ae = oc(seg(t, 16.5, 17.4))
        if ae > 0.004:
            blit(MK, 0.44, ae)
            d = ImageDraw.Draw(frame)
            ry = int(H * 0.44 + 40)
            d.line([(W // 2 - 34, ry), (W // 2 + 34, ry)], fill=(201, 168, 76, int(210 * ae)), width=2)
            blit(SBL, 0.52, ae)

        frame.convert("RGB").save(f"{fr}/f{i:04d}.png")

    out = os.path.join(D, f"{name}.mp4")
    subprocess.run([ff, "-y", "-framerate", str(FPS), "-i", f"{fr}/f%04d.png",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
        "-crf", "27", "-maxrate", "1850k", "-bufsize", "3700k", "-movflags", "+faststart",
        "-vf", "scale=1080:1920", out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("ENCODED", name, round(os.path.getsize(out) / 1024 / 1024, 2), "MB", flush=True)
    r = subprocess.run(["curl", "-s", "-X", "POST", "https://www.ketabistudio.com/api/social/video",
        "-H", "Authorization: Bearer ketabi-cron-2027", "-F", f"file=@{out};type=video/mp4"],
        capture_output=True, text=True, timeout=120)
    print("UPLOAD", r.stdout[:200], flush=True)

# ---- qalb (ق ل ب) — the heart that turns -------------------------------------
# Sources: root ق ل ب (to turn/overturn) corpus.quran.com; the heart named for its
# taqallub is a classical linguistic point (athar of Ibn 'Abbas); du'a "Ya
# Muqallib al-qulub, thabbit qalbi 'ala dinik" — Jami' at-Tirmidhi 2140 (ḥasan).
CARDS = [
    {"in": 0.3, "out": 4.2, "lines": ["In Arabic, the word", "for the heart", "means: the thing that turns."]},
    {"in": 4.2, "out": 7.9, "arabic": "ق ل ب", "lines": ["qalb, the heart", "qalaba, to turn over"]},
    {"in": 7.9, "out": 11.3, "lines": ["The heart is named", "for what it does:", "it turns, and will not stay still."]},
    {"in": 11.3, "out": 13.7, "lines": ["so when your faith", "wavers, then steadies,", "then wavers again,"]},
    {"in": 13.7, "out": 16.3, "lines": ["that is not weakness.", "it is a heart,", "doing what its name means."]},
]

if __name__ == "__main__":
    HERE = os.path.dirname(D)  # repo root
    QALB_BG = "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad/premium/hires_qalb.jpg"
    render("reel_qalb", QALB_BG, CARDS, ["from one root", "a word from the Qur'an, every week"], gold_arabic=True)
    print("ALL DONE")
