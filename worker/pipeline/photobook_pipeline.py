#!/usr/bin/env python3
"""
Render engine for Ketabi Studio PHOTO-BOOK keepsakes.

A photo book is built from the CUSTOMER's own uploaded photos + editable
captions (orders.photo_data). It is an 8.5x8.5in trim, 24-physical-page
hardcover casewrap keepsake, full-bleed 8.75in, 300 DPI — printed through the
same Lulu rails as the books (casewrap hardcover).

DESIGN (premium keepsake, timeless not trendy):
  Palette — warm cream base, deep forest green, gold (two tones) + one soft
  terracotta accent used sparingly. 3-4 colours, cohesive.
  Layout — EVERY interior page carries one of the customer's photos with its
  caption (no ornament versos, no quote filler). Full-bleed heroes are spaced
  through the run so they feel special; the rest are framed insets on cream
  with a thin gold keyline and an italic caption beneath, alternating side.
  Type — Cormorant / Cormorant Italic (English), Amiri (Arabic dua only).
  300 DPI throughout.

Structure: exactly 24 physical pages, every interior page a customer photo:
  p1  Title                 p2  Dedication
  p3..p22  20 photo pages   (each = one photo + its caption baked on)
  p23 Dua (Qur'an 17:24)    p24 Closing
  The count is computed precisely and asserted == 24 (page_count).

Type system (worker/fonts):
  Cormorant Garamond + Cormorant Italic  — English display/serif
  Amiri                                  — Arabic (the dua page)

This module reuses the proven primitives from duas_pipeline:
  - FULLBLEED (2625 px @ 300 DPI), TRIM, FBM geometry + to_fb padding
  - the _RAQM / AR() / reshape() Arabic shaping (RTL, exact glyphs)
  - the img2pdf streaming build (render -> save JPEG -> free, per page)
  - the hardcover casewrap cover-wrap via Lulu calculate_cover_dimensions
It defines its OWN colour palette (the premium keepsake palette) rather than
inheriting the duas browns.

Env: nothing extra (photos are downloaded from public URLs in photo_data).
"""
import gc
import io
import os
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

# Reuse the verified Arabic shaping + full-bleed helpers + geometry from the
# duas engine so the dua renders identically (exact glyphs, correct RTL) and
# the page geometry matches the existing books exactly. We deliberately do NOT
# reuse the duas colour constants — the keepsake palette is defined below.
from duas_pipeline import (
    FULLBLEED, TRIM, FBM,
    AR, reshape, to_fb, wrap, ctext, ls, star_n, lerp,
)

FD = Path(__file__).resolve().parent.parent / "fonts"
CORM = str(FD / "Cormorant.ttf")
CORM_IT = str(FD / "Cormorant-Italic.ttf")
# Playfair Display — high-contrast editorial serif for premium display/titles.
PLAY = str(FD / "PlayfairDisplay.ttf")
PLAY_IT = str(FD / "PlayfairDisplay-Italic.ttf")

# ── luxury keepsake palette (fine-art / gallery photo book) ─────────
# Deliberately NOT the storybook language (forest-green + bright gold + little
# stars). This is a quiet, editorial, photo-forward palette: warm ivory paper,
# deep espresso ink, restrained champagne gold used only as hairlines + small
# caps, and a soft stone grey for secondary text.
BONE = (246, 241, 233)       # #F6F1E9  warm ivory page base
ESPRESSO = (43, 38, 34)      # #2B2622  deep warm ink (primary text)
GOLD = (181, 151, 92)        # #B5975C  champagne / antique gold (hairlines)
GOLD_DEEP = (150, 122, 70)   # #967A46  deeper gold (the finest keylines)
STONE = (150, 141, 128)      # #968D80  muted stone grey (secondary text)
INK = (58, 52, 46)           # #3A342E  soft body ink for longer lines
PAPER = (250, 246, 240)      # inset paper, a touch brighter than the page

