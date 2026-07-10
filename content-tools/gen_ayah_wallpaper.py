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
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

D = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(os.path.dirname(D), "worker", "fonts")
AMIRI = os.path.join(FF, "Amiri-Bold.ttf")
PLAY_IT = os.path.join(FF, "PlayfairDisplay-Italic.ttf")
SANS = os.path.join(FF, "DejaVuSans.ttf")
W, H = 1080, 1920
CREAM = (242, 236, 224)
CREAM_SOFT = (222, 214, 199)
GOLD = (198, 172, 122)

ITEMS = [
    {"key": "knowledge", "photo": "px_20125592.jpg",
     "ar": ["رَبِّ زِدْنِي عِلْمًا"],
     "en": ["My Lord! Increase me in knowledge."],
     "cite": "QUR'AN 20:114"},
    {"key": "guide", "photo": "px_11483167.jpg",
     "ar": ["إِنَّ مَعِيَ رَبِّي سَيَهْدِينِ"],
     "en": ["My Lord is certainly with me,", "He will guide me."],
     "cite": "QUR'AN 26:62"},
    {"key": "near", "photo": "px_2233416.jpg",
     "ar": ["فَإِنِّي قَرِيبٌ"],
     "en": ["I am truly near."],
     "cite": "QUR'AN 2:186"},
    {"key": "healing", "photo": "px_15403114.jpg",
     "ar": ["وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ", "شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ"],
     "en": ["We send down the Quran as a healing", "and mercy for the believers."],
     "cite": "QUR'AN 17:82"},
    {"key": "success", "photo": "px_18565451.jpg",
     "ar": ["وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ"],
     "en": ["My success comes only through Allah."],
     "cite": "QUR'AN 11:88"},
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

    # whisper type scale
    for s in (84, 76, 68, 60):
        f_ar = ImageFont.truetype(AMIRI, s)
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
    im, lum = soften_zone(im, y0, int(total) + 60)
    d = ImageDraw.Draw(im)
    report["checks"].append(("zone-luminance<=95", round(lum, 1), lum <= 95))
    report["checks"].append(("zone-variance<=46", round(var0, 1), var0 <= 46))

    y = y0 + 30
    for i, ln in enumerate(item["ar"]):
        m = ar_ms[i]
        x = (W - (m[2] - m[0])) / 2 - m[0]
        d.text((x, y - m[1]), ln, font=f_ar, fill=CREAM)
        off = abs((x + m[0]) - (W - (x + m[2])))
        report["checks"].append(("ar-center", round(off, 1), off <= 3))
        y += ar_hs[i] + (AR_G if i < len(ar_hs) - 1 else 0)
    y += DIV_G
    d.line([(W / 2 - 26, y), (W / 2 + 26, y)], fill=GOLD, width=2)
    y += 2 + EN_G
    for ln in item["en"]:
        x, w = _ctext(d, ln, f_en, CREAM_SOFT, y)
        report["checks"].append(("en-center", round(abs(x - (W - x - w)), 1), abs(x - (W - x - w)) <= 3))
        y += EN_LH
    y += CI_G
    _ctext(d, item["cite"], f_ci, GOLD, y, ls=6)
    _ctext(d, "K E T A B I", ImageFont.truetype(SANS, 17), (150, 136, 108), H - 78, 6)
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
