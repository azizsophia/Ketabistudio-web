#!/usr/bin/env python3
"""
Render engine for Ketabi Studio GREETING CARDS.

One cohesive premium house style — the SAME language as the photo-book keepsakes
(warm ivory, Playfair display, Cormorant text, Amiri Arabic, a single per-card
accent + fine keylines).

Two print backends, ONE set of panel drawers (so a card looks identical either
way):
  • PRODIGI (international): one stitched artboard PNG, all four faces, ~3mm
    bleed (6117 x 2161 px). printArea "default".
  • CLOUDPRINTER (US): a 2-page PDF per their template — page 1 outside
    (back | front), page 2 inside (blank | message+dua); each page the full
    10 x 7" flat sheet with 3mm bleed @ 300 DPI.

Panels are upright (left book-fold) in both, verified against each printer's
own template.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from photobook_pipeline import (
    PF, CG, AR, reshape, wrap, ctext, ls,
    BONE, ESPRESSO, STONE, INK,
    _download, _cover_fit, _bottom_scrim,
)

# ── Prodigi artboard geometry (6117 x 2161, four faces stitched) ─────
ARTBOARD_W, ARTBOARD_H = 6117, 2161
OUTER_REAR = (64, 65, 1529, 2096)     # back cover  (left of OUTSIDE half)
OUTER_FRONT = (1529, 65, 2993, 2096)  # front cover (right of OUTSIDE half)
INSIDE_RIGHT = (4587, 65, 6051, 2096)  # message + dua (right inside page)
OUTSIDE_FOLD = 1529
GUTTER_MID = 3058
PRODIGI_FRONT_FILL = (OUTSIDE_FOLD, 0, GUTTER_MID, ARTBOARD_H)

# ── Cloudprinter geometry (2-page PDF, 10.236 x 7.236" = 3mm bleed) ──
CP_W, CP_H = 3071, 2171               # 260 x 183.8 mm @ 300 DPI
CP_BLEED = 35                         # ~3 mm
CP_FOLD = CP_W // 2                   # centre fold (1535)
CP_LEFT = (CP_BLEED, CP_BLEED, CP_FOLD, CP_H - CP_BLEED)
CP_RIGHT = (CP_FOLD, CP_BLEED, CP_W - CP_BLEED, CP_H - CP_BLEED)
CP_RIGHT_FILL = (CP_FOLD, 0, CP_W, CP_H)

SAFE = 130                            # keep content this far inside the trim
SPINE = 150                           # extra inset on the fold (spine) side

IVORY = (247, 242, 234)
LGOLD = (214, 188, 130)


def _rgb(hex_):
    h = hex_.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _fit_ar(d, shaped, maxw, start, minsz=44):
    s = start
    while s > minsz and d.textlength(shaped, font=AR(s)) > maxw:
        s -= 2
    return AR(s), s


def _fit_one(d, text, maker, maxw, start, minsz):
    s = start
    while s > minsz and d.textlength(text, font=maker(s)) > maxw:
        s -= 4
    return maker(s), s


def _hairline(d, cx, y, half, color, w=2):
    d.line([cx - half, y, cx + half, y], fill=color, width=w)


# ── front cover (solid accent) ──────────────────────────────────────
def _draw_front_solid(img, d, box, fill_box, accent, slots):
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    ImageDraw.Draw(img).rectangle(list(fill_box), fill=accent)
    fx0 = x0 + SPINE     # spine/fold is the LEFT edge of the front face
    fx1 = x1 - SAFE
    d.rectangle([fx0, y0 + SAFE, fx1, y1 - SAFE], outline=LGOLD, width=2)
    maxw = fx1 - fx0 - 60

    segs = []
    segs.append((lambda yy: ls(d, slots["eyebrow"].upper(), PF(36, 500),
                               cx, yy, LGOLD, 8), 40, 150))
    if slots["bigArabic"]:
        shaped = reshape(slots["bigText"])
        afo, asz = _fit_ar(d, shaped, maxw, 160)
        segs.append((lambda yy, f=afo, t=shaped: ctext(d, t, f, cx, yy, IVORY),
                     int(asz * 1.1), 56))
        if slots["translit"]:
            segs.append((lambda yy: ctext(d, slots["translit"],
                         CG(52, 520, it=True), cx, yy, LGOLD), 56, 78))
    else:
        fo, sz = _fit_one(d, slots["bigText"], lambda z: PF(z, 500),
                          maxw, 140, 64)
        segs.append((lambda yy, f=fo, t=slots["bigText"]:
                     ctext(d, t, f, cx, yy, IVORY), sz, 70))
    segs.append((lambda yy: _hairline(d, cx, yy, 140, LGOLD, 2), 2, 84))
    if slots.get("line2"):
        fo, sz = _fit_one(d, slots["line2"], lambda z: CG(z, 540, it=True),
                          maxw + 20, 88, 48)
        segs.append((lambda yy, f=fo, t=slots["line2"]:
                     ctext(d, t, f, cx, yy, IVORY), sz, 40))
    if slots.get("sub"):
        segs.append((lambda yy: ctext(d, slots["sub"], CG(48, 520, it=True),
                     cx, yy, LGOLD), 48, 0))

    foot = slots.get("foot")
    top = y0 + SAFE
    bottom = (y1 - SAFE - 150) if foot else (y1 - SAFE)
    block_h = sum(h for _, h, _ in segs) + sum(g for *_, g in segs[:-1])
    y = top + max(0, (bottom - top - block_h) // 2)
    for draw, h, gap in segs:
        draw(y)
        y += h + gap
    if foot:
        ctext(d, foot, CG(48, 520, it=True), cx, y1 - SAFE - 110, LGOLD)


# ── front cover (customer photo) ────────────────────────────────────
def _shadowed_type(cover, draw_fns):
    """Draw the cover type onto `cover` with a soft dark halo behind every glyph
    so the wording is ALWAYS legible on any photo (light skies, snow, etc.)."""
    txt = Image.new("RGBA", cover.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    for fn in draw_fns:
        fn(td)
    halo = txt.split()[3].filter(ImageFilter.GaussianBlur(12))
    shadow = Image.new("RGBA", cover.size, (8, 6, 4, 0))
    shadow.putalpha(halo)
    base = cover.convert("RGBA")
    # three passes so even the small gold eyebrow holds up over a near-white photo
    base.alpha_composite(shadow)
    base.alpha_composite(shadow)
    base.alpha_composite(shadow)
    base.alpha_composite(txt)
    return base.convert("RGB")


def _draw_front_photo(img, d, box, fill_box, accent, slots, photo):
    x0, y0, x1, y1 = box
    cxg = (x0 + x1) // 2
    fbx0, fby0, fbx1, fby1 = fill_box
    cxl = cxg - fbx0                  # centre x in the cover's local coords
    cover = _cover_fit(photo, fbx1 - fbx0, fby1 - fby0)
    cover = _bottom_scrim(cover, frac=0.66, max_alpha=215)
    maxw = (x1 - SAFE) - (x0 + SPINE) - 60

    ops = []
    ops.append((lambda dd, yy: ls(dd, slots["eyebrow"].upper(), PF(34, 500),
                                  cxl, yy, LGOLD, 8), 40, 86))
    if slots["bigArabic"]:
        shaped = reshape(slots["bigText"])
        afo, asz = _fit_ar(d, shaped, maxw, 140)
        ops.append((lambda dd, yy, f=afo, t=shaped:
                    ctext(dd, t, f, cxl, yy, IVORY), int(asz * 1.1), 48))
        if slots["translit"]:
            ops.append((lambda dd, yy: ctext(dd, slots["translit"],
                        CG(50, 520, it=True), cxl, yy, LGOLD), 56, 70))
    else:
        fo, sz = _fit_one(d, slots["bigText"], lambda z: PF(z, 500),
                          maxw, 124, 60)
        ops.append((lambda dd, yy, f=fo, t=slots["bigText"]:
                    ctext(dd, t, f, cxl, yy, IVORY), sz, 56))
    ops.append((lambda dd, yy: _hairline(dd, cxl, yy, 130, LGOLD, 2), 2, 70))
    if slots.get("line2"):
        fo, sz = _fit_one(d, slots["line2"], lambda z: CG(z, 540, it=True),
                          maxw + 20, 80, 46)
        ops.append((lambda dd, yy, f=fo, t=slots["line2"]:
                    ctext(dd, t, f, cxl, yy, IVORY), sz, 0))

    foot = slots.get("foot")
    block_h = sum(h for _, h, _ in ops) + sum(g for *_, g in ops[:-1])
    bottom = ((y1 - SAFE - 130) if foot else (y1 - SAFE - 60)) - fby0
    yy = bottom - block_h
    draw_fns = []
    for fn, h, gap in ops:
        draw_fns.append(lambda dd, fn=fn, y=yy: fn(dd, y))
        yy += h + gap
    if foot:
        draw_fns.append(lambda dd: ctext(dd, foot, CG(48, 520, it=True),
                                         cxl, (y1 - SAFE - 60) - fby0, LGOLD))

    cover = _shadowed_type(cover, draw_fns)
    img.paste(cover, (fbx0, fby0))
    d.rectangle([x0 + SPINE, y0 + SAFE, x1 - SAFE, y1 - SAFE],
                outline=LGOLD, width=2)


def _draw_back(d, box, accent):
    """Back cover: quiet ivory with the wordmark + a hairline."""
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    ls(d, "KETABI STUDIO", PF(38, 500), cx, cy - 28, accent, 12)
    _hairline(d, cx, cy + 64, 96, accent, 2)


def _draw_inside(d, box, accent, message, dua, sign_off=""):
    """Right inside page: message + rule + dua, centred; sign-off at the foot.
    (The left inside page is intentionally left blank for a handwritten note.)"""
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    inner = SAFE + 30
    maxw = (x1 - x0) - 2 * inner

    msg = (message or "").strip()
    mfo, msz, lines, lh = None, 58, [], 0
    s = 66
    budget = (y1 - y0) - 820
    while s > 40:
        f = CG(s, 520)
        lines = wrap(d, msg, f, maxw)
        lh = int(s * 1.4)
        if len(lines) * lh <= budget or s <= 40:
            mfo, msz = f, s
            break
        s -= 2
    mfo = mfo or CG(msz, 520)

    dfo = CG(50, 520, it=True)
    dua_lines = wrap(d, dua, dfo, maxw) if dua else []
    dlh = 76
    sign = (sign_off or "").strip()
    sign_gap, sign_h = (96, 56) if sign else (0, 0)
    msg_h = len(lines) * lh
    rgap_t, rgap_b = 64, 78
    dua_h = (rgap_t + 2 + rgap_b + len(dua_lines) * dlh) if dua_lines else 0
    block_h = msg_h + dua_h + sign_gap + sign_h

    # centre the WHOLE block (message + dua + signature) so the signature sits
    # just below the dua, not stranded at the bottom with empty space above it.
    top = y0 + inner
    bottom = y1 - inner
    y = top + max(0, (bottom - top - block_h) // 2)
    for ln in lines:
        ctext(d, ln, mfo, cx, y, INK)
        y += lh
    if dua_lines:
        y += rgap_t
        _hairline(d, cx, y, 130, accent, 2)
        y += rgap_b
        for ln in dua_lines:
            ctext(d, ln, dfo, cx, y, ESPRESSO)
            y += dlh
    if sign:
        y += sign_gap
        ctext(d, sign, CG(52, 520, it=True), cx, y, STONE)


def _front(img, d, box, fill_box, accent, slots, photo):
    if photo is not None:
        _draw_front_photo(img, d, box, fill_box, accent, slots, photo)
    else:
        _draw_front_solid(img, d, box, fill_box, accent, slots)


# ── slots (mirrors lib/cards.ts frontSlots) ─────────────────────────
def _slots(card, recipient="", arabic_index=0, arabic_off=False):
    if card["group"] == "occasion":
        words = card.get("words") or []
        idx = arabic_index if 0 <= arabic_index < len(words) else 0
        ar = None if (arabic_off or not words) else words[idx]
        return {
            "eyebrow": card["eyebrow"],
            "bigText": ar["ar"] if ar else card.get("en", ""),
            "bigArabic": bool(ar),
            "translit": ar["translit"] if ar else "",
            "line2": card.get("en", "") if ar else "",
            "sub": "",
            "foot": (f"For {recipient}" if recipient else ""),
        }
    word = None if arabic_off else card.get("word")
    return {
        "eyebrow": card["eyebrow"],
        "bigText": word["ar"] if word else card.get("headlineEn", ""),
        "bigArabic": bool(word),
        "translit": word["translit"] if word else "",
        "line2": card.get("headlineEn", "") if word else "",
        "sub": card.get("sub", ""),
        "foot": (f"For {recipient}" if recipient else ""),
    }


# ── Prodigi: one stitched artboard PNG ──────────────────────────────
def render_artboard(accent, slots, message, dua, sign_off="", photo=None):
    img = Image.new("RGB", (ARTBOARD_W, ARTBOARD_H), BONE)
    d = ImageDraw.Draw(img)
    _draw_back(d, OUTER_REAR, accent)
    _front(img, d, OUTER_FRONT, PRODIGI_FRONT_FILL, accent, slots, photo)
    _draw_inside(d, INSIDE_RIGHT, accent, message, dua, sign_off)
    return img


# ── Cloudprinter: 2-page sheet (outside, inside) ────────────────────
def render_cp_pages(accent, slots, message, dua, sign_off="", photo=None):
    outside = Image.new("RGB", (CP_W, CP_H), BONE)
    do = ImageDraw.Draw(outside)
    _draw_back(do, CP_LEFT, accent)
    _front(outside, do, CP_RIGHT, CP_RIGHT_FILL, accent, slots, photo)

    inside = Image.new("RGB", (CP_W, CP_H), BONE)
    di = ImageDraw.Draw(inside)
    _draw_inside(di, CP_RIGHT, accent, message, dua, sign_off)
    return [outside, inside]


def build(card, out_dir, recipient="", message=None, sign_off="",
          arabic_index=0, arabic_off=False, accent_hex=None, photo_url=None):
    """Prodigi artboard PNG (printArea "default"). Returns the PNG path."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    accent = _rgb(accent_hex or card.get("color", "#967A46"))
    photo = _download(photo_url) if photo_url else None
    slots = _slots(card, recipient, arabic_index, arabic_off)
    artboard = render_artboard(
        accent, slots,
        message if message is not None else card.get("msg", ""),
        card.get("dua", ""), sign_off, photo=photo)
    ap = out / "artboard.png"
    artboard.save(ap, "PNG")
    return str(ap)