# The dua printed on the dua page. VERIFIED — Qur'an 17:24 (the dua for
# parents, grammatically DUAL in the Qur'an). Mirrors lib/photobook.ts; render
# EXACTLY (the Arabic is shaped RTL by AR/reshape). The `label` is the small
# kicker above it — kept parent-neutral so it reads cleanly in both the Mama
# and Baba keepsakes without altering the verse.
DUA = {
    "about-mama": {
        "label": "A DUA FOR THE ONES WHO RAISED ME",
        "arabic": "رَّبِّ ٱرْحَمْهُمَا كَمَا رَبَّيَانِى صَغِيرًا",
        "translit": "Rabbi-rḥamhumā kamā rabbayānī ṣaghīrā",
        "english":
            "My Lord, have mercy upon them as they raised me when I was small.",
        "ref": "Qur'an 17:24",
    },
    # Baba keepsake — the same Qur'anic dua for parents (dual), same neutral
    # label, so it reads cleanly on either book.
    "about-baba": {
        "label": "A DUA FOR THE ONES WHO RAISED ME",
        "arabic": "رَّبِّ ٱرْحَمْهُمَا كَمَا رَبَّيَانِى صَغِيرًا",
        "translit": "Rabbi-rḥamhumā kamā rabbayānī ṣaghīrā",
        "english":
            "My Lord, have mercy upon them as they raised me when I was small.",
        "ref": "Qur'an 17:24",
    },
}
TITLES = {
    "about-mama": "Everything I Love About Mama",
    "about-baba": "Everything I Love About Baba",
}

# The heartfelt dedication line (set beneath the recipient's name). Kept warm
# and faith-rooted; the recipient's and author's names frame it on the page.
DEDICATIONS = {
    "about-mama": ("who taught my heart to say bismillah, and showed me the "
                   "mercy of Allah long before I had the words for it."),
    "about-baba": ("whose strength and gentle faith first showed me how to "
                   "walk through this life leaning on Allah."),
}


def CG(sz, w=600, it=False):
    f = ImageFont.truetype(CORM_IT if it else CORM, sz)
    try:
        f.set_variation_by_axes([w])
    except Exception:
        pass
    return f


def PF(sz, w=500, it=False):
    """Playfair Display — the premium display face for titles, the cover, and
    small-caps kickers. High contrast reads as luxe/editorial."""
    f = ImageFont.truetype(PLAY_IT if it else PLAY, sz)
    try:
        f.set_variation_by_axes([w])
    except Exception:
        pass
    return f


# Light champagne gold for type set OVER a darkened photo (cover/hero scrims).
GOLD_ON_DARK = (208, 182, 120)


# ── photo download + fit ────────────────────────────────────────────
def _download(url):
    """Download a customer photo. Raises on any failure so QC catches it and we
    NEVER ship a blank page.

    Supports http(s) URLs (production) and local file paths / file:// URIs
    (used by the CI sample render with placeholder images)."""
    if not url:
        raise RuntimeError("photo url missing")
    if url.startswith("file://") or "://" not in url:
        from urllib.parse import urlparse, unquote
        path = unquote(urlparse(url).path) if url.startswith("file://") else url
        img = Image.open(path)
        img.load()
        return img.convert("RGB")
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content))
    img.load()
    return img.convert("RGB")


def _cover_fit(img, w, h):
    """Cover-fit (fill + centre-crop) a photo into a w x h box. No distortion."""
    sc = max(w / img.width, h / img.height)
    nw, nh = max(1, int(img.width * sc)), max(1, int(img.height * sc))
    r = img.resize((nw, nh), Image.LANCZOS)
    x0, y0 = (nw - w) // 2, (nh - h) // 2
    return r.crop((x0, y0, x0 + w, y0 + h))


# ── design helpers ──────────────────────────────────────────────────
def _page():
    """A bare ivory trim-size page with generous breathing room (no frame)."""
    img = Image.new("RGB", (TRIM, TRIM), BONE)
    return img, ImageDraw.Draw(img)


def _hairline(d, cx, y, half=180, color=GOLD, width=2):
    """A single fine centred gold hairline — the only recurring motif. No star,
    no flourish: restraint is the point."""
    d.line([cx - half, y, cx + half, y], fill=color, width=width)


