#!/usr/bin/env python3
# Ketabi ayah wallpapers v2 — aimed at the owner's winning Pinterest refs:
#   - REAL photography (Pexels, free commercial license), globally FADED
#     cinematic grade (deep, low contrast) so type never fights the image
#   - text is a WHISPER: small delicate Arabic with harakat, tiny italic
#     translation, tracked citation
#   - AUTO-PLACEMENT: the renderer scans the graded photo for the calmest,
#     darkest horizontal band that fits the text stack and places it there
#     (measured, per photo). If no band is dark enough, a full-width linear
#     fade (never a radial blob) deepens the chosen zone just enough.
# Verses verified against quran.com; translations Clear Quran verbatim.
# QC gates: centering <=3px, safe margins, zone luminance + variance ceilings.
#
# PHOTO POLICY (owner-set, checked by hand for EVERY photo before it enters
# the library — no exceptions):
#   1. Premium aesthetic, Islamic look, modesty always.
#   2. NO people. Only two narrow exceptions: an aesthetic prayer mat (object
#      only), or an unrecognizable SILHOUETTE of someone in salah.
#   3. Allowed subjects: nature, animals (where fitting), skies/sea/light,
#      REAL mosques and Islamic architecture. No tombs or non-Islamic
#      monuments (the Taj Mahal is a mausoleum — rejected by the owner).
#   4. Real photography only (Pexels, free commercial license). No AI imagery.
#   5. Never repeat a background across published posts.
# Every accepted photo is recorded in PHOTO_MANIFEST with its Pexels id and
# what was checked, so the library stays auditable.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

D = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(os.path.dirname(D), "worker", "fonts")
AMIRI = os.path.join(FF, "Amiri-Bold.ttf")
ARUQAA = os.path.join(FF, "ArefRuqaa-Regular.ttf")  # flowing calligraphic display (OFL)
PLAY_IT = os.path.join(FF, "PlayfairDisplay-Italic.ttf")
SANS = os.path.join(FF, "DejaVuSans.ttf")
W, H = 1080, 1920
CREAM = (242, 236, 224)
CREAM_SOFT = (222, 214, 199)
GOLD = (198, 172, 122)

