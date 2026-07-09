#!/usr/bin/env python3
# "From One Root" 30-day journal renderer. US Letter at 200dpi (1700x2200),
# premium ivory, gold Amiri root letters. Each day = a root STORY page + a
# WRITING page (prompts + ruled lines). Every root's etymology is verified
# upstream (insight-bank + adversarial passes) — zoom-QC Arabic per render.
# Voice rules apply to all copy: no em dashes, His/Him capitalized.
import os, numpy as np
from PIL import Image, ImageDraw, ImageFont

_HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(_HERE, "..", "..", "worker", "fonts")
PLAY    = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
AMIRI   = os.path.join(FONTS, "Amiri-Bold.ttf")
PW, PH = 1700, 2200  # US Letter @200dpi

BG   = (242, 237, 227)
INK  = (48, 58, 50)
SOFT = (118, 122, 108)
GOLD = (172, 138, 66)
MARK = (152, 134, 98)
RULE = (196, 188, 170)
BORDER = (200, 176, 118)

_M = ImageDraw.Draw(Image.new("RGB", (4, 4)))

def _wrap(text, font, maxw):
    out = []
    for para in text.split("\n"):
        cur = ""
        for w in para.split():
            t = (cur + " " + w).strip()
            if _M.textlength(t, font=font) <= maxw:
                cur = t
            else:
                out.append(cur); cur = w
        out.append(cur)
    return out or [""]

def _base():
    im = Image.new("RGB", (PW, PH), BG)
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:PH, 0:PW].astype(np.float32)
    d = ((xx - .5 * PW) / (.8 * PW)) ** 2 + ((yy - .46 * PH) / (.72 * PH)) ** 2
    a = a * np.clip(1 - 0.06 * np.clip(d, 0, 1), 0.94, 1)[..., None] + np.random.default_rng(3).normal(0, 2.4, (PH, PW, 1))
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    ImageDraw.Draw(im).rectangle([70, 70, PW - 70, PH - 70], outline=BORDER, width=2)
    return im

def _center(d, t, f, fill, y, ls=0):
    if ls:
        wd = sum(d.textlength(c, font=f) + ls for c in t) - ls
        x = (PW - wd) / 2
        for c in t:
            d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls
    else:
        d.text(((PW - d.textlength(t, font=f)) / 2, y), t, font=f, fill=fill)

def _block(d, lines, f, fill, y, lg=1.42, align="center", x0=170):
    lh = int(f.size * lg)
    for ln in lines:
        if align == "center":
            d.text(((PW - d.textlength(ln, font=f)) / 2, y), ln, font=f, fill=fill)
        else:
            d.text((x0, y), ln, font=f, fill=fill)
        y += lh
    return y

DAY_WORDS = ["ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN",
    "ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN","SEVENTEEN",
    "EIGHTEEN","NINETEEN","TWENTY","TWENTY-ONE","TWENTY-TWO","TWENTY-THREE",
    "TWENTY-FOUR","TWENTY-FIVE","TWENTY-SIX","TWENTY-SEVEN","TWENTY-EIGHT",
    "TWENTY-NINE","THIRTY"]