def _bottom_scrim(base, frac=0.40, max_alpha=165, color=(20, 17, 14)):
    """Composite a soft transparent->dark gradient over the bottom `frac` of a
    full-bleed photo so a light caption stays legible without a hard band.
    Gallery/editorial style — the photo still reads edge to edge."""
    w, h = base.size
    sh = int(h * frac)
    col = Image.new("L", (1, sh))
    for i in range(sh):
        # ease-in so the darkening is gentle at the top of the scrim
        t = i / max(1, sh - 1)
        col.putpixel((0, i), int(max_alpha * (t ** 1.5)))
    alpha = col.resize((w, sh))
    overlay = Image.new("RGBA", (w, sh), color + (0,))
    overlay.putalpha(alpha)
    out = base.convert("RGBA")
    out.alpha_composite(overlay, (0, h - sh))
    return out.convert("RGB")


def _fit_lines(d, text, fo_maker, maxw, start, minsz, lh_factor=1.34,
               max_h=None):
    """Wrap `text` at the largest size (>= minsz) whose wrapped block fits
    maxw wide and (optionally) max_h tall. Returns (font, size, lines, lh)."""
    s = start
    while True:
        fo = fo_maker(s)
        lines = wrap(d, text, fo, maxw)
        lh = int(s * lh_factor)
        if max_h is None or len(lines) * lh <= max_h or s <= minsz:
            return fo, s, lines, lh
        s -= 4


def _fit_one_line(d, text, fo_maker, maxw, start, minsz):
    s = start
    while s > minsz and d.textlength(text, font=fo_maker(s)) > maxw:
        s -= 4
    return fo_maker(s), s


# ── interior pages (all trim-size; padded to full-bleed by to_fb) ────
def title_page(recipient, author):
    """Quiet editorial title: ivory, one fine gold hairline frame, a small-caps
    kicker, the title in espresso Cormorant, a hairline, and a soft byline."""
    img, d = _page()
    cx = TRIM // 2
    M = 240
    # ONE fine gold hairline frame, generously inset (no double keyline).
    d.rectangle([M, M, TRIM - M, TRIM - M], outline=GOLD_DEEP, width=2)
    ls(d, "A KEEPSAKE", PF(40, 500), cx, 580, GOLD, 14)

    lines = ["Everything I Love", f"About {recipient}"]
    y = 850
    for ln in lines:
        fo, s = _fit_one_line(d, ln, lambda z: PF(z, 500),
                              TRIM - 2 * M - 160, 150, 60)
        ctext(d, ln, fo, cx, y, ESPRESSO)
        y += s + 18
    y += 44
    _hairline(d, cx, y, half=190, color=GOLD, width=2)
    ctext(d, f"by {author}", CG(68, 540, it=True), cx, y + 56, STONE)
    return img


def dedication_page(recipient, author, template="about-mama"):
    """Heartfelt dedication: a small-caps 'for', the name set large in italic, a
    warm faith-rooted line, a hairline, and a tender sign-off. Composed with
    generous air so it feels like the opening of a keepsake, not a label."""
    img, d = _page()
    cx = TRIM // 2
    ls(d, "FOR", PF(38, 500), cx, 660, GOLD, 18)
    fo, _ = _fit_one_line(d, recipient, lambda z: PF(z, 500, it=True),
                          TRIM - 760, 168, 76)
    ctext(d, recipient, fo, cx, 770, ESPRESSO)

    ded = DEDICATIONS.get(template, "")
    if ded:
        pf = CG(64, 520, it=True)
        y = 1110
        for ln in wrap(d, ded, pf, TRIM - 2 * 420):
            ctext(d, ln, pf, cx, y, INK)
            y += 96
        y += 70
    else:
        y = 1430
    _hairline(d, cx, y, half=170, color=GOLD, width=2)
    ctext(d, f"with all my love, {author}", CG(62, 540, it=True),
          cx, y + 70, STONE)
    return img


