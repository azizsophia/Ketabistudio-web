#!/usr/bin/env python3
"""
Render engine for Ketabi Studio GREETING CARDS.

One cohesive premium house style — the SAME language as the photo-book keepsakes
(warm ivory, Playfair display, Cormorant text, Amiri Arabic, a single per-card
accent + fine keylines). No more six clashing "collections".

PRINT FORMAT — Prodigi fine-art greeting card (GLOBAL-GRE-MOH-7X5):
  Prodigi takes ONE flattened artboard that carries all four panels, bleed
  included, exactly as their downloadable print template lays them out:

    |  outer rear  |  outer front  | (gutter) | inside front | inside back |
        back cover     the design               (blank note)   message+dua

  Artboard = 6117 x 2161 px @ 300 DPI (5 x 7" folded faces, ~0.12" bleed).
  The card folds down the centre of each half (book / side fold), so every
  panel is upright — verified against Prodigi's own logo placement on the
  template. We render the whole sheet ourselves with PIL, so what we preview
  IS what prints, and the cards match the keepsakes by construction.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Reuse the keepsake type system + Arabic shaping + palette so the cards are
# the same family as the books.
from photobook_pipeline import (
    PF, CG, AR, reshape, wrap, ctext, ls,
    BONE, ESPRESSO, STONE, INK,
    _download, _cover_fit, _bottom_scrim,
)

# ── Prodigi artboard geometry (from prodigi-greetings-card-landscape-7x5) ──
ARTBOARD_W, ARTBOARD_H = 6117, 2161   # full sheet incl. bleed @ 300 DPI

# Trim boxes for the four faces (x0, y0, x1, y1):
OUTER_REAR = (64, 65, 1529, 2096)     # back cover  (left of the OUTSIDE half)
OUTER_FRONT = (1529, 65, 2993, 2096)  # front cover (right of the OUTSIDE half)
INSIDE_LEFT = (3123, 65, 4587, 2096)  # inside front (left page, blank for a note)
INSIDE_RIGHT = (4587, 65, 6051, 2096)  # inside back  (right page, message + dua)

OUTSIDE_FOLD = 1529                   # spine of the outside half
GUTTER_MID = 3058                     # dead space between the two printed sides
SAFE = 130                            # keep content this far inside the trim
SPINE = 150                           # extra inset on the fold (spine) side

# Type colours for the colour-forward front (set over the accent panel).
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


# ── outside: front cover + back cover ───────────────────────────────
def _draw_front(img, d, accent, slots):
    """Front cover (OUTER_FRONT) — COLOUR-FORWARD: the panel is filled with the
    card's accent colour; kicker, big Arabic word, transliteration, English line
    and foot are set in ivory + light gold inside a fine gold keyline."""
    x0, y0, x1, y1 = OUTER_FRONT
    cx = (x0 + x1) // 2
    # accent fills the whole front face out to full bleed (top/bottom to the
    # artboard edge, fold on the left, into the gutter on the right).
    ImageDraw.Draw(img).rectangle([OUTSIDE_FOLD, 0, GUTTER_MID, ARTBOARD_H],
                                  fill=accent)
    # fine light-gold keyline frame inside the safe area
    fx0 = x0 + SPINE
    fx1 = x1 - SAFE
    d.rectangle([fx0, y0 + SAFE, fx1, y1 - SAFE], outline=LGOLD, width=2)
    maxw = fx1 - fx0 - 60

    # Build the centred type block as (draw, height, gap_below) segments so the
    # whole cover stays balanced instead of top-weighted with empty space below.
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

    # the "For ___" foot is pinned near the bottom (only when a name is shown);
    # reserve room for it so centring stays balanced.
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


def _shadowed_type(cover, draw_fns):
    """Draw the cover type onto `cover` with a soft dark halo behind every glyph
    so the wording is ALWAYS legible, on any photo (light skies, snow, etc.).
    draw_fns are callables(draw) that paint the type onto a transparent layer in
    cover-local coordinates."""
    txt = Image.new("RGBA", cover.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    for fn in draw_fns:
        fn(td)
    halo = txt.split()[3].filter(ImageFilter.GaussianBlur(9))
    shadow = Image.new("RGBA", cover.size, (8, 6, 4, 0))
    shadow.putalpha(halo)
    base = cover.convert("RGBA")
    base.alpha_composite(shadow)
    base.alpha_composite(shadow)   # deepen the halo for guaranteed contrast
    base.alpha_composite(txt)
    return base.convert("RGB")


def _draw_front_photo(img, d, accent, slots, photo):
    """Front cover with the customer's PHOTO full-bleed, the type set in ivory +
    light gold over a soft bottom scrim + a soft halo — the same editorial
    language as the keepsake book covers, so a photo card reads as one family
    and the wording stays legible over any image."""
    x0, y0, x1, y1 = OUTER_FRONT
    cxg = (x0 + x1) // 2
    cxl = cxg - OUTSIDE_FOLD     # centre x in the cover's local coordinates
    # full-bleed photo box: fold (no bleed) -> into the gutter, top->bottom edge
    bw, bh = GUTTER_MID - OUTSIDE_FOLD, ARTBOARD_H
    cover = _cover_fit(photo, bw, bh)
    # strong, tall bottom scrim so the type stays legible over any photo
    cover = _bottom_scrim(cover, frac=0.66, max_alpha=215)
    maxw = (x1 - SAFE) - (x0 + SPINE) - 60

    # Build the type stack as (draw(dd, yy), height, gap), then BOTTOM-anchor it
    # so it sits in the dark zone of the scrim (not over the bright middle).
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
    bottom = (y1 - SAFE - 130) if foot else (y1 - SAFE - 60)
    yy = bottom - block_h
    draw_fns = []
    for fn, h, gap in ops:
        draw_fns.append(lambda dd, fn=fn, y=yy: fn(dd, y))
        yy += h + gap
    if foot:
        draw_fns.append(lambda dd: ctext(dd, foot, CG(48, 520, it=True),
                                         cxl, y1 - SAFE - 60, LGOLD))

    cover = _shadowed_type(cover, draw_fns)
    img.paste(cover, (OUTSIDE_FOLD, 0))
    # fine light-gold keyline frame inside the visible safe area
    d.rectangle([x0 + SPINE, y0 + SAFE, x1 - SAFE, y1 - SAFE],
                outline=LGOLD, width=2)


def _draw_back(d, accent):
    """Back cover (OUTER_REAR): quiet ivory with the wordmark + a hairline."""
    x0, y0, x1, y1 = OUTER_REAR
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    ls(d, "KETABI STUDIO", PF(38, 500), cx, cy - 28, accent, 12)
    _hairline(d, cx, cy + 64, 96, accent, 2)


# ── inside: blank note page (left) + message/dua page (right) ───────
def _draw_inside(d, accent, message, dua, sign_off=""):
    # left page (INSIDE_LEFT) intentionally blank for a handwritten note.

    x0, y0, x1, y1 = INSIDE_RIGHT
    cx = (x0 + x1) // 2
    inner = SAFE + 30
    maxw = (x1 - x0) - 2 * inner

    # fit the message to a comfortable block
    msg = (message or "").strip()
    mfo, msz, lines, lh = None, 58, [], 0
    s = 66
    budget = (y1 - y0) - 820
    while s > 40:
        f = CG(s, 520)
        lines = wrap(d, msg, f, maxw)
        lh = int(s * 1.4)
        if len(lines) * lh <= budget or s <= 40:
            mfo = f
            msz = s
            break
        s -= 2
    mfo = mfo or CG(msz, 520)

    dfo = CG(50, 520, it=True)
    dua_lines = wrap(d, dua, dfo, maxw) if dua else []
    dlh = 76

    # total height of the centred block: message + rule + dua
    msg_h = len(lines) * lh
    rule_gap_top, rule_gap_bot = 64, 78
    dua_h = (rule_gap_top + 2 + rule_gap_bot + len(dua_lines) * dlh) if dua_lines \
        else 0
    block_h = msg_h + dua_h

    # centre the block, reserving room at the bottom for the sign-off
    top = y0 + inner
    bottom = (y1 - inner - 150) if sign_off else (y1 - inner)
    y = top + max(0, (bottom - top - block_h) // 2)
    for ln in lines:
        ctext(d, ln, mfo, cx, y, INK)
        y += lh
    if dua_lines:
        y += rule_gap_top
        _hairline(d, cx, y, 130, accent, 2)
        y += rule_gap_bot
        for ln in dua_lines:
            ctext(d, ln, dfo, cx, y, ESPRESSO)
            y += dlh
    if sign_off:
        ctext(d, sign_off, CG(52, 520, it=True), cx,
              y1 - inner - 110, STONE)


# ── public API ──────────────────────────────────────────────────────
def render_artboard(accent, slots, message, dua, sign_off="", photo=None):
    """Render the full Prodigi artboard (all four panels) as one image.

    When `photo` (a PIL.Image) is given, the front cover becomes that photo with
    the type over a scrim; otherwise the solid accent cover is used."""
    img = Image.new("RGB", (ARTBOARD_W, ARTBOARD_H), BONE)
    d = ImageDraw.Draw(img)
    _draw_back(d, accent)
    if photo is not None:
        _draw_front_photo(img, d, accent, slots, photo)
    else:
        _draw_front(img, d, accent, slots)
    _draw_inside(d, accent, message, dua, sign_off)
    return img


def build(card, out_dir, recipient="", message=None, sign_off="",
          arabic_index=0, arabic_off=False, accent_hex=None, photo_url=None):
    """Render the single Prodigi artboard PNG for one card config.

    card = {group, eyebrow, en/headlineEn, words/word(ar+translit), sub, dua,
            msg, color}
    arabic_index / arabic_off mirror the builder's Arabic choice; accent_hex
    overrides the card's default colour when the customer picked an accent.
    photo_url, when set, puts the customer's photo on the front cover.

    Returns the path to artboard.png (one combined asset, printArea "default").
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    accent = _rgb(accent_hex or card.get("color", "#967A46"))
    photo = _download(photo_url) if photo_url else None

    # front slots (mirrors lib/cards.ts frontSlots, premium variant)
    if card["group"] == "occasion":
        words = card.get("words") or []
        idx = arabic_index if 0 <= arabic_index < len(words) else 0
        ar = None if (arabic_off or not words) else words[idx]
        slots = {
            "eyebrow": card["eyebrow"],
            "bigText": ar["ar"] if ar else card.get("en", ""),
            "bigArabic": bool(ar),
            "translit": ar["translit"] if ar else "",
            # show the English under the rule only when Arabic is the big text
            # (otherwise it would repeat the big English headline)
            "line2": card.get("en", "") if ar else "",
            "sub": "",
            "foot": (f"For {recipient}" if recipient else ""),
        }
    else:
        word = None if arabic_off else card.get("word")
        slots = {
            "eyebrow": card["eyebrow"],
            "bigText": word["ar"] if word else card.get("headlineEn", ""),
            "bigArabic": bool(word),
            "translit": word["translit"] if word else "",
            "line2": card.get("headlineEn", "") if word else "",
            "sub": card.get("sub", ""),
            "foot": (f"For {recipient}" if recipient else ""),
        }

    artboard = render_artboard(
        accent, slots,
        message if message is not None else card.get("msg", ""),
        card.get("dua", ""), sign_off, photo=photo)
    ap = out / "artboard.png"
    artboard.save(ap, "PNG")
    return str(ap)


if __name__ == "__main__":
    samples = {
        "eid": {
            "group": "occasion", "color": "#1f6b5a", "eyebrow": "Eid Mubarak",
            "en": "Blessed Eid",
            "words": [{"ar": "عيد مبارك", "translit": "Eid Mubarak"}],
            "dua": "May Allah accept from us and from you.",
            "msg": "Wishing you and your family a joyful and blessed Eid. May your home be filled with light, laughter and barakah.",
        },
        "wife": {
            "group": "relationship", "color": "#a85c63", "eyebrow": "To my wife",
            "headlineEn": "You are my sakīnah",
            "word": {"ar": "سكينة", "translit": "Sakeenah"},
            "sub": "the calm Allah placed in my heart",
            "dua": "May Allah preserve our home in love and mercy.",
            "msg": "To the calm in my every storm, thank you for the home and peace you bring. I love you, today and always.",
        },
    }
    for cid, c in samples.items():
        p = build(c, f"/tmp/card_{cid}",
                  recipient="Amani" if cid == "wife" else "")
        print("built", cid, p)
