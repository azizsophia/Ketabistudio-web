#!/usr/bin/env python3
# Three extra Threads card templates so each root gets a 4-post "root of the day"
# series (root card is gen_dictionary_card; these are the other 3 facets):
#   1. card_etymology  -> the verified `story` (where the root comes from)
#   2. card_verse      -> the verified `anchor` quote + citation (in the Qur'an)
#   3. card_prompt     -> one reflection `prompt` (a question, drives replies)
# Same paper/ink palette, header and footer as the dictionary card, so the daily
# set reads as one cohesive editorial spread. All content is verified journal_data.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_dictionary_card as G
from PIL import Image, ImageDraw, ImageFont

D = os.path.dirname(os.path.abspath(__file__))
F = G.F
W, H = G.W, G.H
PAPER, INK, FAINT, ACCENT = G.PAPER, G.INK, G.FAINT, G.ACCENT
M = 96
SANS, AMIRI, LORA = G.SANS, G.AMIRI, G.LORA
ITAL = os.path.join(F, "Cormorant-Italic.ttf")


def _header(d, num):
    f = ImageFont.truetype(SANS, 20)
    G._sp(d, "KETABI  ·  A LIVING DICTIONARY", f, FAINT, M, 84, 4, "l")
    G._sp(d, f"N.º {num:02d}", f, FAINT, W - M, 84, 4, "r")
    d.line([(M, 128), (W - M, 128)], fill=INK, width=2)


def _footer(d, cite):
    f_tag = ImageFont.truetype(ITAL, 40)
    tag = "the language of the Qur'an, one root at a time"
    d.text(((W - d.textlength(tag, font=f_tag)) / 2, H - 210), tag, font=f_tag, fill=(96, 90, 80))
    d.line([(M, H - 150), (W - M, H - 150)], fill=INK, width=2)
    f_cite = ImageFont.truetype(SANS, 20)
    G._sp(d, cite, f_cite, FAINT, M, H - 128, 2, "l")
    G._sp(d, "KETABISTUDIO.COM", f_cite, FAINT, W - M, H - 128, 2, "r")


def _kicker(d, text, y):
    G._sp(d, text, ImageFont.truetype(SANS, 24), ACCENT, W / 2, y, 8)


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


def _fit_block(d, text, fontpath, fill, top_y, bottom_y, sizes, lh=1.5, maxw=None):
    """Pick the largest font from `sizes` (desc) whose wrapped block fits between
    top_y and bottom_y, then draw it centred within that region. Returns bottom y."""
    if maxw is None:
        maxw = W - 2 * M - 10
    chosen = None
    for s in sizes:
        f = ImageFont.truetype(fontpath, s)
        lines = _wrap(d, text, f, maxw)
        gap = s * lh
        h = gap * len(lines)
        if top_y + h <= bottom_y:
            chosen = (f, lines, gap, h); break
    if chosen is None:
        s = sizes[-1]; f = ImageFont.truetype(fontpath, s)
        lines = _wrap(d, text, f, maxw); gap = s * lh; h = gap * len(lines)
        chosen = (f, lines, gap, h)
    f, lines, gap, h = chosen
    cy = (top_y + bottom_y) / 2
    y = cy - h / 2 + gap * 0.15
    for t in lines:
        d.text(((W - d.textlength(t, font=f)) / 2, y), t, font=f, fill=fill); y += gap
    return y


def _small_root(d, letters, translit, cy):
    """the 3 root letters small + translit, centred, as a masthead device."""
    al = letters.split(); nL = len(al); gap = 118
    f_root = ImageFont.truetype(AMIRI, 108)
    xs = [W / 2 + gap * (k - (nL - 1) / 2) for k in range(nL)]
    maxbot = cy
    for k in range(nL):
        x = xs[nL - 1 - k]; w = d.textlength(al[k], font=f_root)
        d.text((x - w / 2, cy), al[k], font=f_root, fill=INK)
        maxbot = max(maxbot, d.textbbox((x - w / 2, cy), al[k], font=f_root)[3])
    f_tr = ImageFont.truetype(SANS, 26); f_mark = ImageFont.truetype(SANS, 38)
    tl = [t.strip() for t in translit.split("·")]
    for k in range(nL):
        ch = tl[k].upper()
        if ch == "'":
            G._sp(d, "’", f_mark, ACCENT, xs[nL - 1 - k], maxbot + 8, 0)
        else:
            G._sp(d, ch, f_tr, ACCENT, xs[nL - 1 - k], maxbot + 18, 3)
    return maxbot + 60


