#!/usr/bin/env python3
# Verified-Sources Du'a Deck card renderer. Premium ivory OR dark theme, gold
# Amiri, cited source ON the card. Measured vertical rhythm (no eyeballed gaps),
# auto-fits long du'as (font shrinks + wraps), renders at any print scale.
# Input is full strings; wrapping + sizing happen here. Arabic verified upstream
# (quran.com / graded hadith) — still zoom-QC each rendered card before publish.
import os, numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "worker", "fonts")
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
AMIRI = os.path.join(FONTS, "Amiri-Bold.ttf")
BW, BH = 1080, 1350  # base card size (4:5)

THEMES = {
    "ivory": dict(bg=(240, 234, 223), ink=(42, 60, 52), soft=(112, 120, 108),
                  gold=(176, 140, 66), tag=(176, 140, 66), mark=(150, 132, 96), border=(196, 170, 110)),
    "dark":  dict(bg=(20, 23, 20), ink=(238, 232, 219), soft=(150, 150, 136),
                  gold=(214, 180, 112), tag=(206, 172, 108), mark=(150, 134, 96), border=(150, 122, 60)),
}
_MEASURE = ImageDraw.Draw(Image.new("RGB", (4, 4)))

def _wrap(text, font, maxw):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if _MEASURE.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur:
                out.append(cur)
            cur = w
    if cur:
        out.append(cur)
    return out or [""]

def _fit(text, path, sizes, maxw, max_lines):
    # pick the largest font size from `sizes` (desc) whose wrap fits max_lines
    for s in sizes:
        f = ImageFont.truetype(path, s)
        lines = _wrap(text, f, maxw)
        if len(lines) <= max_lines:
            return f, lines
    f = ImageFont.truetype(path, sizes[-1])
    return f, _wrap(text, f, maxw)

def _base(theme, W, H):
    t = THEMES[theme]
    im = Image.new("RGB", (W, H), t["bg"])
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.72 * W)) ** 2 + ((yy - .44 * H) / (.60 * H)) ** 2
    if theme == "dark":
        glow = np.clip(1 - np.clip(d, 0, 1), 0, 1)[..., None]
        a[..., 0] += glow[..., 0] * 14; a[..., 1] += glow[..., 0] * 11; a[..., 2] += glow[..., 0] * 6
        vig = np.clip(1 - 0.55 * np.clip(d, 0, 1), 0.35, 1)[..., None]
        a = a * vig + np.random.default_rng(5).normal(0, 4.5, (H, W, 1))
    else:
        vig = np.clip(1 - 0.09 * np.clip(d, 0, 1), 0.91, 1)[..., None]
        a = a * vig + np.random.default_rng(3).normal(0, 3.2, (H, W, 1))
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    bw = max(2, round(2 * (W / BW)))
    ImageDraw.Draw(im).rectangle([round(46 * W / BW), round(46 * H / BH), W - round(46 * W / BW), H - round(46 * H / BH)],
                                 outline=t["border"], width=bw)
    return im

def _bh(lines, font, lg):
    asc, desc = font.getmetrics()
    return int(font.size * lg) * (len(lines) - 1) + asc + desc

def _draw(d, lines, font, fill, top, lg, W, ls=0):
    lh = int(font.size * lg); y = top
    for ln in lines:
        if ls:
            wd = sum(d.textlength(c, font=font) + ls for c in ln) - ls; x = (W - wd) / 2
            for c in ln:
                d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + ls
        else:
            wd = d.textlength(ln, font=font); d.text(((W - wd) / 2, y), ln, font=font, fill=fill)
        y += lh
    return top + _bh(lines, font, lg)

def render_card(entry, out_path, theme="ivory", sc=1.0):
    """entry: {tag, arabic, translit, translation, source} as STRINGS."""
    W, H = round(BW * sc), round(BH * sc)
    t = THEMES[theme]; GOLD, INK, SOFT = t["gold"], t["ink"], t["soft"]
    def S(x): return round(x * sc)
    im = _base(theme, W, H); d = ImageDraw.Draw(im)

    f_tag = ImageFont.truetype(PLAY, S(24))
    f_ar, ar = _fit(entry["arabic"], AMIRI, [S(n) for n in (60, 54, 48, 42, 37, 33)], W - S(180), 3)
    f_tr, tr = _fit(entry["translit"], PLAY_IT, [S(n) for n in (42, 38, 34, 31)], W - S(200), 4)
    f_en, en = _fit(entry["translation"], PLAY_IT, [S(n) for n in (46, 42, 38, 34)], W - S(200), 4)
    f_src, src = _fit(entry["source"], PLAY, [S(n) for n in (26, 24, 22)], W - S(260), 4)

    _draw(d, [entry["tag"]], f_tag, t["tag"], S(100), 1.0, W, ls=S(4))

    GAP_AR, GAP_TR, GAP_DIV, GAP_SRC = S(64), S(34), S(58), S(58)
    blocks = [(ar, f_ar, GOLD, 1.5, GAP_AR), (tr, f_tr, INK, 1.28, GAP_TR), (en, f_en, INK, 1.28, GAP_DIV)]
    hts = [_bh(b[0], b[1], b[3]) for b in blocks]
    src_h = _bh(src, f_src, 1.34)
    total = sum(hts) + GAP_AR + GAP_TR + GAP_DIV + 2 + GAP_SRC + src_h
    top, bot = S(150), H - S(165)
    y = top + ((bot - top) - total) / 2
    for (lines, font, fill, lg, gap), h in zip(blocks, hts):
        _draw(d, lines, font, fill, y, lg, W); y += h + gap
    d.line([(W // 2 - S(34), int(y)), (W // 2 + S(34), int(y))], fill=GOLD, width=max(2, S(2)))
    y += 2 + GAP_SRC
    _draw(d, src, f_src, SOFT, y, 1.34, W)

    d.line([(W // 2 - S(26), H - S(120)), (W // 2 + S(26), H - S(120))], fill=GOLD, width=max(2, S(2)))
    txt = "K E T A B I   S T U D I O"
    wd = sum(d.textlength(c, font=f_tag) + S(3) for c in txt) - S(3); x = (W - wd) / 2
    for c in txt:
        d.text((x, H - S(102)), c, font=f_tag, fill=t["mark"]); x += d.textlength(c, font=f_tag) + S(3)
    im.save(out_path)
    return out_path

SAMPLE = {
    "tag": "FOR WHEN THE WALLS CLOSE IN",
    "arabic": "لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
    "translit": "La ilaha illa Anta, subhanaka, inni kuntu mina az-zalimin.",
    "translation": "There is no god but You. Glory be to You. I was among the wrongdoers.",
    "source": "Qur'an 21:87 (du'a of Yunus). Jami' at-Tirmidhi 3505.",
}

if __name__ == "__main__":
    render_card(SAMPLE, "/tmp/dua_test.png", theme="ivory", sc=1.0)
    print("rendered")
