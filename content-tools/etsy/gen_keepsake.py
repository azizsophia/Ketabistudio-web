#!/usr/bin/env python3
# Personalized keepsake print renderer (Hajj Mabrur, Qur'an teacher, etc.).
# Premium ivory/dark, gold Amiri hadith (auto-fit + wrap), cited source ON the
# card, plus a PERSONALIZED dedication line (the made-to-order element: a name,
# a year). Arabic verified upstream (sunnah.com) — still zoom-QC every render.
import os, numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "worker", "fonts")
PLAY    = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
AMIRI   = os.path.join(FONTS, "Amiri-Bold.ttf")
BW, BH = 1080, 1350

THEMES = {
    "ivory": dict(bg=(240, 234, 223), ink=(42, 60, 52), soft=(112, 120, 108),
                  gold=(176, 140, 66), mark=(150, 132, 96), border=(196, 170, 110)),
    "dark":  dict(bg=(20, 23, 20), ink=(238, 232, 219), soft=(150, 150, 136),
                  gold=(214, 180, 112), mark=(150, 134, 96), border=(150, 122, 60)),
}
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

def _base(theme, W, H):
    t = THEMES[theme]
    im = Image.new("RGB", (W, H), t["bg"])
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.72 * W)) ** 2 + ((yy - .44 * H) / (.60 * H)) ** 2
    if theme == "dark":
        glow = np.clip(1 - np.clip(d, 0, 1), 0, 1)[..., None]
        a[..., 0] += glow[..., 0] * 14; a[..., 1] += glow[..., 0] * 11; a[..., 2] += glow[..., 0] * 6
        a = a * np.clip(1 - 0.55 * np.clip(d, 0, 1), 0.35, 1)[..., None] + np.random.default_rng(5).normal(0, 4.5, (H, W, 1))
    else:
        a = a * np.clip(1 - 0.09 * np.clip(d, 0, 1), 0.91, 1)[..., None] + np.random.default_rng(3).normal(0, 3.2, (H, W, 1))
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

