#!/usr/bin/env python3
"""
Render engine for the personalized "My Beautiful Duas" book.

Premium type system: Cormorant Garamond (display) + Lora (body) + Amiri
(Arabic). Builds a 32-page interior + a full Lulu cover wrap from the text-free
art in Supabase (book-assets/duas-assets/), personalized by name, character
(boy/girl/hijab), look (afro/indian/white) and eye colour.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
import io
import json
import math
import os
from pathlib import Path
from urllib.parse import quote

import requests
import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, features

ROOT = Path(__file__).resolve().parent
BOOK = json.loads((ROOT / "duas_book.json").read_text(encoding="utf-8"))
FD = ROOT.parent / "fonts"
CGV, CGI, LORA, AMIRI = str(FD / "Cormorant.ttf"), str(FD / "Cormorant-Italic.ttf"), str(FD / "Lora.ttf"), str(FD / "Amiri-Regular.ttf")

SB = "".join(os.environ.get("SUPABASE_URL", "").split()).rstrip("/")
KEY = "".join(os.environ.get("SUPABASE_SERVICE_KEY", "").split())

TRIM = BOOK["trim_px"]
FULLBLEED = 2625            # 8.75in = 8.5in trim + 0.125in bleed each side
FBM = (FULLBLEED - TRIM) // 2
SPREAD_W, SPREAD_H = BOOK["spread_px"]
HALF = BOOK["half_split_x"]
CREAM = (250, 245, 236); CARD = (255, 252, 245); GOLD = (184, 134, 52)
DARK = (58, 50, 38); GRAY = (126, 116, 101); BORD = (206, 176, 120); BYL = (150, 116, 52); ACCENT = (150, 98, 30)
COVER_HERO = "page0009"
COVER_CROP = (0.05, 0.11, 0.35, 0.93)


def CG(sz, w=600, it=False):
    f = ImageFont.truetype(CGI if it else CGV, sz)
    try:
        f.set_variation_by_axes([w])
    except Exception:
        pass
    return f


def LO(sz, w=500):
    f = ImageFont.truetype(LORA, sz)
    try:
        f.set_variation_by_axes([w])
    except Exception:
        pass
    return f


_RAQM = features.check("raqm")


def AR(sz):
    # When libraqm is present PIL uses it by default and shapes Arabic itself,
    # so we must NOT pre-shape. Without raqm we fall back to the basic engine
    # and pre-shape with arabic_reshaper + bidi.
    eng = ImageFont.Layout.RAQM if _RAQM else ImageFont.Layout.BASIC
    return ImageFont.truetype(AMIRI, sz, layout_engine=eng)


def reshape(t):
    return t if _RAQM else get_display(arabic_reshaper.reshape(t))


_art = {}
def fetch_art(pack, page, look):
    k = (pack, page, look)
    if k not in _art:
        path = quote(f"duas-assets/{pack}/{page} {look}.png")
        r = requests.get(f"{SB}/storage/v1/object/book-assets/{path}",
                         headers={"Authorization": f"Bearer {KEY}"}, timeout=300)
        r.raise_for_status()
        _art[k] = Image.open(io.BytesIO(r.content)).convert("RGB")
    return _art[k]


def subst(text, char, name, eye):
    for token, val in BOOK["pronouns"][char].items():
        text = text.replace(f"[{token}]", val)
    return text.replace("[Child’s Name]", name).replace("[Child's Name]", name).replace("[eye color]", eye)


# ── drawing helpers ─────────────────────────────────────────────────
def ctext(d, t, fo, cx, y, fill):
    d.text((cx - d.textlength(t, font=fo) / 2, y), t, font=fo, fill=fill)


def ls(d, t, fo, cx, y, fill, sp):
    ws = [d.textlength(c, font=fo) for c in t]
    tw = sum(ws) + sp * (len(t) - 1)
    x = cx - tw / 2
    for c, w in zip(t, ws):
        d.text((x, y), c, font=fo, fill=fill)
        x += w + sp
    return tw


def star_n(d, cx, cy, R, pts=8, inner=0.46, fill=GOLD):
    p = [(cx + (R if i % 2 == 0 else R * inner) * math.cos(math.pi / 2 + i * math.pi / pts),
          cy - (R if i % 2 == 0 else R * inner) * math.sin(math.pi / 2 + i * math.pi / pts)) for i in range(pts * 2)]
    d.polygon(p, fill=fill)


def star5(d, cx, cy, r, fill=GOLD, outline=None, wd=3):
    p = [(cx + (r if i % 2 == 0 else r * 0.42) * math.cos(math.pi / 2 + i * math.pi / 5),
          cy - (r if i % 2 == 0 else r * 0.42) * math.sin(math.pi / 2 + i * math.pi / 5)) for i in range(10)]
    if fill:
        d.polygon(p, fill=fill)
    if outline:
        d.line(p + [p[0]], fill=outline, width=wd)


def arch_mask(w, h):
    m = Image.new("L", (w, h), 0); md = ImageDraw.Draw(m); r = w // 2
    md.rectangle([0, r, w, h], fill=255); md.pieslice([0, 0, w, 2 * r], 180, 360, fill=255)
    return m


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def wrap(d, text, fo, mw):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=fo) <= mw:
            cur = t
        else:
            if cur:
                out.append(cur)
            cur = w
    if cur:
        out.append(cur)
    return out


def fit_lo(d, text, bw, bh, start=82, minsz=30):
    s = start
    while s >= minsz:
        fo = LO(s, 500); lines = wrap(d, text, fo, bw); lh = int(s * 1.5)
        if len(lines) * lh <= bh:
            return fo, lines, lh
        s -= 2
    fo = LO(minsz, 500)
    return fo, wrap(d, text, fo, bw), int(minsz * 1.5)


def blank(frame=False, border=BORD):
    img = Image.new("RGB", (TRIM, TRIM), CREAM); d = ImageDraw.Draw(img)
    if frame:
        d.rectangle([54, 54, TRIM - 54, TRIM - 54], outline=GOLD, width=4)
        d.rectangle([70, 70, TRIM - 70, TRIM - 70], outline=border, width=2)
    return img, d


def chest(d, cx, top, w):
    h = int(w * 0.5); x0, x1 = cx - w // 2, cx + w // 2; bt = top + int(h * 0.40)
    for k in range(6, 0, -1):
        rr = int(w * 0.52 * k / 6)
        d.ellipse([cx - rr, top + h // 2 - int(rr * 0.95), cx + rr, top + h // 2 + int(rr * 0.95)],
                  fill=lerp(CREAM, (252, 238, 200), 0.5 * k / 6))
    for sx, sy, r in [(cx - w * 0.46, top + 10, 16), (cx, top - 46, 22), (cx + w * 0.46, top + 6, 18)]:
        star5(d, sx, sy, r, GOLD)
    for yy in range(bt, top + h):
        d.line([x0 + 8, yy, x1 - 8, yy], fill=lerp((150, 96, 50), (110, 66, 32), (yy - bt) / max(1, top + h - bt)))
    d.rounded_rectangle([x0, bt, x1, top + h], radius=24, outline=(92, 56, 28), width=6)
    lidtop = bt - int(h * 0.5)
    for yy in range(lidtop, bt):
        frac = (yy - lidtop) / max(1, bt - lidtop); half = int((1 - (1 - frac) ** 2) ** 0.5 * (w / 2 - 8))
        d.line([cx - half, yy, cx + half, yy], fill=lerp((150, 96, 50), (128, 80, 40), frac))
    d.rectangle([x0, bt - 6, x1, bt + 12], fill=GOLD)
    for bx in (x0 + int(w * 0.2), x1 - int(w * 0.2)):
        d.rectangle([bx - 9, lidtop + int(h * 0.12), bx + 9, top + h - 4], fill=GOLD)
    d.rounded_rectangle([cx - 28, bt + int(h * 0.16), cx + 28, bt + int(h * 0.16) + 76], radius=12, fill=GOLD)
    d.ellipse([cx - 12, bt + int(h * 0.16) + 22, cx + 12, bt + int(h * 0.16) + 46], fill=(92, 56, 28))


def star_crest(d, cx, cy, R, fill=GOLD):
    """A central 8-pointed star flanked by two small stars — a premium,
    unambiguous motif used in place of the treasure chest on framed pages."""
    star_n(d, cx, cy, R, 8, fill=fill)
    for sgn in (-1, 1):
        star_n(d, cx + sgn * int(R * 1.9), cy, int(R * 0.34), 8, fill=fill)


def flourish(d, cx, y, half_w, fill=GOLD):
    """A small centred ornament: a star with two tapering rules — an elegant
    divider in place of a repeated chest motif."""
    star_n(d, cx, y, 20, 8, fill=fill)
    for sgn in (-1, 1):
        x0 = cx + sgn * 44
        d.line([x0, y, x0 + sgn * half_w, y], fill=fill, width=3)
        d.ellipse([cx + sgn * half_w + sgn * 44 - 6, y - 6,
                   cx + sgn * half_w + sgn * 44 + 6, y + 6], fill=fill)


def hero_in_arch(img, d, ctx, cx, top, aw, ah):
    art = fetch_art(BOOK["asset_packs"][ctx["char"]],
                    BOOK.get("page_aliases", {}).get(ctx["char"], {}).get(COVER_HERO, COVER_HERO), ctx["look"])
    w, h = art.size
    fx0, fy0, fx1, fy1 = COVER_CROP
    hero = art.crop((int(fx0 * w), int(fy0 * h), int(fx1 * w), int(fy1 * h)))
    # cover-fit so the child fills the arch (crop aspect ~= arch aspect, so
    # negligible crop); bottom-anchored to keep the praying hands intact
    sc = max(aw / hero.width, ah / hero.height)
    hr = hero.resize((int(hero.width * sc), int(hero.height * sc)), Image.LANCZOS)
    lft = 0  # left-anchor: keep the child (sits left), drop empty right background
    hr = hr.crop((lft, hr.height - ah, lft + aw, hr.height))
    x0 = cx - aw // 2; r = aw // 2
    img.paste(hr, (x0, top), arch_mask(aw, ah))
    d.arc([x0, top, x0 + aw, top + 2 * r], 180, 360, fill=GOLD, width=5)
    d.line([x0, top + r, x0, top + ah], fill=GOLD, width=5)
    d.line([x0 + aw, top + r, x0 + aw, top + ah], fill=GOLD, width=5)
    d.line([x0, top + ah, x0 + aw, top + ah], fill=GOLD, width=5)


def title_block(d, cx, y, name):
    star_n(d, cx, y, 30, 8)
    d.ellipse([cx - 84, y - 6, cx - 74, y + 4], fill=GOLD); d.ellipse([cx + 74, y - 6, cx + 84, y + 4], fill=GOLD)
    nm = name + "’s"
    nsz, maxw = 250, TRIM - 460
    while nsz > 120 and d.textlength(nm, font=CG(nsz, 700, it=True)) > maxw:
        nsz -= 6
    ctext(d, nm, CG(nsz, 700, it=True), cx, y + 55 + (250 - nsz) // 2, GOLD)
    ls(d, "BEAUTIFUL DUAS", CG(120, 600), cx, y + 350, DARK, 10)
    ctext(d, "a keepsake of daily duas", CG(60, 500, it=True), cx, y + 510, GRAY)


def byline(d, cx, y):
    tw = ls(d, "BY KETABI STUDIO", CG(50, 600), cx, y, BYL, 10)
    for sgn in (-1, 1):
        xs = cx + sgn * (tw / 2 + 46)
        d.line([xs, y + 22, xs + sgn * 120, y + 22], fill=BORD, width=2)


# ── pages ───────────────────────────────────────────────────────────
def story_page(entry, ctx):
    page, half = entry
    char = ctx["char"]; pack = BOOK["asset_packs"][char]
    fpage = BOOK.get("page_aliases", {}).get(char, {}).get(page, page)
    art = fetch_art(pack, fpage, ctx["look"])
    single = page in BOOK.get("single_pages", [])
    # Drop the sliver of the neighbouring scene that bleeds across the spread
    # centre, so no stray marks land at the inner edge of split pages.
    GUT = 180
    if single:
        crop, off = art, 0
    elif half == "L":
        crop, off = art.crop((0, 0, HALF - GUT, SPREAD_H)), 0
    else:
        crop, off = art.crop((HALF + GUT, 0, art.width, SPREAD_H)), HALF + GUT
    scale = max(FULLBLEED / crop.width, FULLBLEED / crop.height)
    nw, nh = int(crop.width * scale), int(crop.height * scale)
    resized = crop.resize((nw, nh), Image.LANCZOS)
    cx0, cy0 = (nw - FULLBLEED) // 2, (nh - FULLBLEED) // 2
    img = resized.crop((cx0, cy0, cx0 + FULLBLEED, cy0 + FULLBLEED))  # full-bleed fill
    d = ImageDraw.Draw(img)
    for bx in BOOK["pages"][page]:
        x0, y0, x1, y1 = bx["bbox"]
        if not (single or ((x0 < HALF) if half == "L" else (x0 >= HALF))):
            continue
        lx0 = (x0 - off) * scale - cx0
        ly0 = y0 * scale - cy0
        bw, bh = (x1 - x0) * scale, (y1 - y0) * scale
        # keep the text block inside the safe area
        lx0 = max(FBM, min(lx0, FULLBLEED - FBM - bw))
        text = subst(bx["text"], char, ctx["name"], ctx["eye"])
        fo, lines, lh = fit_lo(d, text, bw, bh)
        ty = ly0 + (bh - len(lines) * lh) / 2
        for ln in lines:
            ctext(d, ln, fo, lx0 + bw / 2, ty, DARK)
            ty += lh
    return img


def title_page(ctx):
    img, d = blank(frame=True)
    title_block(d, TRIM // 2, 360, ctx["name"])
    star_crest(d, TRIM // 2, 1480, 150)
    byline(d, TRIM // 2, 2240)
    return img


def belongs_page(ctx):
    img, d = blank(frame=True)
    ctext(d, "This book belongs to", CG(70, 500, it=True), TRIM // 2, 880, GRAY)
    ctext(d, ctx["name"], CG(180, 700), TRIM // 2, 1010, GOLD)
    d.line([TRIM // 2 - 360, 1330, TRIM // 2 + 360, 1330], fill=BORD, width=2)
    star_n(d, TRIM // 2, 1330, 12, 8)
    ctext(d, "May your days always be filled", LO(50, 500, ), TRIM // 2, 1520, DARK)
    ctext(d, "with the remembrance of Allah.", LO(50, 500), TRIM // 2, 1600, DARK)
    return img


def end_page():
    img, d = blank(frame=True)
    star_crest(d, TRIM // 2, 560, 140)
    ctext(d, "The End", CG(150, 700), TRIM // 2, 1080, GOLD)
    ctext(d, "Say a dua today, and Allah is always", LO(40, 500), TRIM // 2, 1480, GRAY)
    ctext(d, "near to listen and to love you.", LO(40, 500), TRIM // 2, 1545, GRAY)
    return img


def chest_opener():
    img, d = blank(frame=True)
    ctext(d, "My Dua", CG(150, 700), TRIM // 2, 230, GOLD)
    ctext(d, "Treasure Chest", CG(150, 700), TRIM // 2, 400, GOLD)
    chest(d, TRIM // 2, 880, 560)
    ctext(d, "Every dua is a treasure.", CG(64, 600, it=True), TRIM // 2, 1660, DARK)
    ctext(d, "Collect a star each time you say one!", LO(48, 500), TRIM // 2, 1770, DARK)
    return img


def chest_page(duas):
    img, d = blank()
    ctext(d, "My Daily Duas", CG(80, 700), TRIM // 2, 70, GOLD)
    star_n(d, TRIM // 2, 215, 12, 8)
    M, gx, gy, top = 70, 40, 36, 270
    cw = (TRIM - 2 * M - gx) // 2
    chh = (TRIM - top - M - 2 * gy) // 3
    labf, trf, enf = CG(32, 600), CG(25, 500, it=True), LO(26, 500)
    for i, (lab, ar, tr, en, src) in enumerate(duas):
        r, c = divmod(i, 2); x = M + c * (cw + gx); y = top + r * (chh + gy)
        d.rounded_rectangle([x, y, x + cw, y + chh], radius=22, fill=CARD, outline=BORD, width=3)
        cx = x + cw // 2; iw = cw - 110
        star_n(d, x + 46, y + 46, 15, 8)
        s = 56; rsh = reshape(ar)
        while s > 26 and d.textlength(rsh, font=AR(s)) > iw:
            s -= 2
        afo = AR(s)
        trl = wrap(d, tr, trf, iw)          # transliteration wraps (some duas are long)
        enl = wrap(d, en, enf, iw)
        g1, g2, g3, tlh, elh = 20, 26, 22, 34, 38   # compact reference layout
        block = 32 + g1 + afo.size + g2 + len(trl) * tlh + g3 + len(enl) * elh
        avail_t, avail_b = y + 34, y + chh - 74            # reserve bottom for source line
        sy = avail_t + max(0, (avail_b - avail_t - block) // 2)
        ls(d, lab.upper(), labf, cx, sy, ACCENT, 3); sy += 32 + g1
        ctext(d, rsh, afo, cx, sy, DARK); sy += afo.size + g2
        for ln in trl:
            ctext(d, ln, trf, cx, sy, GRAY); sy += tlh
        sy += g3
        for ln in enl:
            ctext(d, ln, enf, cx, sy, DARK); sy += elh
        ctext(d, f"({src})", LO(24, 500), cx, y + chh - 46, (170, 158, 140))
    return img


def star_chart():
    img, d = blank()
    ctext(d, "My Dua Star Chart", CG(86, 700), TRIM // 2, 70, GOLD)
    ctext(d, "Colour a star each time you remember your dua!", LO(38, 500), TRIM // 2, 200, GRAY)
    labels = BOOK["star_chart_labels"]; days = ["S", "M", "T", "W", "T", "F", "S"]
    gridL, gridR = 760, TRIM - 90; colw = (gridR - gridL) // 7
    hdr, top = 300, 380; rh = (TRIM - top - 70) // len(labels)
    for j, dn in enumerate(days):
        ctext(d, dn, CG(40, 700), gridL + j * colw + colw // 2, hdr, ACCENT)
    d.line([90, hdr + 64, TRIM - 70, hdr + 64], fill=BORD, width=2)
    for i, lab in enumerate(labels):
        y = top + i * rh
        d.text((100, y + rh // 2 - 24), lab, font=LO(34, 500), fill=DARK)
        for j in range(7):
            star5(d, gridL + j * colw + colw // 2, y + rh // 2, 26, fill=(245, 238, 222), outline=GOLD, wd=3)
        if i < len(labels) - 1:
            d.line([90, y + rh - 4, TRIM - 70, y + rh - 4], fill=BORD, width=2)
    return img


def cover_bg():
    """Full-bleed dusk sky: deep indigo at the top fading to warm peach."""
    img = Image.new("RGB", (FULLBLEED, FULLBLEED))
    d = ImageDraw.Draw(img)
    stops = [(0.0, (54, 52, 96)), (0.42, (118, 96, 138)), (0.70, (214, 150, 138)), (1.0, (245, 208, 158))]
    for y in range(FULLBLEED):
        t = y / FULLBLEED
        col = stops[-1][1]
        for k in range(len(stops) - 1):
            a, ca = stops[k]; b, cb = stops[k + 1]
            if a <= t <= b:
                col = lerp(ca, cb, (t - a) / (b - a)); break
        d.line([0, y, FULLBLEED, y], fill=col)
    return img, d

def to_fb(img):
    """Pad a trim-size design page onto a full-bleed cream canvas (content safe)."""
    if img.size == (FULLBLEED, FULLBLEED):
        return img
    fb = Image.new("RGB", (FULLBLEED, FULLBLEED), CREAM)
    fb.paste(img, ((FULLBLEED - img.width) // 2, (FULLBLEED - img.height) // 2))
    return fb


def hero_cutout(ctx, target_w):
    """The child with the white background removed (floats cleanly on the cover)."""
    art = fetch_art(BOOK["asset_packs"][ctx["char"]],
                    BOOK.get("page_aliases", {}).get(ctx["char"], {}).get(COVER_HERO, COVER_HERO), ctx["look"])
    w, h = art.size
    fx0, fy0, fx1, fy1 = COVER_CROP
    hero = art.crop((int(fx0 * w), int(fy0 * h), int(fx1 * w), int(fy1 * h))).convert("RGB")
    KEY = (255, 0, 255)
    for cpt in [(1, 1), (hero.width - 2, 1), (1, hero.height - 2), (hero.width - 2, hero.height - 2)]:
        try:
            ImageDraw.floodfill(hero, cpt, KEY, thresh=45)
        except Exception:
            pass
    rgba = hero.convert("RGBA")
    rgba.putdata([(0, 0, 0, 0) if ((p[0] > 250 and p[1] < 8 and p[2] > 250)
                                   or (p[0] > 252 and p[1] > 252 and p[2] > 252))
                  else p for p in rgba.getdata()])
    bb = rgba.getbbox()
    if bb:
        rgba = rgba.crop(bb)
    # Normalise framing: the source art shows some characters as a bust and
    # others as a full seated figure. Trim very tall cut-outs to a head-and-
    # hands bust so every cover matches (head fills the frame, not small/low).
    BUST_AR = 1.4  # max height : width
    if rgba.height > rgba.width * BUST_AR:
        rgba = rgba.crop((0, 0, rgba.width, int(rgba.width * BUST_AR)))
    sc = target_w / rgba.width
    return rgba.resize((target_w, int(rgba.height * sc)), Image.LANCZOS)


def front_cover(ctx, show_name=True):
    img, d = cover_bg()
    cx = FULLBLEED // 2
    # scattered gold stars across the upper sky (clear of the title)
    for sx, sy, r in [(170, 150, 17), (360, 380, 10), (250, 760, 12), (560, 560, 8),
                      (2300, 170, 19), (2150, 430, 11), (2380, 760, 12), (2060, 600, 8),
                      (980, 130, 9), (1660, 120, 11), (1300, 80, 7)]:
        star5(d, sx, sy, r, (250, 240, 208))
    # title — gold name, cream subtitle (reads on the dark sky). The name can be
    # omitted (show_name=False) to produce a nameless cover the storefront
    # overlays the customer's typed name onto.
    if show_name:
        nm = ctx["name"] + "’s"
        nsz, maxw = 250, FULLBLEED - 720
        while nsz > 120 and d.textlength(nm, font=CG(nsz, 700, it=True)) > maxw:
            nsz -= 6
        ctext(d, nm, CG(nsz, 700, it=True), cx, 250 + (250 - nsz) // 2, (224, 178, 92))
    ls(d, "BEAUTIFUL DUAS", CG(120, 600), cx, 600, (248, 241, 226), 10)
    ctext(d, "a keepsake of daily duas", CG(60, 500, it=True), cx, 760, (232, 220, 202))
    # child, lifted on a soft warm glow
    hero = hero_cutout(ctx, 1500)
    maxh = (FULLBLEED - 250) - 940
    if hero.height > maxh:
        hero = hero.resize((int(hero.width * maxh / hero.height), maxh), Image.LANCZOS)
    hx, hy = cx - hero.width // 2, (FULLBLEED - 250) - hero.height
    glow = Image.new("RGBA", (FULLBLEED, FULLBLEED), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([hx - 200, hy - 60, hx + hero.width + 200, hy + hero.height + 140],
                                 fill=(255, 248, 230, 160))
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    img.paste(glow, (0, 0), glow)
    img.paste(hero, (hx, hy), hero)
    # byline on the warm lower band
    tw = ls(d, "BY KETABI STUDIO", CG(50, 600), cx, FULLBLEED - 170, (104, 62, 32), 10)
    for sgn in (-1, 1):
        xs = cx + sgn * (tw / 2 + 46)
        d.line([xs, FULLBLEED - 148, xs + sgn * 120, FULLBLEED - 148], fill=(150, 100, 58), width=2)
    return img



def back_cover(ctx):
    img, d = cover_bg()
    cx = FULLBLEED // 2
    star_n(d, cx, 380, 34, 8, fill=(224, 178, 92))
    blurb = ("From the moment " + ctx["name"] + " wakes until bedtime, every "
             "moment has a beautiful dua. Join " + ctx["name"] + " through a gentle "
             "day of remembrance, with the Arabic, an easy pronunciation guide, "
             "and a keepsake star chart to treasure.")
    fo = LO(56, 500)
    y = 740
    for ln in wrap(d, blurb, fo, FULLBLEED - 760):
        ctext(d, ln, fo, cx, y, (248, 241, 226)); y += int(56 * 1.6)
    tw = ls(d, "BY KETABI STUDIO", CG(50, 600), cx, FULLBLEED - 360, (104, 62, 32), 10)
    return img



def cover_wrap(ctx):
    """Full-bleed Lulu wrap: back + spine + front, sized to 17.39x8.75in."""
    spine = 60
    fc, bc = front_cover(ctx), back_cover(ctx)
    W, H = spine + 2 * FULLBLEED, FULLBLEED
    wrap = Image.new("RGB", (W, H), CREAM)
    wrap.paste(bc, (0, 0))
    wrap.paste(fc, (FULLBLEED + spine, 0))
    ImageDraw.Draw(wrap).rectangle([FULLBLEED, 0, FULLBLEED + spine, H], fill=lerp(CREAM, GOLD, 0.14))
    wrap = wrap.resize((5217, 2625), Image.LANCZOS)  # 17.39 x 8.75 in @ 300dpi
    return wrap, fc


def intro_page(ctx):
    """Left page of the opening spread: a keepsake bookplate + the cozy intro,
    facing a reused illustration on the right."""
    img, d = blank(frame=True)
    cx = TRIM // 2
    # keepsake bookplate
    ctext(d, "This book belongs to", CG(56, 500, it=True), cx, 360, GRAY)
    ctext(d, ctx["name"], CG(150, 700, it=True), cx, 470, GOLD)
    d.line([cx - 300, 775, cx + 300, 775], fill=BORD, width=2)
    star_n(d, cx, 775, 13, 8)
    # cozy intro
    txt = subst(BOOK["intro_text"], ctx["char"], ctx["name"], ctx["eye"])
    y = 1060
    for ln in wrap(d, txt, CG(62, 500, it=True), TRIM - 620):
        ctext(d, ln, CG(62, 500, it=True), cx, y, DARK); y += 96
    flourish(d, cx, y + 160, 280)
    return img


def picture_page(illus, ctx):
    """Full-bleed illustration for the right (recto) page of a spread, using the
    subject half of the source art (with the centre-gutter sliver trimmed)."""
    page, half = illus
    char = ctx["char"]; pack = BOOK["asset_packs"][char]
    fpage = BOOK.get("page_aliases", {}).get(char, {}).get(page, page)
    art = fetch_art(pack, fpage, ctx["look"])
    GUT = 180
    if page in BOOK.get("single_pages", []):
        crop = art
    elif half == "L":
        crop = art.crop((0, 0, HALF - GUT, SPREAD_H))
    else:
        crop = art.crop((HALF + GUT, 0, art.width, SPREAD_H))
    scale = max(FULLBLEED / crop.width, FULLBLEED / crop.height)
    nw, nh = int(crop.width * scale), int(crop.height * scale)
    resized = crop.resize((nw, nh), Image.LANCZOS)
    cx0, cy0 = (nw - FULLBLEED) // 2, (nh - FULLBLEED) // 2
    img = resized.crop((cx0, cy0, cx0 + FULLBLEED, cy0 + FULLBLEED))
    # warm the plain-white art background to cream so illustration pages match
    # the cream text/title pages (one consistent luxury tone). Pure-PIL mask:
    # cream only where all three channels are near-white.
    r, g, b = img.split()
    thr = lambda v: 255 if v > 244 else 0
    mask = ImageChops.multiply(ImageChops.multiply(r.point(thr), g.point(thr)), b.point(thr))
    return Image.composite(Image.new("RGB", img.size, CREAM), img, mask.convert("L"))


def text_page(sp, ctx):
    """Clean left (verso) page of a spread: occasion, warm narrative, the dua in
    Arabic, transliteration, and a child-friendly meaning, vertically centred."""
    img, d = blank(frame=True)
    cx = TRIM // 2
    narf, narlh = LO(52, 500), 80
    nar = subst(sp["narrative"], ctx["char"], ctx["name"], ctx["eye"])
    narlines = wrap(d, nar, narf, TRIM - 560)
    has_dua = ("arabic" in sp) or ("arabic_ref" in sp)
    has_verse = "verse_arabic" in sp
    occ = sp.get("occasion", "")
    # measure the whole block so it sits vertically centred on the page
    H = (56 + 70) if occ else 0
    H += len(narlines) * narlh
    if has_dua:
        ar = sp.get("arabic") or BOOK["treasure_chest"][sp["arabic_ref"]][1]
        rsh = reshape(ar); s = 100
        while s > 46 and d.textlength(rsh, font=AR(s)) > TRIM - 520:
            s -= 2
        trf = CG(52, 500, it=True); trlines = wrap(d, sp["translit"], trf, TRIM - 560)
        mnf = LO(44, 500); mnlines = wrap(d, sp["meaning"], mnf, TRIM - 620)
        H += 100 + s + 70 + len(trlines) * 78 + 50 + len(mnlines) * 66
    if has_verse:
        vrsh = reshape(sp["verse_arabic"]); vs = 78
        while vs > 40 and d.textlength(vrsh, font=AR(vs)) > TRIM - 560:
            vs -= 2
        vtf = CG(46, 500, it=True); vtlines = wrap(d, sp["verse_translit"], vtf, TRIM - 600)
        vef = LO(42, 500); velines = wrap(d, sp["verse_english"], vef, TRIM - 620)
        H += 150 + vs + 64 + len(vtlines) * 69 + 44 + len(velines) * 63 + 56
    y = max(280, (TRIM - H) // 2)
    if occ:
        ls(d, occ.upper(), CG(44, 600), cx, y, ACCENT, 4); y += 56
        star_n(d, cx, y + 28, 15, 8); y += 70
    for ln in narlines:
        ctext(d, ln, narf, cx, y, DARK); y += narlh
    if has_dua:
        y += 100
        ctext(d, rsh, AR(s), cx, y, DARK); y += s + 70
        for ln in trlines:
            ctext(d, ln, trf, cx, y, GRAY); y += 78
        y += 50
        for ln in mnlines:
            ctext(d, ln, mnf, cx, y, ACCENT); y += 66
    if has_verse:
        y += 110
        flourish(d, cx, y, 220); y += 64
        ctext(d, vrsh, AR(vs), cx, y, DARK); y += vs + 64
        for ln in vtlines:
            ctext(d, ln, vtf, cx, y, GRAY); y += 69
        y += 44
        for ln in velines:
            ctext(d, ln, vef, cx, y, ACCENT); y += 63
        ctext(d, sp["verse_ref"], CG(34, 600), cx, y + 12, BYL)
    return img


def build(name, char, look, eye, out_dir):
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    ctx = {"name": name, "char": char, "look": look, "eye": eye}
    tc = BOOK["treasure_chest"]
    # 3 front-matter pages (title, then the opening spread = intro/bookplate +
    # a reused illustration), then 12 facing spreads (text verso + illustration
    # recto), then 5 back-matter pages = 32 pages.
    pages = [title_page(ctx), intro_page(ctx), picture_page(["page0004", "R"], ctx)]
    for sp in BOOK["story_spreads"]:
        pages.append(text_page(sp, ctx))             # verso (left): words + dua
        pages.append(picture_page(sp["illus"], ctx))  # recto (right): illustration
    pages += [chest_opener(), chest_page(tc[:6]), chest_page(tc[6:]), star_chart(), end_page()]
    pages = [to_fb(p) for p in pages]   # every page full-bleed (8.75in)
    for i, p in enumerate(pages):
        p.save(out / f"page{i+1:02d}.jpg", "JPEG", quality=88)
    interior = out / "interior.pdf"
    pages[0].save(interior, "PDF", save_all=True, append_images=pages[1:], resolution=300.0)
    wrap, fc = cover_wrap(ctx)
    fc.save(out / "cover_front.jpg", "JPEG", quality=90)
    wrap.save(out / "cover.jpg", "JPEG", quality=90)
    wrap.save(out / "cover.pdf", "PDF", resolution=300.0)
    print(f"built {len(pages)} interior pages + cover wrap {wrap.size}", flush=True)
    _art.clear()  # release cached source art so memory doesn't grow across builds
    return str(interior), str(out / "cover.pdf"), len(pages)


if __name__ == "__main__":
    import sys
    a = sys.argv + ["Yusuf", "boy", "afro", "brown"][len(sys.argv) - 1:]
    build(a[1], a[2], a[3], a[4], "/tmp/duas_sample")
