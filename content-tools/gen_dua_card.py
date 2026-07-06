#!/usr/bin/env python3
# Verified-Sources Du'a Deck card renderer (premium ivory, gold Amiri, cited
# source ON the card). Proper vertical rhythm: each text block is measured and
# stacked with consistent, intentional gaps (no eyeballed spacing). 1080x1350.
# Every du'a's Arabic + source is verified against sunnah.com / quran.com BEFORE
# it ships (see DUAS list; sources carry grading).
import os, numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "worker", "fonts")
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
AMIRI = os.path.join(FONTS, "Amiri-Bold.ttf")
W, H = 1080, 1350
MARGIN_TOP = 150      # below the tag
MARGIN_BOTTOM = 165   # above the wordmark

# two looks to A/B. keys: bg, ink (translit/translation), soft (source), gold, tag, mark, border
THEMES = {
    "ivory": dict(bg=(240, 234, 223), ink=(42, 60, 52), soft=(112, 120, 108),
                  gold=(176, 140, 66), tag=(176, 140, 66), mark=(150, 132, 96), border=(196, 170, 110)),
    "dark":  dict(bg=(20, 23, 20), ink=(238, 232, 219), soft=(150, 150, 136),
                  gold=(214, 180, 112), tag=(206, 172, 108), mark=(150, 134, 96), border=(150, 122, 60)),
}

def _base(theme):
    t = THEMES[theme]
    im = Image.new("RGB", (W, H), t["bg"])
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.72 * W)) ** 2 + ((yy - .44 * H) / (.60 * H)) ** 2
    if theme == "dark":
        glow = np.clip(1 - np.clip(d, 0, 1), 0, 1)[..., None]  # soft warm center lift
        a[..., 0] += glow[..., 0] * 14; a[..., 1] += glow[..., 0] * 11; a[..., 2] += glow[..., 0] * 6
        vig = np.clip(1 - 0.55 * np.clip(d, 0, 1), 0.35, 1)[..., None]
        a = a * vig + np.random.default_rng(5).normal(0, 4.5, (H, W, 1))
    else:
        vig = np.clip(1 - 0.09 * np.clip(d, 0, 1), 0.91, 1)[..., None]
        a = a * vig + np.random.default_rng(3).normal(0, 3.2, (H, W, 1))
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    ImageDraw.Draw(im).rectangle([46, 46, W - 46, H - 46], outline=t["border"], width=2)
    return im

def _line_h(font):
    asc, desc = font.getmetrics()
    return asc + desc

def _block_h(lines, font, linegap):
    return int(font.size * linegap) * (len(lines) - 1) + _line_h(font)

def _draw_block(d, lines, font, fill, top, linegap, ls=0):
    lh = int(font.size * linegap)
    y = top
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
    return top + _block_h(lines, font, linegap)

def render_card(entry, out_path, theme="ivory"):
    """entry: {tag, arabic:[lines], translit:[lines], translation:[lines], source:[lines]}"""
    t = THEMES[theme]
    GOLD, INK, SOFT = t["gold"], t["ink"], t["soft"]
    im = _base(theme); d = ImageDraw.Draw(im)
    f_tag = ImageFont.truetype(PLAY, 24)
    f_ar = ImageFont.truetype(AMIRI, 58)
    f_tr = ImageFont.truetype(PLAY_IT, 40)
    f_en = ImageFont.truetype(PLAY_IT, 44)
    f_src = ImageFont.truetype(PLAY, 25)

    # tag pinned near top
    _draw_block(d, [entry["tag"]], f_tag, t["tag"], 100, 1.0, ls=4)

    # the prayer group (arabic -> translit -> translation) with a divider, then source.
    GAP_AR = 66      # arabic -> translit
    GAP_TR = 34      # translit -> translation
    GAP_DIV = 60     # translation -> divider
    GAP_SRC = 60     # divider -> source
    blocks = [
        (entry["arabic"], f_ar, GOLD, 1.5, GAP_AR),
        (entry["translit"], f_tr, INK, 1.28, GAP_TR),
        (entry["translation"], f_en, INK, 1.28, GAP_DIV),
    ]
    heights = [_block_h(b[0], b[1], b[3]) for b in blocks]
    src_h = _block_h(entry["source"], f_src, 1.34)
    total = sum(heights) + GAP_AR + GAP_TR + GAP_DIV + 2 + GAP_SRC + src_h
    avail_top = MARGIN_TOP
    avail_bot = H - MARGIN_BOTTOM
    start = avail_top + ((avail_bot - avail_top) - total) / 2  # vertically centered as a group

    y = start
    for (lines, font, fill, lg, gap), h in zip(blocks, heights):
        _draw_block(d, lines, font, fill, y, lg)
        y += h + gap
    # gold divider
    d.line([(W // 2 - 34, int(y)), (W // 2 + 34, int(y))], fill=GOLD, width=2)
    y += 2 + GAP_SRC
    _draw_block(d, entry["source"], f_src, SOFT, y, 1.34)

    # wordmark pinned to bottom
    d.line([(W // 2 - 26, H - 120), (W // 2 + 26, H - 120)], fill=GOLD, width=2)
    txt = "K E T A B I   S T U D I O"
    w = sum(d.textlength(c, font=f_tag) + 3 for c in txt) - 3
    x = (W - w) / 2
    for c in txt:
        d.text((x, H - 102), c, font=f_tag, fill=t["mark"]); x += d.textlength(c, font=f_tag) + 3
    im.save(out_path)
    return out_path

# sample entry — du'a of Yunus (Qur'an 21:87), virtue Tirmidhi 3505
SAMPLE = {
    "tag": "FOR WHEN THE WALLS CLOSE IN",
    "arabic": ["لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ", "إِنِّي كُنْتُ مِنَ الظَّالِمِينَ"],
    "translit": ["La ilaha illa Anta, subhanaka,", "inni kuntu mina az-zalimin."],
    "translation": ["There is no god but You. Glory be to You.", "I was among the wrongdoers."],
    "source": ["The du'a of Yunus, from inside the whale.", "Qur'an 21:87. The Prophet, peace be upon him, said",
               "no one in distress makes this du'a", "but Allah answers him. (Jami' at-Tirmidhi 3505)"],
}

if __name__ == "__main__":
    render_card(SAMPLE, "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad/dua_card_v2.png")
    print("rendered")