def build_cloudprinter(card, out_dir, recipient="", message=None, sign_off="",
                       arabic_index=0, arabic_off=False, accent_hex=None,
                       photo_url=None):
    """Cloudprinter 2-page print-ready PDF (page 1 outside, page 2 inside).
    Returns the PDF path."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    accent = _rgb(accent_hex or card.get("color", "#967A46"))
    photo = _download(photo_url) if photo_url else None
    slots = _slots(card, recipient, arabic_index, arabic_off)
    pages = render_cp_pages(
        accent, slots,
        message if message is not None else card.get("msg", ""),
        card.get("dua", ""), sign_off, photo=photo)
    pp = out / "card.pdf"
    pages[0].save(pp, "PDF", resolution=300.0, save_all=True,
                  append_images=pages[1:])
    return str(pp)


if __name__ == "__main__":
    samples = {
        "eid": {
            "group": "occasion", "color": "#1f6b5a", "eyebrow": "Eid Mubarak",
            "en": "Blessed Eid",
            "words": [{"ar": "عيد مبارك", "translit": "Eid Mubarak"}],
            "dua": "May Allah accept from us and from you.",
            "msg": "Wishing you and your family a joyful and blessed Eid.",
        },
    }
    for cid, c in samples.items():
        print("prodigi:", build(c, f"/tmp/card_{cid}"))
        print("cloudprinter:", build_cloudprinter(c, f"/tmp/cpcard_{cid}",
              message="Wishing you a blessed Eid.", sign_off="With love"))