# Auditable provenance for every accepted background (Pexels id -> notes).
PHOTO_MANIFEST = {
    "px_20125592.jpg": "pexels 20125592, dark sea waves, no people, APPROVED (posted 2026-07-09)",
    "px_11483167.jpg": "pexels 11483167, dark sky over sea + horizon light, no people, APPROVED",
    "px_2233416.jpg":  "pexels 2233416, ramadan lantern night, no people, APPROVED",
    "px_8522562.jpg":  "pexels 8522562, open mushaf on stand, dark bg, no people, APPROVED",
    "px_13581999.jpg": "pexels 13581999, crescent moon dusk sky, no people, APPROVED",
    "px_33410135.jpg": "pexels 33410135, minaret silhouette sunset, no people, APPROVED",
    "px_10725743.jpg": "pexels 10725743, ottoman dome at dusk behind branches, no people, APPROVED",
    "px_11514335.jpg": "pexels 11514335, mushaf on stand + tasbih, warm window light, no people, APPROVED",
    "px_1631676.jpg":  "pexels 1631676, mosque silhouette vs dark orange sky, no people, APPROVED",
    "px_17650981.jpg": "pexels 17650981, crescent between dark clouds, no people, APPROVED",
    "px_18929901.jpg": "pexels 18929901, crescent over mountain ridge, purple dusk, no people, APPROVED",
    "px_26347654.jpg": "pexels 26347654, crescent in rose-pink sky, no people, APPROVED",
    "px_34155534.jpg": "pexels 34155534, dark teal sea waves (distinct photo from 20125592), APPROVED",
    "px_8522564.jpg":  "pexels 8522564, wooden tasbih on dark cloth, object only, APPROVED",
    "px_12122210.jpg": "pexels 12122210, pale pastel dunes at dusk, no people, APPROVED (ink)",
    "px_17838430.jpg": "pexels 17838430, fog on dark rocky peaks, no people, APPROVED",
    "px_5853010.jpg":  "pexels 5853010, twin minarets at sunset, bottom third checked, no people, APPROVED",
    "px_36633067.jpg": "pexels 36633067, deep starfield / milky way, APPROVED",
    "px_17572018.jpg": "pexels 17572018, moon through branches over dark sea, no people, APPROVED",
    "px_27771787.jpg": "pexels 27771787, milky way over hillside, no people, APPROVED",
    "px_30860588.jpg": "pexels 30860588, Muscat mosque corridor + hanging lanterns, empty, APPROVED",
    "px_10910952.jpg": "pexels 10910952, moonrise over shore, empty beach checked, APPROVED",
    "px_31760137.jpg": "pexels 31760137, sun through palm silhouettes, no people, APPROVED",
    "px_38230509.jpg": "pexels 38230509, mist over green forest mountain, no people, APPROVED",
    "px_28641619.jpg": "pexels 28641619, empty forest path with light rays, no people, APPROVED",
    "px_9569734.jpg":  "pexels 9569734, moonlight on violet sea, no people, APPROVED",
    "px_37978369.jpg": "pexels 37978369, dune footprints at sunset, no people visible, APPROVED",
    "px_22819805.jpg": "pexels 22819805, Istanbul skyline red dusk over Bosphorus, distant city only, APPROVED",
    "px_13148248.jpg": "pexels 13148248, painted ottoman dome ceiling, no people, APPROVED (ink)",
    "px_3361480.jpg":  "pexels 3361480, REJECTED: Taj Mahal (mausoleum)",
    "px_5081483.jpg":  "pexels 5081483, REJECTED: Taj Mahal (mausoleum)",
    "px_15832951.jpg": "pexels 15832951, REJECTED: Taj Mahal again (mausoleum)",
    "px_16150312.jpg": "pexels 16150312, REJECTED: visible hand (no people rule)",
    "px_21086639.jpg": "pexels 21086639, REJECTED: person photographing skyline",
    "px_20143823.jpg": "pexels 20143823, REJECTED: recognizable man on prayer mat (not a silhouette)",
    "px_36211995.jpg": "pexels 36211995, REJECTED: person in sujood, face/hands visible",
    "px_7249335.jpg":  "pexels 7249335, REJECTED: three women, recognizable people",
    "px_20430054.jpg": "pexels 20430054, REJECTED: prayer mat but person's feet in frame",
    "px_36232116.jpg": "pexels 36232116, REJECTED: wet-floor caution sign kills premium look",
    "px_30831372.jpg": "pexels 30831372, REJECTED: tiny figures on dune ridge",
    "px_7263555.jpg":  "pexels 7263555, REJECTED: possible people at railing, could not clear",
    "px_15403114.jpg": "pexels 15403114, mosque interior light rays, REJECTED by owner (busy)",
    "px_18565451.jpg": "pexels 18565451, dusk mosque, benched (placement)",
    "px_16013193.jpg": "pexels 16013193, al-aqsa night, benched (busy for 9:16)",
    "px_33105187.jpg": "pexels 33105187, REJECTED: people visible in arcade",
}

