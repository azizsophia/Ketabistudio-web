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

def _wrap(text, font, maxw):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if _M.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur:
                out.append(cur)
            cur = w
    if cur:
        out.append(cur)
    return out or [""]

def _fit(text, path, sizes, maxw, max_lines):
    for s in sizes:
        f = ImageFont.truetype(path, s)
        lines = _wrap(text, f, maxw)
        if len(lines) <= max_lines:
            return f, lines
    f = ImageFont.truetype(path, sizes[-1])
    return f, _wrap(text, f, maxw)

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
       root_gloss, line1, ayah, citation. root_letters/root_gloss may be '' for
       'in'-tier names (name literally in the Qur'an) — the root line is skipped."""
    W, H = round(BW * sc), round(BH * sc)
    def S(x): return round(x * sc)
    im = _base(W, H); d = ImageDraw.Draw(im)
    has_root = bool(entry.get("root_letters"))

    f_tag  = ImageFont.truetype(PLAY, S(24))
    f_name = ImageFont.truetype(AMIRI, S(150))
    f_tr   = ImageFont.truetype(PLAY_IT, S(64))
    f_root = ImageFont.truetype(PLAY_IT, S(40))
    f_rootA= ImageFont.truetype(AMIRI, S(40))     # root letters in Amiri
    f_cite = ImageFont.truetype(PLAY, S(30))
    maxw   = W - S(180)
    has_ayah = bool(entry.get("ayah"))
    has_cite = bool(entry.get("citation"))
    has_line = bool(entry.get("line1"))
    # auto-fit the wrapping lines so nothing runs past the border
    f_line, line1 = _fit(entry.get("line1") or " ", PLAY_IT, [S(n) for n in (42, 38, 34)], maxw, 2)
    f_ayah, ayah  = _fit(entry.get("ayah") or " ",  PLAY_IT, [S(n) for n in (46, 42, 38, 34, 30)], maxw, 3)

    # header tag + brand (fixed anchors)
    _center(d, entry["tag"].upper(), f_tag, TAG, S(104), W, ls=S(5))
    d.line([(W // 2 - S(26), H - S(120)), (W // 2 + S(26), H - S(120))], fill=GOLD, width=max(2, S(2)))
    _center(d, "K E T A B I   S T U D I O", f_tag, MARK, H - S(102), W, ls=S(3))

    # --- measured content stack, vertically centered between tag and brand ---
    def th(lines, font, lg=1.28):
        asc, desc = font.getmetrics()
        return int(font.size * lg) * (len(lines) - 1) + asc + desc
    nb = d.textbbox((0, 0), entry["arabic"], font=f_name)
    name_h = nb[3] - nb[1]
    tr_h   = th([entry["translit"]], f_tr, 1.0)
    l1_h   = th(line1, f_line)
    ay_h   = th(ayah, f_ayah)
    cite_h = th([entry["citation"]], f_cite, 1.0) if has_cite else 0

    G_NAME, G_TR, G_DIV, G_ROOT, G_L1, G_AY = S(52), S(40), S(40), S(48), S(30), S(44)
    root_h = th([entry.get("root_gloss") or "x"], f_root, 1.0) if has_root else 0
    stack = name_h + G_NAME + tr_h + G_TR + 2 + G_DIV
    if has_root:
        stack += root_h + G_ROOT
    if has_line:
        stack += l1_h + G_L1
    if has_ayah:
        stack += ay_h + G_AY
    if has_cite:
        stack += cite_h

    top = S(150); bot = H - S(165)
    y = top + ((bot - top) - stack) / 2

    # Arabic name (gold), placed by true glyph bbox so harakat never clip
    d.text(((W - (nb[2] - nb[0])) / 2 - nb[0], y - nb[1]), entry["arabic"], font=f_name, fill=GOLD)
    y += name_h + G_NAME
    _center(d, entry["translit"], f_tr, INK, y, W); y += tr_h + G_TR
    d.line([(W // 2 - S(34), int(y)), (W // 2 + S(34), int(y))], fill=GOLD, width=max(2, S(2)))
    y += 2 + G_DIV
    if has_root:
        segs = [("from the root  ", f_root, INK),
                (entry["root_letters"], f_rootA, INK)]
        if entry.get("root_gloss"):
            segs.append(("  ·  " + entry["root_gloss"], f_root, INK))
        _center_mixed(d, segs, y, W); y += root_h + G_ROOT
    if has_line:
        _draw_block(d, line1, f_line, INK, y, W); y += l1_h + G_L1
    if has_ayah:
        _draw_block(d, ayah, f_ayah, INK, y, W);  y += ay_h + G_AY
    if has_cite:
        _center(d, entry["citation"], f_cite, SOFT, y, W)

    im.save(out_path)
    return out_path

def _draw_block(d, lines, font, fill, top, W, lg=1.28):
    lh = int(font.size * lg); y = top
    for ln in lines:
        _center(d, ln, font, fill, y, W); y += lh

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