def render_story_page(day, e, out):
    """e: {letters, translit, gloss, story, anchor, citation}"""
    im = _base(); d = ImageDraw.Draw(im)
    f_day  = ImageFont.truetype(PLAY, 34)
    f_ar   = ImageFont.truetype(AMIRI, 300)
    f_tr   = ImageFont.truetype(PLAY_IT, 84)
    f_gl   = ImageFont.truetype(PLAY_IT, 52)
    f_st   = ImageFont.truetype(PLAY, 52)
    f_an   = ImageFont.truetype(PLAY_IT, 54)
    f_ci   = ImageFont.truetype(PLAY, 38)
    _center(d, f"DAY {DAY_WORDS[day-1]}", f_day, GOLD, 165, ls=10)
    # root letters, gold, placed by true bbox
    bb = d.textbbox((0, 0), e["letters"], font=f_ar)
    d.text(((PW - (bb[2] - bb[0])) / 2 - bb[0], 330 - bb[1]), e["letters"], font=f_ar, fill=GOLD)
    _center(d, e["translit"], f_tr, INK, 780)
    _center(d, e["gloss"], f_gl, SOFT, 905)
    d.line([(PW//2 - 60, 1030), (PW//2 + 60, 1030)], fill=GOLD, width=3)
    y = _block(d, _wrap(e["story"], f_st, PW - 420), f_st, INK, 1110)
    y += 60
    y = _block(d, _wrap(e["anchor"], f_an, PW - 440), f_an, INK, y)
    y += 34
    _center(d, e["citation"], f_ci, SOFT, y)
    _center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH - 150, ls=6)
    im.save(out); return out

def render_writing_page(day, e, out):
    """e: {prompts: [str, ...]} — prompts + ruled lines, fully MEASURED:
    - TOP-ANCHORED: prompts start right under the day header, so spare space
      becomes writing room instead of padding above the first prompt.
    - Rule pitch 68px = 8.6mm at 200dpi (WIDE-rule standard, roomy for a
      normal adult hand; the owner found 7.4mm college rule too tight).
    - Lines are solved as a page TOTAL then distributed across prompts
      (earlier prompts take the remainder), so no usable rows are lost to
      per-prompt rounding. Overflow is asserted, never eyeballed."""
    im = _base(); d = ImageDraw.Draw(im)
    f_day = ImageFont.truetype(PLAY, 30)
    f_pr  = ImageFont.truetype(PLAY_IT, 43)
    _center(d, f"DAY {DAY_WORDS[day-1]}  ·  {e['translit'].upper()}", f_day, GOLD, 150, ls=6)
    n = len(e["prompts"])
    TOP, BOTTOM = 258, PH - 190      # last rule clears the footer mark comfortably
    LH = int(43 * 1.32)              # prompt line height
    G_P = 34                         # prompt -> its first rule (answer starts close)
    LINE_SP = 68                     # 8.6mm ruled pitch (wide rule)
    G_AFTER = 54                     # rest between a prompt's lines and the next ask
    wraps = [_wrap(p, f_pr, PW - 400) for p in e["prompts"]]
    fixed = sum(len(w) * LH for w in wraps) + n * G_P + (n - 1) * G_AFTER
    total_lines = max(n * 4, min(n * 9, (BOTTOM - TOP - fixed) // LINE_SP))
    base, extra = divmod(total_lines, n)
    per = [base + (1 if i < extra else 0) for i in range(n)]
    y = TOP
    for i, w in enumerate(wraps):
        y = _block(d, w, f_pr, INK, y, lg=1.32)
        y += G_P
        for _ in range(per[i]):
            d.line([(200, int(y)), (PW - 200, int(y))], fill=RULE, width=2)
            y += LINE_SP
        if i < n - 1:
            y += G_AFTER
    assert y - LINE_SP <= PH - 185, f"writing page overflow day {day}: y={y}"
    _center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH - 150, ls=6)
    im.save(out); return out

# ---- Day 1 sample (rahma; verified: Tirmidhi 1907 sahih + corpus roots) ----
DAY1 = {
    "letters": "ر ح م",
    "translit": "rahma",
    "gloss": "mercy · and the womb",
    # NOTE: no ﷺ glyph in Latin body text (Playfair renders it as tofu) —
    # write "peace be upon him" in journal prose.
    "story": ("Before you knew a single word, you lived inside one. The womb in "
        "Arabic is rahim. Mercy is rahma. One root holds them both, and the "
        "Prophet, peace be upon him, related that Allah created the womb and "
        "derived its name from His own Name, Ar-Rahman. Your first home was "
        "named after His mercy. You have never been anywhere it could not reach."),
    "anchor": "“My mercy encompasses all things.”",
    "citation": "Qur'an 7:156  ·  Jami' at-Tirmidhi 1907 (sahih)",
    "prompts": [
        "Mercy was your first address. Write about a time you felt held by something you could not see.",
        "Who carried you the way a womb carries? Write them one sentence of gratitude here, then send it to them today.",
        "What would this week look like if you were certain His mercy surrounds you the way it once did?",
    ],
}

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
    render_story_page(1, DAY1, f"{out}/j_day1_story.png")
    render_writing_page(1, DAY1, f"{out}/j_day1_write.png")
    print("rendered day 1 spread")
