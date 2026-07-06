#!/usr/bin/env python3
# "A Name Written Into the Qur'an" — personalized name print renderer.
# Premium ivory, gold Amiri name, verified Qur'anic root + ayah + citation.
# The wow is the Qur'anic connection (the ayah the name's root appears in),
# NOT the meaning alone. Root letters MUST render in Amiri (they are Arabic);
# Latin fonts show them as tofu boxes. Every field is a verified string.
import os, numpy as np
from PIL import Image, ImageDraw, ImageFont

_HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(_HERE, "..", "..", "worker", "fonts")
PLAY    = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
AMIRI   = os.path.join(FONTS, "Amiri-Bold.ttf")
BW, BH  = 1080, 1350  # 4:5

BG   = (240, 234, 223)
INK  = (42, 60, 52)
SOFT = (112, 120, 108)
GOLD = (176, 140, 66)
TAG  = (176, 140, 66)
MARK = (150, 132, 96)
BORDER = (196, 170, 110)

_M = ImageDraw.Draw(Image.new("RGB", (4, 4)))

def _base(W, H):
    im = Image.new("RGB", (W, H), BG)
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.72 * W)) ** 2 + ((yy - .44 * H) / (.60 * H)) ** 2
    vig = np.clip(1 - 0.09 * np.clip(d, 0, 1), 0.91, 1)[..., None]
    a = a * vig + np.random.default_rng(3).normal(0, 3.2, (H, W, 1))
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    bw = max(2, round(2 * (W / BW)))
    ImageDraw.Draw(im).rectangle(
        [round(46 * W / BW), round(46 * H / BH), W - round(46 * W / BW), H - round(46 * H / BH)],
        outline=BORDER, width=bw)
    return im

def _center(d, text, font, fill, y, W, ls=0):
    if ls:
        wd = sum(d.textlength(c, font=font) + ls for c in text) - ls
        x = (W - wd) / 2
        for c in text:
            d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + ls
    else:
        wd = d.textlength(text, font=font)
        d.text(((W - wd) / 2, y), text, font=font, fill=fill)

def _center_mixed(d, segs, y, W, gap=0):
    """segs = [(text, font, fill), ...] laid out on one baseline, centered."""
    widths = [d.textlength(t, font=f) for (t, f, _) in segs]
    total = sum(widths) + gap * (len(segs) - 1)
    x = (W - total) / 2
    # align to a common visual baseline using max ascent
    asc = max(f.getmetrics()[0] for (_, f, _) in segs)
    for (t, f, c), w in zip(segs, widths):
        fa = f.getmetrics()[0]
        d.text((x, y + (asc - fa)), t, font=f, fill=c)
        x += w + gap

def render_name(entry, out_path, sc=1.0):
    """entry keys (all verified strings):
       tag, arabic (name w/ harakat), translit, root_letters (spaced, e.g. 'ن و ر'),
       root_gloss (e.g. 'to give light'), line1, ayah, citation."""
    W, H = round(BW * sc), round(BH * sc)
    def S(x): return round(x * sc)
    im = _base(W, H); d = ImageDraw.Draw(im)

    f_tag  = ImageFont.truetype(PLAY, S(24))
    f_name = ImageFont.truetype(AMIRI, S(150))
    f_tr   = ImageFont.truetype(PLAY_IT, S(64))
    f_root = ImageFont.truetype(PLAY_IT, S(40))
    f_rootA= ImageFont.truetype(AMIRI, S(40))     # root letters in Amiri
    f_line = ImageFont.truetype(PLAY_IT, S(40))
    f_ayah = ImageFont.truetype(PLAY_IT, S(44))
    f_cite = ImageFont.truetype(PLAY, S(30))

    # header tag
    _center(d, entry["tag"].upper(), f_tag, TAG, S(108), W, ls=S(6))

    # Arabic name (gold), sized to true glyph bbox so harakat don't clip
    nb = d.textbbox((0, 0), entry["arabic"], font=f_name)
    nx = (W - (nb[2] - nb[0])) / 2 - nb[0]
    d.text((nx, S(300) - nb[1]), entry["arabic"], font=f_name, fill=GOLD)

    # transliteration
    _center(d, entry["translit"], f_tr, INK, S(560), W)

    # gold divider
    d.line([(W // 2 - S(34), S(680)), (W // 2 + S(34), S(680))], fill=GOLD, width=max(2, S(2)))

    # root line: "from the root  ن و ر  ·  to give light" (Amiri for the letters)
    segs = [("from the root  ", f_root, INK),
            (entry["root_letters"], f_rootA, INK),
            ("  ·  " + entry["root_gloss"], f_root, INK)]
    _center_mixed(d, segs, S(740), W)

    # the Qur'anic turn
    _center(d, entry["line1"], f_line, INK, S(858), W)
    _center(d, entry["ayah"], f_ayah, INK, S(940), W)
    _center(d, entry["citation"], f_cite, SOFT, S(1024), W)

    # brand
    d.line([(W // 2 - S(26), H - S(120)), (W // 2 + S(26), H - S(120))], fill=GOLD, width=max(2, S(2)))
    _center(d, "K E T A B I   S T U D I O", f_tag, MARK, H - S(102), W, ls=S(3))

    im.save(out_path)
    return out_path

NOOR = {
    "tag": "A Name Written Into the Qur'an",
    "arabic": "نُور",
    "translit": "Noor",
    "root_letters": "ن و ر",
    "root_gloss": "to give light",
    "line1": "a word Allah chose to describe His own light",
    "ayah": "“Allah is the light of the heavens and the earth.”",
    "citation": "Surah An-Nur · 24:35",
}

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/name_noor.png"
    render_name(NOOR, out)
    print("wrote", out)