def hero_photo_page(photo, caption):
    """Full-bleed hero: the photo reads edge to edge; the caption sits over a
    soft gradient scrim (no hard band), in ivory italic with a fine gold tick.
    Returns a FULLBLEED image."""
    base = _cover_fit(photo, FULLBLEED, FULLBLEED)
    cap = (caption or "").strip()
    if not cap:
        return base
    base = _bottom_scrim(base, frac=0.42, max_alpha=170)
    d = ImageDraw.Draw(base, "RGBA")
    cx = FULLBLEED // 2
    IVORY = (247, 242, 234)
    fo, s, lines, lh = _fit_lines(
        d, cap, lambda z: CG(z, 520, it=True), FULLBLEED - 2 * (FBM + 360),
        66, 48, lh_factor=1.32, max_h=360)
    block_h = len(lines) * lh
    y = FULLBLEED - FBM - 220 - block_h
    d.line([cx - 70, y - 50, cx + 70, y - 50], fill=GOLD + (235,), width=2)
    for ln in lines:
        ctext(d, ln, fo, cx, y, IVORY)
        y += lh
    return base


def gallery_photo_page(photo, caption, photo_left=True):
    """Editorial gallery page: a single clean photo, CENTRED on the page with
    generous whitespace and ONE fine gold hairline (no mat, no double frame, no
    star). A 4:5 portrait crop (kind to faces) leaves a clean band beneath for
    the caption, which is centred on the page so it always aligns under the
    photo. `photo_left` is accepted for call-site compatibility but the layout
    is symmetric — variety comes from the hero/gallery rhythm, not from
    shoving the photo to one edge."""
    img, d = _page()
    cx = TRIM // 2
    win_w, win_h = 1400, 1750          # 4:5 portrait, portrait-friendly crop
    top = 300
    wx = (TRIM - win_w) // 2           # centred horizontally
    wy = top
    photo_fit = _cover_fit(photo, win_w, win_h)
    img.paste(photo_fit, (wx, wy))
    # one fine gold hairline directly bordering the photo
    d.rectangle([wx, wy, wx + win_w, wy + win_h], outline=GOLD_DEEP, width=2)

    cap = (caption or "").strip()
    if cap:
        cap_top = wy + win_h + 116
        cap_avail_h = TRIM - cap_top - 170
        fo, s, lines, lh = _fit_lines(
            d, cap, lambda z: CG(z, 500, it=True), TRIM - 2 * 360, 78, 44,
            lh_factor=1.34, max_h=max(100, cap_avail_h))
        block_h = len(lines) * lh
        y = cap_top + max(0, (cap_avail_h - block_h) // 2)
        for ln in lines:
            ctext(d, ln, fo, cx, y, ESPRESSO)
            y += lh
    return img


def dua_page(template):
    """Calligraphic Arabic (17:24) + transliteration + English + reference, set
    quietly on ivory with one fine hairline frame. Arabic is shaped RTL via the
    duas_pipeline approach (AR/reshape) — DO NOT change the text or shaping."""
    dua = DUA[template]
    img, d = _page()
    cx = TRIM // 2
    M = 250
    d.rectangle([M, M, TRIM - M, TRIM - M], outline=GOLD_DEEP, width=2)
    ls(d, dua["label"], PF(40, 500), cx, 620, GOLD, 8)

    # Arabic — shaped + fit to width (verified glyphs, RTL).
    rsh = reshape(dua["arabic"])
    s = 124
    while s > 50 and d.textlength(rsh, font=AR(s)) > TRIM - 2 * M - 80:
        s -= 2
    afo = AR(s)
    y = 1000
    ctext(d, rsh, afo, cx, y, ESPRESSO)
    y += s + 150
    _hairline(d, cx, y - 30, half=170, color=GOLD, width=2)
    # transliteration
    trf = CG(58, 520, it=True)
    for ln in wrap(d, dua["translit"], trf, TRIM - 2 * M):
        ctext(d, ln, trf, cx, y, STONE)
        y += 84
    y += 44
    # english
    enf = CG(54, 520)
    for ln in wrap(d, dua["english"], enf, TRIM - 2 * M):
        ctext(d, ln, enf, cx, y, INK)
        y += 78
    y += 46
    ls(d, dua["ref"].upper(), PF(38, 500), cx, y, GOLD, 6)
    return img


def closing_page(author):
    img, d = _page()
    cx = TRIM // 2
    ctext(d, "Made with love", PF(104, 500, it=True), cx, 1060, ESPRESSO)
    ctext(d, f"by {author}", CG(72, 540, it=True), cx, 1230, STONE)
    _hairline(d, cx, 1450, half=210, color=GOLD, width=2)
    ls(d, "KETABI STUDIO", PF(42, 500), cx, 1530, GOLD, 14)
    return img


# ── cover ───────────────────────────────────────────────────────────
def _front_cover(recipient, author, cover_photo):
    """Premium full-bleed cover: the photo runs edge to edge; the title is set
    over a soft bottom scrim in ivory Playfair with a small-caps kicker, a fine
    gold rule, and an italic byline — a coffee-table / fine-art book feel."""
    base = _cover_fit(cover_photo, FULLBLEED, FULLBLEED)
    base = _bottom_scrim(base, frac=0.62, max_alpha=195)
    d = ImageDraw.Draw(base, "RGBA")
    cx = FULLBLEED // 2
    IVORY = (247, 242, 234)
    M = FBM + 280  # side margin for the title text

    y = int(FULLBLEED * 0.60)
    ls(d, "A KEEPSAKE", PF(44, 500), cx, y, GOLD_ON_DARK, 16)
    y += 130
    for ln in ["Everything I Love", f"About {recipient}"]:
        fo, s = _fit_one_line(d, ln, lambda z: PF(z, 500),
                              FULLBLEED - 2 * M, 150, 64)
        ctext(d, ln, fo, cx, y, IVORY)
        y += s + 16
    y += 40
    d.line([cx - 150, y, cx + 150, y], fill=GOLD_ON_DARK + (240,), width=2)
    y += 56
    ctext(d, f"by {author}", CG(64, 540, it=True), cx, y, IVORY)
    return base


def _back_cover(recipient, author):
    img = Image.new("RGB", (FULLBLEED, FULLBLEED), BONE)
    d = ImageDraw.Draw(img)
    cx = FULLBLEED // 2
    inset = FBM + 120
    d.rectangle([inset, inset, FULLBLEED - inset, FULLBLEED - inset],
                outline=GOLD_DEEP, width=2)
    blurb = (f"Twenty things {author} loves about {recipient} — in {author}'s "
             "own photos and words, sealed with the dua for parents.")
    fo = CG(60, 520, it=True)
    y = 1060
    for ln in wrap(d, blurb, fo, FULLBLEED - 2 * inset - 200):
        ctext(d, ln, fo, cx, y, ESPRESSO)
        y += 92
    ls(d, "KETABI STUDIO", PF(40, 500), cx, FULLBLEED - inset - 170, GOLD, 14)
    return img


# fixed softcover wrap geometry (17.39 x 8.75in @ 300 DPI) — no Lulu needed
SOFTCOVER_WRAP_PX = (5217, 2625)
SOFTCOVER_SPINE = 60


def cover_wrap(recipient, author, cover_photo, cover_type="softcover",
               client=None, page_count=32, pod=None):
    """Full-bleed Lulu wrap: back + spine + front.

    softcover: 17.39x8.75in perfect-bound wrap (same as the books) — built from
      the FIXED size, so the sample/CI render needs no Lulu keys.
    hardcover: casewrap sized EXACTLY from Lulu calculate_cover_dimensions for
      the hardcover POD + page count (reuses the duas hardcover approach). The
      casewrap spine/turn-in geometry is a first cut — flag for human review on
      the first real hardcover proof; the Lulu validate-cover gate protects it.
    """
    fc = _front_cover(recipient, author, cover_photo)
    bc = _back_cover(recipient, author)
    if cover_type == "hardcover":
        from lulu_client import HARDCOVER_POD, cover_dims_to_px
        if client is None:
            raise RuntimeError(
                "hardcover cover generation requires a Lulu client to query "
                "cover dimensions")
        pod = pod or HARDCOVER_POD
        dims = client.calculate_cover_dimensions(pod, page_count)
        total_w, total_h = cover_dims_to_px(dims)  # px @ 300 DPI
        spine = max(0, total_w - 2 * FULLBLEED)
        wrap = Image.new("RGB", (max(total_w, 2 * FULLBLEED + spine),
                                 max(total_h, FULLBLEED)), BONE)
        y_off = (wrap.height - FULLBLEED) // 2
        wrap.paste(bc, (0, y_off))
        wrap.paste(fc, (FULLBLEED + spine, y_off))
        if spine > 0:
            ImageDraw.Draw(wrap).rectangle(
                [FULLBLEED, 0, FULLBLEED + spine, wrap.height],
                fill=lerp(BONE, GOLD, 0.12))
        if y_off > 0:
            top = wrap.crop((0, y_off, wrap.width, y_off + 1)).resize(
                (wrap.width, y_off))
            wrap.paste(top, (0, 0))
            bot = wrap.crop(
                (0, y_off + FULLBLEED - 1, wrap.width, y_off + FULLBLEED)
            ).resize((wrap.width, wrap.height - (y_off + FULLBLEED)))
            wrap.paste(bot, (0, y_off + FULLBLEED))
        wrap = wrap.resize((total_w, total_h), Image.LANCZOS)
        return wrap, fc
    # ── softcover (perfect bound) — fixed geometry, no Lulu call ──────
    spine = SOFTCOVER_SPINE
    W, H = spine + 2 * FULLBLEED, FULLBLEED
    wrap = Image.new("RGB", (W, H), BONE)
    wrap.paste(bc, (0, 0))
    wrap.paste(fc, (FULLBLEED + spine, 0))
    ImageDraw.Draw(wrap).rectangle([FULLBLEED, 0, FULLBLEED + spine, H],
                                   fill=lerp(BONE, GOLD, 0.12))
    wrap = wrap.resize(SOFTCOVER_WRAP_PX, Image.LANCZOS)  # 17.39 x 8.75 @ 300
    return wrap, fc


# ── page plan ───────────────────────────────────────────────────────
# EVERY interior page carries one of the customer's photos with its caption
# baked on (no ornament versos, no quote filler). For rhythm we mix two
# treatments and space the full-bleed heroes through the run so they feel
# special rather than relentless:
#
#   hero page   = full-bleed photo (bleeds past trim) with the caption set in a
#                 translucent forest band near the bottom.
#   framed page = framed inset on a cream page (thin gold keyline + mat, photo
#                 offset to one side), caption in Cormorant Italic beneath.
#
# Roughly one in three pages is a hero (well distributed); the rest are framed,
# alternating which side the photo hugs so facing pages feel composed.
def _is_hero(index_1based):
    """Heroes spaced ~1-in-3 through the run (pages 1, 4, 7, ...)."""
    return index_1based % 3 == 1


def _plan_photo_pages(photos, captions):
    """Build the photo section as ONE page per photo (caption baked on).
    Returns a flat list of render thunks."""
    thunks = []
    framed_index = 0
    for i, (photo, cap) in enumerate(zip(photos, captions), start=1):
        if _is_hero(i):
            thunks.append(
                lambda photo=photo, cap=cap: hero_photo_page(photo, cap))
        else:
            left = (framed_index % 2 == 0)
            framed_index += 1
            thunks.append(
                lambda photo=photo, cap=cap, left=left:
                gallery_photo_page(photo, cap, photo_left=left))
    return thunks


# ── build ───────────────────────────────────────────────────────────
def build(photo_data, out_dir, cover_type="hardcover", client=None,
          page_count=24, pod=None, template="about-mama"):
    """Build the interior PDF + cover PDF from a customer's photo_data.

    Returns (interior_pdf_path, cover_pdf_path, page_count).

    photo_data = { recipient_name, author_name, cover_photo_url,
                   pages: [ { photo_url, caption }, ... ] }  # 20 pages

    Precise 24-page composition — EVERY interior page is a customer photo:
      front = title + dedication ......................... 2
      body  = 20 photo pages (1 photo + caption each) ... 20
      back  = dua + closing .............................. 2
      total ............................................. 24
    Heroes (~1-in-3) are full-bleed pages with a translucent caption band; the
    rest are framed insets on cream with the caption beneath, alternating side.
    There are NO ornament/quote/filler pages. The final total is asserted ==
    page_count and the photo count is asserted to match exactly.

    Pages are streamed to disk (render -> JPEG -> free) and the interior is
    assembled with img2pdf for a low memory footprint, exactly like the books.
    """
    import img2pdf

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    recipient = (photo_data.get("recipient_name") or "Mama").strip()
    author = (photo_data.get("author_name") or "").strip()
    pages = photo_data.get("pages") or []
    if not pages:
        raise RuntimeError("photo book has no pages")

    # Download every photo up front; any failure raises (never ship a blank).
    cover_photo = _download(photo_data.get("cover_photo_url"))
    photos = [_download(pg.get("photo_url")) for pg in pages]
    captions = [(pg.get("caption") or "").strip() for pg in pages]

    front = [
        lambda: title_page(recipient, author),
        lambda: dedication_page(recipient, author, template),
    ]
    photo_pages = _plan_photo_pages(photos, captions)   # 1 page per photo
    back = [
        lambda: dua_page(template),
        lambda: closing_page(author),
    ]

    # Every interior page is a customer photo: the photo count must EXACTLY fill
    # the spec between the 4 designed pages (title/dedication/dua/closing). The
    # order API enforces this; assert here so we never ship a wrong page count.
    expected_photos = page_count - len(front) - len(back)
    if len(photo_pages) != expected_photos:
        raise RuntimeError(
            f"photo book needs exactly {expected_photos} photos for a "
            f"{page_count}-page book, got {len(photo_pages)}")

    thunks = front + photo_pages + back

    assert len(thunks) == page_count, (
        f"photo book page math is {len(thunks)}, must be exactly {page_count}")

    jpgs = []
    for i, mk in enumerate(thunks):
        img = to_fb(mk())  # full-bleed (8.75in) — hero pages already are
        if img.mode != "RGB":
            img = img.convert("RGB")
        jp = out / f"page{i + 1:02d}.jpg"
        img.save(jp, "JPEG", quality=90, dpi=(300, 300))
        jpgs.append(str(jp))
        img.close()
        del img
        gc.collect()

    n_pages = len(jpgs)
    interior = out / "interior.pdf"
    with open(interior, "wb") as f:
        f.write(img2pdf.convert(jpgs))

    if cover_type == "hardcover" and client is None:
        import lulu_client as _lc
        client = _lc.LuluClient(
            client_key="".join(os.environ.get("LULU_CLIENT_KEY", "").split()),
            client_secret="".join(
                os.environ.get("LULU_CLIENT_SECRET", "").split()),
            env=os.environ.get("LULU_ENV", "sandbox").strip())

    wrap, fc = cover_wrap(recipient, author, cover_photo,
                          cover_type=cover_type, client=client,
                          page_count=page_count, pod=pod)
    fc.save(out / "cover_front.jpg", "JPEG", quality=90)
    wrap.save(out / "cover.jpg", "JPEG", quality=90)
    wrap.save(out / "cover.pdf", "PDF", resolution=300.0)
    print(f"built photo book: {n_pages} interior pages + cover {wrap.size}",
          flush=True)
    gc.collect()
    return str(interior), str(out / "cover.pdf"), n_pages


if __name__ == "__main__":
    import sys
    # Smoke test expects two local/remote image URLs passed as args.
    urls = sys.argv[1:3] or ["", ""]
    sample = {
        "recipient_name": "Mama",
        "author_name": "Yusuf",
        "cover_photo_url": urls[0],
        "pages": [{"photo_url": urls[1] or urls[0], "caption": c}
                  for c in [
                      "Mama, Allah blessed me with you.",
                      "You are the first dua Allah answered for me.",
                      "You teach me to love Allah.",
                      "I love praying right beside you.",
                      "Thank you for every duʿā you make for me.",
                      "You fill our home with barakah.",
                      "Your hugs make everything better.",
                      "You read to me until my eyes grow sleepy.",
                      "When I'm scared, you remind me Allah is near.",
                      "I love the way you say bismillah before everything.",
                      "You wipe my tears and make a dua over me.",
                      "You're the first to make duʿā when I'm sick.",
                      "You celebrate every little thing I learn.",
                      "Your kitchen smells like love and good things.",
                      "You forgive me before I even finish saying sorry.",
                      "You are gentle with me on my hardest days.",
                      "Being your child is a gift from Allah.",
                      "I want to make you proud, in this life and the next.",
                      "I pray we're together in Jannah, always.",
                      "I love you more than all the stars, Mama.",
                  ]],
    }
    # Standalone smoke test uses the fixed softcover wrap so no Lulu keys are
    # needed; production orders build the hardcover casewrap via Lulu.
    build(sample, "/tmp/photobook_sample", cover_type="softcover")
