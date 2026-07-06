#!/usr/bin/env python3
# "From One Root" premium CAROUSEL renderer (the light tile in the grid).
# Warm ivory editorial slides, gold Amiri root + du'a, slate-green ink, thin gold
# rule + KETABI wordmark. PIL renders Arabic RTL natively (do NOT pre-reverse).
# 1080x1350 (4:5). Outputs slide PNGs; combine/upload for the carousel post.
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.path.dirname(D), "worker", "fonts")
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
AMIRI = os.path.join(FONTS, "Amiri-Bold.ttf")
AMIRI_R = os.path.join(FONTS, "Amiri-Regular.ttf")
W, H = 1080, 1350
IVORY = (240, 234, 223)
INK = (42, 60, 52)          # deep slate-green
SOFT = (108, 116, 104)
GOLD = (176, 140, 66)

def base():
    im = Image.new("RGB", (W, H), IVORY)
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.75 * W)) ** 2 + ((yy - .5 * H) / (.75 * H)) ** 2
    vig = np.clip(1 - 0.10 * np.clip(d, 0, 1), 0.90, 1)[..., None]
    a = a * vig + np.random.default_rng(3).normal(0, 3.5, (H, W, 1))
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    d = ImageDraw.Draw(im)
    d.rectangle([46, 46, W - 46, H - 46], outline=(196, 170, 110), width=2)
    return im

def draw_center(d, lines, font, fill, cy, gap=1.24, ls=0):
    lh = int(font.size * gap)
    total = lh * (len(lines) - 1)
    y = cy - total / 2
    for ln in lines:
        if ls:
            w = sum(d.textlength(c, font=font) + ls for c in ln) - ls
            x = (W - w) / 2
            for c in ln:
                d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + ls
        else:
            w = d.textlength(ln, font=font)
            d.text(((W - w) / 2, y), ln, font=font, fill=fill)
        y += lh
    return y

def wordmark(d):
    f = ImageFont.truetype(PLAY, 26)
    d.line([(W // 2 - 26, H - 118), (W // 2 + 26, H - 118)], fill=GOLD, width=2)
    txt = "K E T A B I   S T U D I O"
    w = sum(d.textlength(c, font=f) + 3 for c in txt) - 3
    x = (W - w) / 2
    for c in txt:
        d.text((x, H - 100), c, font=f, fill=(150, 132, 96)); x += d.textlength(c, font=f) + 3

def tag(d, text="FROM ONE ROOT"):
    f = ImageFont.truetype(PLAY, 24)
    w = sum(d.textlength(c, font=f) + 4 for c in text) - 4
    x = (W - w) / 2
    for c in text:
        d.text((x, 96), c, font=f, fill=GOLD); x += d.textlength(c, font=f) + 4

def slide_hook(lines):
    im = base(); d = ImageDraw.Draw(im); tag(d)
    draw_center(d, lines, ImageFont.truetype(PLAY_IT, 78), INK, H * 0.47, gap=1.3)
    wordmark(d); return im

def slide_root(arabic, gloss_lines):
    im = base(); d = ImageDraw.Draw(im); tag(d)
    fa = ImageFont.truetype(AMIRI, 300)
    w = d.textlength(arabic, font=fa)
    bb = d.textbbox((0, 0), arabic, font=fa)
    d.text(((W - w) / 2, H * 0.36 - (bb[3] - bb[1]) / 2 - bb[1]), arabic, font=fa, fill=GOLD)
    draw_center(d, gloss_lines, ImageFont.truetype(PLAY_IT, 50), INK, H * 0.66, gap=1.34)
    wordmark(d); return im

def slide_text(lines, italic=True, size=66):
    im = base(); d = ImageDraw.Draw(im); tag(d)
    draw_center(d, lines, ImageFont.truetype(PLAY_IT if italic else PLAY, size), INK, H * 0.47, gap=1.32)
    wordmark(d); return im

def slide_dua(arabic, translit_lines, en_lines, cite):
    im = base(); d = ImageDraw.Draw(im); tag(d, "A DU'A FOR THE TURNING HEART")
    fa = ImageFont.truetype(AMIRI, 64)
    draw_center(d, [arabic], fa, GOLD, H * 0.30, gap=1.2)
    draw_center(d, translit_lines, ImageFont.truetype(PLAY_IT, 42), INK, H * 0.46, gap=1.3)
    draw_center(d, en_lines, ImageFont.truetype(PLAY_IT, 46), INK, H * 0.60, gap=1.3)
    draw_center(d, cite, ImageFont.truetype(PLAY, 26), SOFT, H * 0.72, gap=1.3)
    wordmark(d); return im

def slide_close(lines, cta):
    im = base(); d = ImageDraw.Draw(im)
    draw_center(d, ["FROM ONE ROOT"], ImageFont.truetype(PLAY, 40), GOLD, H * 0.34, ls=6)
    draw_center(d, lines, ImageFont.truetype(PLAY_IT, 50), INK, H * 0.47, gap=1.3)
    draw_center(d, cta, ImageFont.truetype(PLAY_IT, 44), (150, 132, 96), H * 0.60, gap=1.3)
    wordmark(d); return im

# ---- qalb carousel ----------------------------------------------------------
SLIDES = [
    slide_hook(["The word for", "your heart means:", "the thing that turns."]),
    slide_root("ق ل ب", ["qalb, the heart", "qalaba, to turn over", "taqallub, the turning between states"]),
    slide_text(["So your heart", "was made to move.", "", "Close to Him one day,", "far the next."]),
    slide_text(["That restlessness", "is not weak faith.", "", "It is a heart,", "doing what a heart does."]),
    slide_dua("يا مقلب القلوب ثبت قلبي على دينك",
              ["Ya Muqallib al-qulub,", "thabbit qalbi ala dinik."],
              ["O Turner of hearts,", "keep my heart firm upon Your deen."],
              ["the Prophet's frequent du'a", "Jami' at-Tirmidhi 2140 (hasan)"]),
    slide_close(["the language of the Qur'an,", "one word at a time."],
                ["save this for a restless day,", "follow for one every week."]),
]

if __name__ == "__main__":
    outdir = os.path.join(D, "_carousel_qalb")
    os.makedirs(outdir, exist_ok=True)
    for i, s in enumerate(SLIDES):
        s.save(os.path.join(outdir, f"slide{i+1}.png"))
    # contact preview
    cols = len(SLIDES); tw = 260; th = int(tw * H / W)
    sheet = Image.new("RGB", (tw * cols + (cols + 1) * 8, th + 16), (20, 20, 20))
    for i, s in enumerate(SLIDES):
        sheet.paste(s.resize((tw, th), Image.LANCZOS), (8 + i * (tw + 8), 8))
    sheet.save(os.path.join(D, "_carousel_qalb_preview.jpg"), quality=92)
    print("SLIDES", len(SLIDES), "->", outdir)