def card_etymology(day, translit, num, out):
    im = G.paper(); d = ImageDraw.Draw(im)
    _header(d, num)
    _kicker(d, "WHERE THE WORD BEGINS", 200)
    bot = _small_root(d, day["letters"], translit, 268)
    G._sp(d, day["translit"].split("·")[0].strip().upper(), ImageFont.truetype(LORA, 46), INK, W / 2, bot + 8, 4)
    _fit_block(d, day["story"], LORA, (52, 48, 43), bot + 78, H - 236,
               [40, 38, 36, 34, 32, 30, 28], lh=1.52, maxw=W - 2 * M - 20)
    _footer(d, day["citation"].split("·")[0].strip())
    im.save(out, quality=95); return out


def card_verse(day, num, out):
    im = G.paper(); d = ImageDraw.Draw(im)
    _header(d, num)
    _kicker(d, "IN THE QUR'AN", 300)
    quote = day["anchor"].strip()
    # strip surrounding smart/plain quotes; we set our own big glyph
    quote = quote.strip("“”‘’\"'")
    # opening quotation mark, large, above the block
    G._sp(d, "“", ImageFont.truetype(ITAL, 130), (196, 188, 174), W / 2, 360, 0)
    endy = _fit_block(d, quote, ITAL, INK, 470, H - 320, [72, 68, 64, 60, 56, 52], lh=1.24)
    G._sp(d, day["citation"], ImageFont.truetype(SANS, 24), FAINT, W / 2, endy + 40, 3)
    _footer(d, day["translit"].split("·")[0].strip() + "  ·  " + day["gloss"])
    im.save(out, quality=95); return out


def card_prompt(day, translit, num, out):
    im = G.paper(); d = ImageDraw.Draw(im)
    _header(d, num)
    _kicker(d, "SIT WITH THIS", 260)
    bot = _small_root(d, day["letters"], translit, 330)
    prompt = day["prompts"][0].strip() if day.get("prompts") else day["gloss"]
    endy = _fit_block(d, prompt, ITAL, INK, bot + 60, H - 300, [66, 62, 58, 54, 50], lh=1.26)
    d.line([(W / 2 - 46, endy + 44), (W / 2 + 46, endy + 44)], fill=ACCENT, width=3)
    _footer(d, day["translit"].split("·")[0].strip() + "  ·  " + day["gloss"])
    im.save(out, quality=95); return out


def _days():
    sys.path.insert(0, os.path.join(D, "etsy"))
    from journal_data import DAYS
    return DAYS


def build_root(day, num, outdir):
    key = day["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0]
    tr = " · ".join(G.AR_TR.get(c, c) for c in day["letters"].split())
    e = card_etymology(day, tr, num, os.path.join(outdir, f"th_{num:02d}_{key}_2etym.jpg"))
    v = card_verse(day, num, os.path.join(outdir, f"th_{num:02d}_{key}_3verse.jpg"))
    p = card_prompt(day, tr, num, os.path.join(outdir, f"th_{num:02d}_{key}_4prompt.jpg"))
    return {"etym": e, "verse": v, "prompt": p}


if __name__ == "__main__":
    outdir = os.path.join(D, "_threads_extra"); os.makedirs(outdir, exist_ok=True)
    DAYS = _days()
    i = int(sys.argv[1]) if len(sys.argv) > 1 else 3  # default fitra (day 3)
    r = build_root(DAYS[i - 1], i, outdir)
    print("wrote", r)
