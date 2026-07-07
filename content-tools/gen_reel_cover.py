#!/usr/bin/env python3
# Reel COVER (thumbnail) renderer: just the 3 gold Amiri root letters on a
# filmic-graded background, with the held KETABI STUDIO wordmark. Same jewel
# grade + gold hero as the reel so the cover and the reel read as one piece.
# 1080x1920 static PNG. PIL renders Arabic RTL natively (do NOT pre-reverse).
#
# Usage: python3 gen_reel_cover.py  (renders the SHOWCASE set + a contact sheet)
import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.path.dirname(D), "worker", "fonts")
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
AMIRI = os.path.join(FONTS, "Amiri-Bold.ttf")
W, H = 1080, 1920
GOLD = (214, 180, 112, 255)
WORD = (224, 208, 168, 255)


def prem_grade(src_path):
    """Deep faded blacks, warm, desat, bloom, vignette, grain -> W x H."""
    src = Image.open(src_path).convert("RGB")
    sw, sh = src.size
    s = max(W / sw, H / sh)
    src = src.resize((int(sw * s + .5), int(sh * s + .5)), Image.LANCZOS)
    nw, nh = src.size
    src = src.crop(((nw - W) // 2, int((nh - H) * 0.42),
                    (nw - W) // 2 + W, int((nh - H) * 0.42) + H))
    a = np.asarray(src).astype(np.float32) * 0.86 + 6
    a[..., 0] *= 1.06; a[..., 2] *= 0.90
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    im = ImageEnhance.Color(im).enhance(0.80)
    im = ImageEnhance.Contrast(im).enhance(1.07)
    im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(20)), 0.12)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.72 * W)) ** 2 + ((yy - .5 * H) / (.72 * H)) ** 2
    vig = np.clip(1 - 0.58 * np.clip(d, 0, 1), 0.28, 1)[..., None]
    a = np.asarray(im).astype(np.float32) * vig
    a += np.random.default_rng(7).normal(0, 7, (H, W, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"), "RGB").convert("RGBA")


def center_scrim(cy=0.44):
    """Soft dark radial band so the gold letters always hold, on any photo."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx - .5 * W) / (.58 * W)) ** 2 + ((yy - cy * H) / (.34 * H)) ** 2
    a = np.interp(np.clip(d, 0, 1), [0, .5, 1], [.60, .34, .06]).astype(np.float32)
    ov = np.zeros((H, W, 4), np.float32)
    ov[..., 0] = 10; ov[..., 1] = 11; ov[..., 2] = 9; ov[..., 3] = a * 255
    return Image.fromarray(ov.astype("uint8"), "RGBA")


def gold_letters(letters, size=300):
    """A centered gold Amiri layer with a drop shadow, cushion halo, and glow —
    legible over even a bright flame. Sized to the true glyph bbox."""
    f = ImageFont.truetype(AMIRI, size)
    tmp = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    bb = tmp.textbbox((0, 0), letters, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pad = int(size * 0.5)
    layer = Image.new("RGBA", (tw + 2 * pad, th + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = pad - bb[0], pad - bb[1]
    d.text((x + 3, y + 4), letters, font=f, fill=(0, 0, 0, 150))  # shadow
    d.text((x, y), letters, font=f, fill=GOLD)
    # cushion halo built from the letters' own alpha, so they sit on any bg
    solid = Image.new("RGBA", layer.size, (7, 8, 6, 255))
    solid.putalpha(layer.split()[3])
    halo = solid.filter(ImageFilter.GaussianBlur(15))
    base = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    for _ in range(3):
        base.alpha_composite(halo)
    glow = layer.filter(ImageFilter.GaussianBlur(16))
    base.alpha_composite(glow)
    base.alpha_composite(layer)
    return base


def wordmark():
    f = ImageFont.truetype(PLAY, 30)
    txt = "K E T A B I   S T U D I O"
    tmp = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    w = sum(tmp.textlength(c, font=f) + 3 for c in txt) - 3
    layer = Image.new("RGBA", (W, 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.line([(W // 2 - 34, 6), (W // 2 + 34, 6)], fill=(201, 168, 76, 220), width=2)
    x = (W - w) / 2
    for c in txt:
        d.text((x, 22), c, font=f, fill=WORD)
        x += tmp.textlength(c, font=f) + 3
    return layer


def cover(letters, bg_path, out_path, size=300):
    im = prem_grade(bg_path)
    im.alpha_composite(center_scrim())
    gl = gold_letters(letters, size)
    im.alpha_composite(gl, ((W - gl.width) // 2, int(H * 0.44 - gl.height / 2)))
    wm = wordmark()
    im.alpha_composite(wm, (0, H - 150))
    im.convert("RGB").save(out_path, quality=94)
    return out_path


# ── ALL 30 roots, each on a DISTINCT background (no repeats — owner rule) ─────
SCR = "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad"
BGBOARD = os.path.join(SCR, "bgboard")
PREMIUM = os.path.join(SCR, "premium")

# Roots that have a hand-matched themed background get one explicitly.
THEMED = {
    "sabr":    (BGBOARD, "sabr_bluehour_18006779.jpg"),
    "nur":     (BGBOARD, "nur_light_19149954.jpg"),
    "qalb":    (BGBOARD, "qalb_candle_37764589.jpg"),
    "iman":    (BGBOARD, "iman_lantern_29898798.jpg"),
    "shukr":   (BGBOARD, "shukr_lamp_26611510.jpg"),
    "dhikr":   (BGBOARD, "dhikr_tasbih_36855575.jpg"),
    "sadaqah": (BGBOARD, "sadaqah_dates_37417612.jpg"),
    "salam":   (BGBOARD, "salam_dawn_27671434.jpg"),
    "khalq":   (BGBOARD, "khalq_earth_29047311.jpg"),
    "jannah":  (BGBOARD, "jann_shaft_30335237.jpg"),
}


# Hand-picked overrides for roots whose auto-assigned generic bg was off-brand
# (a face, alcohol imagery) or repetitive. These still consume a pool slot so
# every OTHER root keeps its original background — no reshuffle.
OVERRIDE = {
    "barakah": (BGBOARD, "qalb_candle_35410294.jpg"),   # was a woman's face
    "rizq":    (BGBOARD, "sadaqah_dates_37417614.jpg"),  # was a wine bottle; dates = provision
    "taqwa":   (BGBOARD, "nur_light_5909957.jpg"),       # was a shower head
    "latif":   (BGBOARD, "jann_shaft_17703543.jpg"),     # was a twin of wadud's gold fabric
}


def _translit_key(translit):
    # journal translit -> our short key (e.g. "Al-Wadud" -> "wadud", "du'a"->"dua")
    t = translit.lower().split("·")[0].strip()
    t = t.replace("al-", "").replace("'", "").replace("·", "").strip()
    return t.split()[0]


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(D, "etsy"))
    from journal_data import DAYS

    outdir = os.path.join(D, "_reel_covers")
    os.makedirs(outdir, exist_ok=True)

    # generic pool: numbered premium photos, sorted for determinism
    pool = sorted(
        os.path.join(PREMIUM, f) for f in os.listdir(PREMIUM)
        if f[0].isdigit() and f.endswith(".jpg")
    )
    used = set(v[1] for v in THEMED.values())
    pool = [p for p in pool if os.path.basename(p) not in used]
    pi = 0

    made = []
    for day in DAYS:
        key = _translit_key(day["translit"])
        letters = day["letters"]
        if key in THEMED:
            base, fn = THEMED[key]
            bgp = os.path.join(base, fn)
        elif key in OVERRIDE:
            base, fn = OVERRIDE[key]
            bgp = os.path.join(base, fn)
            pi += 1  # still consume a pool slot so other roots don't shift
        else:
            bgp = pool[pi]; pi += 1  # unique generic bg, never reused
        if not os.path.exists(bgp):
            print("MISSING BG for", key, bgp); continue
        out = os.path.join(outdir, f"cover_{key}.jpg")
        cover(letters, bgp, out)
        made.append((key, out))
        print("OK", key, letters, "<-", os.path.basename(bgp))

    # contact sheet (6 cols)
    cols, tw = 6, 250
    th = int(tw * H / W)
    rows = (len(made) + cols - 1) // cols
    sheet = Image.new("RGB", (tw * cols + (cols + 1) * 8, th * rows + (rows + 1) * 8), (18, 18, 18))
    for i, (k, p) in enumerate(made):
        r, c = divmod(i, cols)
        sheet.paste(Image.open(p).resize((tw, th), Image.LANCZOS),
                    (8 + c * (tw + 8), 8 + r * (th + 8)))
    sheet.save(os.path.join(D, "_reel_covers_sheet.jpg"), quality=90)
    print("SHEET", len(made), "covers ->", outdir)