def render_keepsake(entry, out_path, theme="ivory", sc=1.0):
    """entry: {tag, arabic, translit, translation, source, dedication}.
    dedication is the personalized line (e.g. 'For Ustadha Aisha')."""
    W, H = round(BW * sc), round(BH * sc)
    t = THEMES[theme]; GOLD, INK, SOFT = t["gold"], t["ink"], t["soft"]
    def S(x): return round(x * sc)
    im = _base(theme, W, H); d = ImageDraw.Draw(im)

    f_tag = ImageFont.truetype(PLAY, S(24))
    f_ar, ar = _fit(entry["arabic"], AMIRI, [S(n) for n in (60, 54, 48, 42, 37, 33)], W - S(170), 3)
    f_tr, tr = _fit(entry["translit"], PLAY_IT, [S(n) for n in (40, 36, 32, 29)], W - S(200), 4)
    f_en, en = _fit(entry["translation"], PLAY_IT, [S(n) for n in (46, 42, 38, 34)], W - S(190), 4)
    f_src, src = _fit(entry["source"], PLAY, [S(n) for n in (26, 24, 22)], W - S(260), 3)
    ded = entry.get("dedication", "")
    f_ded, dedl = _fit(ded, PLAY_IT, [S(n) for n in (40, 36, 32)], W - S(220), 2) if ded else (None, [])

    _draw(d, [entry["tag"].upper()], f_tag, GOLD, S(104), 1.0, W, ls=S(5))

    GAP_AR, GAP_TR, GAP_DIV, GAP_SRC, GAP_DED = S(60), S(32), S(54), S(50), S(46)
    blocks = [(ar, f_ar, GOLD, 1.5, GAP_AR), (tr, f_tr, INK, 1.28, GAP_TR), (en, f_en, INK, 1.3, GAP_DIV)]
    hts = [_bh(b[0], b[1], b[3]) for b in blocks]
    src_h = _bh(src, f_src, 1.34)
    ded_h = (_bh(dedl, f_ded, 1.3) + GAP_DED) if ded else 0
    total = sum(hts) + GAP_AR + GAP_TR + GAP_DIV + 2 + GAP_SRC + src_h + ded_h
    top, bot = S(150), H - S(150)
    y = top + ((bot - top) - total) / 2
    for (lines, font, fill, lg, gap), h in zip(blocks, hts):
        _draw(d, lines, font, fill, y, lg, W); y += h + gap
    d.line([(W // 2 - S(34), int(y)), (W // 2 + S(34), int(y))], fill=GOLD, width=max(2, S(2)))
    y += 2 + GAP_SRC
    _draw(d, src, f_src, SOFT, y, 1.34, W); y += src_h
    if ded:
        y += GAP_DED
        _draw(d, dedl, f_ded, INK, y, 1.3, W)

    d.line([(W // 2 - S(26), H - S(120)), (W // 2 + S(26), H - S(120))], fill=GOLD, width=max(2, S(2)))
    txt = "K E T A B I   S T U D I O"
    wd = sum(d.textlength(c, font=f_tag) + S(3) for c in txt) - S(3); x = (W - wd) / 2
    for c in txt:
        d.text((x, H - S(102)), c, font=f_tag, fill=t["mark"]); x += d.textlength(c, font=f_tag) + S(3)
    im.save(out_path)
    return out_path

# ---- verified content (hadith checked vs sunnah.com; see verify pass) ----
TEACHER = {
    "tag": "For the one who teaches the Qur'an",
    "arabic": "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    "translit": "Khayrukum man ta'allama al-Qur'ana wa 'allamahu",
    "translation": "“The best of you are those who learn the Qur'an and teach it.”",
    "source": "Sahih al-Bukhari 5027",
    "dedication": "With gratitude, for Ustadha Aisha",
}
HAJJ = {
    "tag": "Hajj Mabrūr",
    "arabic": "الْحَجُّ الْمَبْرُورُ لَيْسَ لَهُ جَزَاءٌ إِلَّا الْجَنَّةُ",
    "translit": "Al-hajju al-mabruru laysa lahu jazaa'un illa al-jannah",
    "translation": "“The accepted Hajj has no reward except Paradise.”",
    "source": "Sahih al-Bukhari 1773 · Sahih Muslim 1349",
    "dedication": "For Ahmad · Hajj 1447 AH",
}

BIRTH = {
    "tag": "A Gift From Allah",
    "arabic": "رَبِّ هَبْ لِي مِنَ الصَّالِحِينَ",
    "translit": "Rabbi hab li mina as-salihin",
    "translation": "“My Lord, grant me a child from among the righteous.”",
    "source": "Qur'an 37:100 · the du'a of Ibrahim",
    "dedication": "Ahmad · born 12 Rajab 1447",
}
HOME = {
    "tag": "A Blessed Home",
    "arabic": "رَبِّ أَنْزِلْنِي مُنْزَلًا مُبَارَكًا وَأَنْتَ خَيْرُ الْمُنْزِلِينَ",
    "translit": "Rabbi anzilni munzalan mubarakan wa anta khayru al-munzilin",
    "translation": "“My Lord, cause me to land at a blessed landing place, for You are the best to accommodate.”",
    "source": "Qur'an 23:29",
    "dedication": "The Yusuf Family · est. 2026",
}
PROTECT = {  # ungendered, verbatim (Muslim 2708) — safe default for one child
    "tag": "Under Allah's Protection",
    "arabic": "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
    "translit": "A'udhu bikalimatillahi at-tammati min sharri ma khalaq",
    "translation": "“I seek refuge in the perfect words of Allah from the evil of what He has created.”",
    "source": "Sahih Muslim 2708",
    "dedication": "Watch over Aisha",
}

PARENTS = {
    "tag": "A Prayer for My Parents",
    "arabic": "رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا",
    "translit": "Rabbi irhamhuma kama rabbayani saghira",
    "translation": "“My Lord, have mercy upon them as they raised me when I was small.”",
    "source": "Qur'an 17:24",
    "dedication": "For Mama & Baba",
}
WEDDING = {
    "tag": "Mawaddah wa Rahmah",
    "arabic": "وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً",
    "translit": "wa ja'ala baynakum mawaddatan wa rahmah",
    "translation": "“and He placed between you love and mercy.”",
    "source": "Qur'an 30:21",
    "dedication": "Ahmad & Aisha · 2026",
}
GETWELL = {
    "tag": "A Prayer for Your Healing",
    "arabic": "لَا بَأْسَ طَهُورٌ إِنْ شَاءَ اللَّهُ",
    "translit": "La ba'sa, tahurun in sha Allah",
    "translation": "“No harm, it is a purification, if Allah wills.”",
    "source": "Sahih al-Bukhari 5656",
    "dedication": "For Yusuf, with prayers for your shifa",
}

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
    allk = [("teacher", TEACHER), ("hajj", HAJJ), ("birth", BIRTH), ("home", HOME),
            ("protect", PROTECT), ("parents", PARENTS), ("wedding", WEDDING), ("getwell", GETWELL)]
    for nm, e in allk:
        render_keepsake(e, f"{out}/keepsake_{nm}.png")
    print("rendered")