ITEMS = [
    {"key": "kahf_power", "photo": "px_33410135.jpg",
     "font": "ruqaa",
     "ar": ["مَا شَآءَ ٱللَّهُ لَا قُوَّةَ إِلَّا بِٱللَّهِ"],
     "en": ["This is what Allah has willed!", "There is no power except with Allah!"],
     "cite": "QUR'AN 18:39"},
    {"key": "guide", "photo": "px_11483167.jpg",
     "ar": ["إِنَّ مَعِىَ رَبِّى سَيَهْدِينِ"],
     "en": ["My Lord is certainly with me,", "He will guide me."],
     "cite": "QUR'AN 26:62"},
    {"key": "pleased", "photo": "px_12122210.jpg",
     "ar": ["وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰٓ"],
     "en": ["And surely your Lord will give so much", "to you that you will be pleased."],
     "cite": "QUR'AN 93:5"},
    {"key": "near", "photo": "px_2233416.jpg",
     "ar": ["فَإِنِّى قَرِيبٌ"],
     "en": ["I am truly near."],
     "cite": "QUR'AN 2:186"},
    {"key": "no_fear", "photo": "px_17838430.jpg",
     "ar": ["لَا تَخَافَآ إِنَّنِى مَعَكُمَآ أَسْمَعُ وَأَرَىٰ"],
     "en": ["Have no fear! I am with you,", "hearing and seeing."],
     "cite": "QUR'AN 20:46"},
    {"key": "healing", "photo": "px_8522562.jpg",
     "ar": ["وَنُنَزِّلُ مِنَ ٱلْقُرْءَانِ مَا هُوَ شِفَآءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ"],
     "en": ["We send down the Quran as a healing", "and mercy for the believers."],
     "cite": "QUR'AN 17:82"},
    {"key": "trust", "photo": "px_5853010.jpg",
     "ar": ["وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ"],
     "en": ["And whoever puts their trust in Allah,", "then He alone is sufficient for them."],
     "cite": "QUR'AN 65:3"},
    {"key": "tranquil", "photo": "px_36633067.jpg",
     "ar": ["يَـٰٓأَيَّتُهَا ٱلنَّفْسُ ٱلْمُطْمَئِنَّةُ", "ٱرْجِعِىٓ إِلَىٰ رَبِّكِ رَاضِيَةً مَّرْضِيَّةً"],
     "en": ["O tranquil soul! Return to your Lord,", "well pleased with Him", "and well pleasing to Him."],
     "cite": "QUR'AN 89:27-28"},
    {"key": "success", "photo": "px_13581999.jpg",
     "ar": ["وَمَا تَوْفِيقِىٓ إِلَّا بِٱللَّهِ"],
     "en": ["My success comes only through Allah."],
     "cite": "QUR'AN 11:88"},
    {"key": "responds", "photo": "px_17572018.jpg",
     "ar": ["أَمَّن يُجِيبُ ٱلْمُضْطَرَّ إِذَا دَعَاهُ وَيَكْشِفُ ٱلسُّوٓءَ"],
     "en": ["Who responds to the distressed", "when they cry to Him,", "relieving their affliction?"],
     "cite": "QUR'AN 27:62"},
    {"key": "remember", "photo": "px_8522564.jpg",
     "font": "ruqaa",
     "ar": ["فَٱذْكُرُونِىٓ أَذْكُرْكُمْ"],
     "en": ["Remember Me; I will remember you."],
     "cite": "QUR'AN 2:152"},
    {"key": "qadar", "photo": "px_27771787.jpg",
     "ar": ["إِنَّا كُلَّ شَىْءٍ خَلَقْنَـٰهُ بِقَدَرٍ"],
     "en": ["Indeed, We have created everything,", "perfectly preordained."],
     "cite": "QUR'AN 54:49"},
    {"key": "sufficient", "photo": "px_10725743.jpg",
     "font": "ruqaa",
     "ar": ["حَسْبُنَا ٱللَّهُ وَنِعْمَ ٱلْوَكِيلُ"],
     "en": ["Allah alone is sufficient as an aid for us", "and He is the best Protector."],
     "cite": "QUR'AN 3:173"},
    {"key": "sorrow", "photo": "px_34155534.jpg",
     "ar": ["إِنَّمَآ أَشْكُوا۟ بَثِّى وَحُزْنِىٓ إِلَى ٱللَّهِ"],
     "en": ["I complain of my anguish", "and sorrow only to Allah."],
     "cite": "QUR'AN 12:86"},
    {"key": "call", "photo": "px_30860588.jpg",
     "font": "ruqaa",
     "ar": ["ٱدْعُونِىٓ أَسْتَجِبْ لَكُمْ"],
     "en": ["Call upon Me,", "I will respond to you."],
     "cite": "QUR'AN 40:60"},
    {"key": "with_you", "photo": "px_10910952.jpg",
     "font": "ruqaa",
     "ar": ["وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ"],
     "en": ["And He is with you wherever you are."],
     "cite": "QUR'AN 57:4"},
    {"key": "provision", "photo": "px_31760137.jpg",
     "ar": ["رَبِّ إِنِّى لِمَآ أَنزَلْتَ إِلَىَّ مِنْ خَيْرٍ فَقِيرٌ"],
     "en": ["My Lord! I am truly in desperate need", "of whatever provision You may have", "in store for me."],
     "cite": "QUR'AN 28:24"},
    {"key": "patience", "photo": "px_38230509.jpg",
     "ar": ["وَٱصْبِرْ وَمَا صَبْرُكَ إِلَّا بِٱللَّهِ"],
     "en": ["Be patient, O Prophet, for your patience", "is only with Allah's help."],
     "cite": "QUR'AN 16:127"},
    {"key": "kafin", "photo": "px_13148248.jpg",
     "font": "ruqaa",
     "ar": ["أَلَيْسَ ٱللَّهُ بِكَافٍ عَبْدَهُۥ"],
     "en": ["Is Allah not sufficient for His servant?"],
     "cite": "QUR'AN 39:36"},
    {"key": "uplift", "photo": "px_26347654.jpg",
     "ar": ["رَبِّ ٱشْرَحْ لِى صَدْرِى", "وَيَسِّرْ لِىٓ أَمْرِى"],
     "en": ["My Lord! Uplift my heart for me,", "and make my task easy."],
     "cite": "QUR'AN 20:25-26"},
    {"key": "striving", "photo": "px_28641619.jpg",
     "ar": ["وَٱلَّذِينَ جَـٰهَدُوا۟ فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا"],
     "en": ["As for those who struggle in Our cause,", "We will surely guide them along Our Way."],
     "cite": "QUR'AN 29:69"},
    {"key": "protector", "photo": "px_1631676.jpg",
     "ar": ["فَٱللَّهُ خَيْرٌ حَـٰفِظًا وَهُوَ أَرْحَمُ ٱلرَّٰحِمِينَ"],
     "en": ["Allah is the best Protector, and He is", "the Most Merciful of the merciful."],
     "cite": "QUR'AN 12:64"},
    {"key": "khayr", "photo": "px_17650981.jpg",
     "ar": ["وَعَسَىٰٓ أَن تَكْرَهُوا۟ شَيْـًٔا وَهُوَ خَيْرٌ لَّكُمْ"],
     "en": ["Perhaps you dislike something", "which is good for you."],
     "cite": "QUR'AN 2:216"},
    {"key": "ease", "photo": "px_9569734.jpg",
     "font": "ruqaa",
     "ar": ["فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا"],
     "en": ["So, surely with hardship comes ease."],
     "cite": "QUR'AN 94:5"},
    {"key": "hearts", "photo": "px_11514335.jpg",
     "ar": ["أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ"],
     "en": ["Surely in the remembrance of Allah", "do hearts find comfort."],
     "cite": "QUR'AN 13:28"},
    {"key": "humbly", "photo": "px_37978369.jpg",
     "ar": ["وَعِبَادُ ٱلرَّحْمَـٰنِ ٱلَّذِينَ يَمْشُونَ عَلَى ٱلْأَرْضِ هَوْنًا"],
     "en": ["The true servants of the Most Compassionate", "are those who walk on the earth humbly."],
     "cite": "QUR'AN 25:63"},
    {"key": "love", "photo": "px_22819805.jpg",
     "font": "ruqaa",
     "ar": ["سَيَجْعَلُ لَهُمُ ٱلرَّحْمَـٰنُ وُدًّا"],
     "en": ["The Most Compassionate will certainly", "bless them with genuine love."],
     "cite": "QUR'AN 19:96"},
    {"key": "kind", "photo": "px_18929901.jpg",
     "font": "ruqaa",
     "ar": ["ٱللَّهُ لَطِيفٌۢ بِعِبَادِهِۦ"],
     "en": ["Allah is Ever Kind to His servants."],
     "cite": "QUR'AN 42:19"},
]


