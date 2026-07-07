#!/usr/bin/env python3
# Threads daily-post renderer. Same filmic jewel grade + gold Amiri as the reel
# covers, at 4:5 (1080x1350). Two layouts:
#   letters(): gold 3-letter root + translit + gloss (+ optional website line)
#   textcard(): a centered line (verse / reflection) with optional Arabic + cite
# Content is pulled from the VERIFIED journal_data (etymology + citations). PIL
# renders Arabic RTL natively (do NOT pre-reverse).
import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.path.dirname(D), "worker", "fonts")
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
AMIRI = os.path.join(FONTS, "Amiri-Bold.ttf")
W, H = 1080, 1350
GOLD = (214, 180, 112, 255)
CREAM = (247, 242, 233, 255)
SOFT = (206, 198, 182, 255)
WORD = (224, 208, 168, 255)


def prem_grade(src_path):
    src = Image.open(src_path).convert("RGB")
    sw, sh = src.size
    s = max(W / sw, H / sh)
    src = src.resize((int(sw * s + .5), int(sh * s + .5)), Image.LANCZOS)
    nw, nh = src.size
    src = src.crop(((nw - W) // 2, int((nh - H) * 0.42),
                    (nw - W) // 2 + W, int((nh - H) * 0.42) + H))
    a = np.asarray(src).astype(np.float32) * 0.84 + 6
    a[..., 0] *= 1.06; a[..., 2] *= 0.90
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    im = ImageEnhance.Color(im).enhance(0.78)
    im = ImageEnhance.Contrast(im).enhance(1.07)
    im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(20)), 0.12)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.72 * W)) ** 2 + ((yy - .5 * H) / (.72 * H)) ** 2
    vig = np.clip(1 - 0.60 * np.clip(d, 0, 1), 0.26, 1)[..., None]
    a = np.asarray(im).astype(np.float32) * vig
    a += np.random.default_rng(7).normal(0, 7, (H, W, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"), "RGB").convert("RGBA")


def scrim(cy=0.5, rx=0.62, ry=0.5, k=0.62):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (rx * W)) ** 2 + ((yy - cy * H) / (ry * H)) ** 2
    a = np.interp(np.clip(d, 0, 1), [0, .5, 1], [k, k * 0.55, 0.05]).astype(np.float32)
    ov = np.zeros((H, W, 4), np.float32)
    ov[..., 0] = 10; ov[..., 1] = 11; ov[..., 2] = 9; ov[..., 3] = a * 255
    return Image.fromarray(ov.astype("uint8"), "RGBA")


def _wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _draw_center(im, lines, font, fill, cy, gap=1.28, shadow=True):
    d = ImageDraw.Draw(im)
    lh = int(font.size * gap)
    y = cy - lh * (len(lines) - 1) / 2
    for ln in lines:
        w = d.textlength(ln, font=font)
        x = (W - w) / 2
        if shadow:
            d.text((x + 2, y + 3), ln, font=font, fill=(0, 0, 0, 150))
        d.text((x, y), ln, font=font, fill=fill)
        y += lh
    return y


def _gold_layer(letters, size=250):
    f = ImageFont.truetype(AMIRI, size)
    tmp = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    bb = tmp.textbbox((0, 0), letters, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pad = int(size * 0.5)
    layer = Image.new("RGBA", (tw + 2 * pad, th + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = pad - bb[0], pad - bb[1]
    d.text((x + 3, y + 4), letters, font=f, fill=(0, 0, 0, 150))
    d.text((x, y), letters, font=f, fill=GOLD)
    solid = Image.new("RGBA", layer.size, (7, 8, 6, 255))
    solid.putalpha(layer.split()[3])
    halo = solid.filter(ImageFilter.GaussianBlur(15))
    base = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    for _ in range(3):
        base.alpha_composite(halo)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(16)))
    base.alpha_composite(layer)
    return base


def _wordmark(im, website=False):
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(PLAY, 28)
    txt = "ketabistudio.com" if website else "K E T A B I   S T U D I O"
    tmp = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    if website:
        w = tmp.textlength(txt, font=f)
        d.line([(W // 2 - 30, H - 128), (W // 2 + 30, H - 128)], fill=(201, 168, 76, 220), width=2)
        d.text(((W - w) / 2, H - 112), txt, font=f, fill=WORD)
    else:
        w = sum(tmp.textlength(c, font=f) + 3 for c in txt) - 3
        d.line([(W // 2 - 30, H - 128), (W // 2 + 30, H - 128)], fill=(201, 168, 76, 220), width=2)
        x = (W - w) / 2
        for c in txt:
            d.text((x, H - 112), c, font=f, fill=WORD); x += tmp.textlength(c, font=f) + 3


def letters(bg, letters_str, translit, gloss, out, website=False):
    im = prem_grade(bg)
    im.alpha_composite(scrim(cy=0.42, k=0.55))
    gl = _gold_layer(letters_str, 250)
    im.alpha_composite(gl, ((W - gl.width) // 2, int(H * 0.36 - gl.height / 2)))
    _draw_center(im, [translit], ImageFont.truetype(PLAY_IT, 60), CREAM, int(H * 0.60))
    d = ImageDraw.Draw(im)
    gl_lines = _wrap(d, gloss.replace(" · ", ", "), ImageFont.truetype(PLAY_IT, 44), W - 300)
    _draw_center(im, gl_lines, ImageFont.truetype(PLAY_IT, 44), SOFT, int(H * 0.68))
    _wordmark(im, website=website)
    im.convert("RGB").save(out, quality=92)
    return out


def textcard(bg, line, out, arabic=None, cite=None, size=58):
    im = prem_grade(bg)
    im.alpha_composite(scrim(cy=0.48, k=0.60))
    cy = 0.30
    if arabic:
        gl = _gold_layer(arabic, 96)
        im.alpha_composite(gl, ((W - gl.width) // 2, int(H * 0.26 - gl.height / 2)))
        cy = 0.48
    d = ImageDraw.Draw(im)
    lines = _wrap(d, line, ImageFont.truetype(PLAY_IT, size), W - 260)
    endy = _draw_center(im, lines, ImageFont.truetype(PLAY_IT, size), CREAM, int(H * cy), gap=1.34)
    if cite:
        _draw_center(im, [cite], ImageFont.truetype(PLAY, 28), SOFT, int(endy + 60))
    _wordmark(im)
    im.convert("RGB").save(out, quality=92)
    return out
