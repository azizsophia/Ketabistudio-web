#!/usr/bin/env python3
"""
Render engine for Ketabi Studio GREETING CARDS.

One cohesive premium house style — the SAME language as the photo-book keepsakes
(warm ivory, Playfair display, Cormorant text, Amiri Arabic, a single per-card
accent + fine keylines). No more six clashing "collections".

What it prints (Prodigi GLOBAL-GRE-FAP-A6, folded A6 greeting card):
  outside spread = back-cover (left panel) + front-cover (right panel)
  inside  spread = quiet accent page (left) + the message + dua (right)
Each spread is the EXACT Prodigi artboard: 216 x 154 mm @ 300 DPI = 2551 x 1819,
fold down the centre, ~3 mm bleed on every edge.

Because this renders the print asset directly (PIL), what we preview IS what
prints — no headless browser, and the cards match the keepsakes by construction.
"""
import os
from pathlib import Path

from PIL import Image, ImageDraw

# Reuse the keepsake type system + Arabic shaping + palette so the cards are
# the same family as the books.
from photobook_pipeline import (
    PF, CG, AR, reshape, wrap, ctext, ls,
    BONE, ESPRESSO, STONE, INK,
)

SPREAD_W, SPREAD_H = 2551, 1819      # Prodigi A6 spread @ 300 DPI
BLEED = 36                           # ~3 mm
PANEL_W = SPREAD_W // 2              # fold at the centre
SAFE = 150                           # keep content this far from panel edges


def _rgb(hex_):
    h = hex_.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


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


# Type colours for the colour-forward front (set over the accent panel).
IVORY = (247, 242, 234)
LGOLD = (214, 188, 130)


# ── outside: front + back ───────────────────────────────────────────
def _front_panel(d, img, x0, accent, slots):
    """The front cover (right panel) — COLOUR-FORWARD: the panel is filled with
    the card's accent colour; the kicker, big Arabic word, transliteration,
    English line and foot are set in ivory + light gold on a fine gold keyline."""
    w = PANEL_W
    cx = x0 + w // 2
    inner = SAFE + 30
    # accent fills the whole front panel (incl. bleed)
    ImageDraw.Draw(img).rectangle([x0, 0, SPREAD_W, SPREAD_H], fill=accent)
    # fine light-gold keyline frame within the panel
    d.rectangle([x0 + inner, BLEED + inner, x0 + w - inner, SPREAD_H - BLEED - inner],
                outline=LGOLD, width=2)

    ls(d, slots["eyebrow"].upper(), PF(34, 500), cx, 360, LGOLD, 8)

    y = 620
    if slots["bigArabic"]:
        shaped = reshape(slots["bigText"])
        afo, asz = _fit_ar(d, shaped, w - 2 * inner - 80, 150)
        ctext(d, shaped, afo, cx, y, IVORY)
        y += asz + 70
        if slots["translit"]:
            ctext(d, slots["translit"], CG(50, 520, it=True), cx, y, LGOLD)
            y += 96
    else:
        fo, sz = _fit_one(d, slots["bigText"], lambda z: PF(z, 500),
                          w - 2 * inner - 60, 132, 64)
        ctext(d, slots["bigText"], fo, cx, y, IVORY)
        y += sz + 60

    _hairline(d, cx, y, 130, LGOLD, 2)
    y += 80
    # English line directly under the hairline — present on EVERY card for a
    # consistent rhythm (occasion: "Blessed Eid"; relationship: the headline).
    if slots.get("line2"):
        fo, sz = _fit_one(d, slots["line2"], lambda z: CG(z, 540, it=True),
                          w - 2 * inner - 40, 84, 48)
        ctext(d, slots["line2"], fo, cx, y, IVORY)
        y += sz + 34
    if slots.get("sub"):
        ctext(d, slots["sub"], CG(46, 520, it=True), cx, y, LGOLD)
    # the recipient line ("For ___"), only when the sender chose to show it
    if slots.get("foot"):
        ctext(d, slots["foot"], CG(46, 520, it=True), cx,
              SPREAD_H - BLEED - inner - 120, LGOLD)


def _back_panel(d, x0, accent):
    """The back cover (left panel): quiet ivory with the wordmark + a hairline."""
    w = PANEL_W
    cx = x0 + w // 2
    ls(d, "KETABI STUDIO", PF(36, 500), cx, SPREAD_H // 2 - 24, accent, 12)
    _hairline(d, cx, SPREAD_H // 2 + 56, 90, accent, 2)


def render_outside(accent, slots):
    img = Image.new("RGB", (SPREAD_W, SPREAD_H), BONE)
    d = ImageDraw.Draw(img)
    _back_panel(d, 0, accent)
    _front_panel(d, img, PANEL_W, accent, slots)
    return img


# ── inside: quiet left + message/dua right ──────────────────────────
def render_inside(accent, message, dua, sign_off=""):
    img = Image.new("RGB", (SPREAD_W, SPREAD_H), BONE)
    d = ImageDraw.Draw(img)

    # left panel — left intentionally blank for a handwritten note

    # right panel — the printed message + dua
    x0 = PANEL_W
    w = PANEL_W
    cx = x0 + w // 2
    inner = SAFE + 30
    maxw = w - 2 * inner

    msg = (message or "").strip()
    mfo, msz, lines, lh = None, 58, [], 0
    # fit the message to a comfortable block
    s = 64
    while s > 40:
        f = CG(s, 520)
        lines = wrap(d, msg, f, maxw)
        lh = int(s * 1.4)
        if len(lines) * lh <= SPREAD_H - 900 or s <= 40:
            mfo = f
            msz = s
            break
        s -= 2
    mfo = mfo or CG(msz, 520)

    block_h = len(lines) * lh
    y = max(BLEED + inner + 60, (SPREAD_H - block_h) // 2 - 200)
    for ln in lines:
        ctext(d, ln, mfo, cx, y, INK)
        y += lh

    y += 60
    _hairline(d, cx, y, 120, accent, 2)
    y += 70
    if dua:
        for ln in wrap(d, dua, CG(48, 520, it=True), maxw):
            ctext(d, ln, CG(48, 520, it=True), cx, y, ESPRESSO)
            y += 72
    if sign_off:
        ctext(d, sign_off, CG(50, 520, it=True), cx,
              SPREAD_H - BLEED - inner - 120, STONE)
    return img


def build(card, out_dir, recipient="", message=None, sign_off="",
          arabic_index=0, arabic_off=False, accent_hex=None):
    """Render outside.png + inside.png for one card config.

    card = {group, eyebrow, en/headlineEn, words/word(ar+translit), sub, dua,
            msg, color}
    arabic_index / arabic_off mirror the builder's Arabic choice; accent_hex
    overrides the card's default colour when the customer picked an accent.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    accent = _rgb(accent_hex or card.get("color", "#967A46"))

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

    outside = render_outside(accent, slots)
    inside = render_inside(accent, message if message is not None else card.get("msg", ""),
                           card.get("dua", ""), sign_off)
    op = out / "outside.png"
    ip = out / "inside.png"
    outside.save(op, "PNG")
    inside.save(ip, "PNG")
    return str(op), str(ip)


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
        build(c, f"/tmp/card_{cid}", recipient="" if cid == "eid" else "")
        print("built", cid)