def grade(path):
    """Cover-fill 1080x1920, then a deep global fade: darker, low contrast,
    desaturated, gentle grain. The whole image recedes so type floats."""
    src = Image.open(path).convert("RGB")
    s = max(W / src.width, H / src.height)
    src = src.resize((int(src.width * s + .5), int(src.height * s + .5)), Image.LANCZOS)
    x = (src.width - W) // 2
    y = int((src.height - H) * 0.45)
    src = src.crop((x, y, x + W, y + H))
    a = np.asarray(src, np.float32)
    a = (a - 128) * 0.82 + 128          # flatten contrast
    a = a * 0.62 + 6                    # deep fade
    a[..., 0] *= 1.03
    a[..., 2] *= 0.96
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    im = ImageEnhance.Color(im).enhance(0.78)
    im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(8)), 0.10)
    a = np.asarray(im, np.float32) + np.random.default_rng(7).normal(0, 4.5, (H, W, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def find_zone(im, need_h):
    """Scan for the calmest+darkest full-width band that fits the stack.
    Returns (y_top, luminance, variance) of the best band."""
    a = np.asarray(im, np.float32)
    L = a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
    band = L[:, 140:W - 140]
    best = None
    for y0 in range(140, H - 240 - need_h, 24):
        z = band[y0:y0 + need_h]
        lum = float(z.mean())
        var = float(z.std())
        score = lum * 1.0 + var * 1.6
        if best is None or score < best[0]:
            best = (score, y0, lum, var)
    return best[1], best[2], best[3]


def soften_zone(im, y0, hgt, target=92):
    """Full-width vertical fade (no blob) that eases the zone toward target."""
    a = np.asarray(im, np.float32)
    L = a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
    lum = float(L[y0:y0 + hgt, 140:W - 140].mean())
    if lum <= target:
        return im, lum
    k = target / lum
    yy = np.mgrid[0:H].astype(np.float32)
    c = y0 + hgt / 2
    w = np.clip(1 - np.abs(yy - c) / (hgt * 1.15), 0, 1) ** 1.5
    factor = 1 - (1 - k) * w
    a = a * factor[:, None, None]
    im2 = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    L2 = np.asarray(im2, np.float32)
    l2 = float((L2[..., 0] * .299 + L2[..., 1] * .587 + L2[..., 2] * .114)[y0:y0 + hgt, 140:W - 140].mean())
    return im2, l2


_CMAPS = {}
def _covers(font_path, lines):
    """True if the font has a glyph for every codepoint (uthmani text carries
    small superscript letters some display faces lack; tofu is a QC failure)."""
    if font_path not in _CMAPS:
        from fontTools.ttLib import TTFont
        _CMAPS[font_path] = set(TTFont(font_path).getBestCmap().keys())
    cm = _CMAPS[font_path]
    return all(ord(ch) in cm for ln in lines for ch in ln if ch != " ")


def _ctext(d, t, f, fill, y, ls=0):
    w = sum(d.textlength(c, font=f) + ls for c in t) - ls if ls else d.textlength(t, font=f)
    x = (W - w) / 2
    if ls:
        cx = x
        for c in t:
            d.text((cx, y), c, font=f, fill=fill); cx += d.textlength(c, font=f) + ls
    else:
        d.text((x, y), t, font=f, fill=fill)
    return x, w


def render(item, photo_dir, out):
    im = grade(os.path.join(photo_dir, item["photo"]))
    d0 = ImageDraw.Draw(im)
    report = {"key": item["key"], "checks": []}

    # whisper type scale (calligraphic display face for short verses on request)
    ar_font_path = ARUQAA if item.get("font") == "ruqaa" else AMIRI
    if not _covers(ar_font_path, item["ar"]):
        ar_font_path = AMIRI  # full uthmani coverage; never render tofu
        report["checks"].append(("font-fallback-amiri", item.get("font"), True))
    for s in (96, 84, 76, 68, 60):
        f_ar = ImageFont.truetype(ar_font_path, s)
        if all(d0.textbbox((0, 0), ln, font=f_ar)[2] - d0.textbbox((0, 0), ln, font=f_ar)[0]
               <= W - 300 for ln in item["ar"]):
            break
    f_en = ImageFont.truetype(PLAY_IT, 37)
    f_ci = ImageFont.truetype(SANS, 20)
    ar_ms = [d0.textbbox((0, 0), ln, font=f_ar) for ln in item["ar"]]
    ar_hs = [m[3] - m[1] for m in ar_ms]
    AR_G = int(s * 0.46)
    EN_LH, DIV_G, EN_G, CI_G = 54, 52, 44, 42
    total = sum(ar_hs) + AR_G * (len(ar_hs) - 1) + DIV_G + 2 + EN_G \
        + EN_LH * len(item["en"]) + CI_G + 20

    y0, lum0, var0 = find_zone(im, int(total) + 60)
    # ADAPTIVE MODE: pale luminous zones (misty sky, marble) read best with
    # warm INK text and NO darkening (the owner's luminous references);
    # everything else keeps cream text on a gently deepened band.
    ink_mode = lum0 > 150
    if ink_mode:
        lum = lum0
        c_ar, c_en, c_ci, c_mk = (66, 60, 50), (92, 85, 72), (140, 116, 72), (150, 132, 100)
        report["checks"].append(("zone-luminance>=150(ink)", round(lum, 1), lum >= 150))
    else:
        im, lum = soften_zone(im, y0, int(total) + 60)
        c_ar, c_en, c_ci, c_mk = CREAM, CREAM_SOFT, GOLD, (150, 136, 108)
        report["checks"].append(("zone-luminance<=95", round(lum, 1), lum <= 95))
    d = ImageDraw.Draw(im)
    report["checks"].append(("zone-variance<=46", round(var0, 1), var0 <= 46))

    y = y0 + 30
    for i, ln in enumerate(item["ar"]):
        m = ar_ms[i]
        x = (W - (m[2] - m[0])) / 2 - m[0]
        d.text((x, y - m[1]), ln, font=f_ar, fill=c_ar)
        off = abs((x + m[0]) - (W - (x + m[2])))
        report["checks"].append(("ar-center", round(off, 1), off <= 3))
        y += ar_hs[i] + (AR_G if i < len(ar_hs) - 1 else 0)
    y += DIV_G
    d.line([(W / 2 - 26, y), (W / 2 + 26, y)], fill=c_ci, width=2)
    y += 2 + EN_G
    for ln in item["en"]:
        x, w = _ctext(d, ln, f_en, c_en, y)
        report["checks"].append(("en-center", round(abs(x - (W - x - w)), 1), abs(x - (W - x - w)) <= 3))
        y += EN_LH
    y += CI_G
    _ctext(d, item["cite"], f_ci, c_ci, y, ls=6)
    _ctext(d, "K E T A B I", ImageFont.truetype(SANS, 17), c_mk, H - 78, 6)
    report["checks"].append(("stack-in-safe-area", y0, y0 > 130 and (y + 30) < H - 120))

    im.save(out, quality=94)
    return report, all(c[2] for c in report["checks"])


if __name__ == "__main__":
    photo_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
    outdir = sys.argv[2] if len(sys.argv) > 2 else "/tmp/ayah_v2"
    os.makedirs(outdir, exist_ok=True)
    all_ok = True
    for item in ITEMS:
        rep, ok = render(item, photo_dir, os.path.join(outdir, f"ayah_{item['key']}.jpg"))
        all_ok &= ok
        print(f"[{'OK ' if ok else 'FAIL'}] {rep['key']}: " +
              "; ".join(f"{n}={v}{'✓' if p else '✗'}" for n, v, p in rep["checks"]))
    print("ALL QC PASSED" if all_ok else "QC FAILURES PRESENT")
