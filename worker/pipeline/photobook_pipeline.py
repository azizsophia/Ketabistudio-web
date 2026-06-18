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

# ── premium keepsake palette (2026-27 best practices) ───────────────
# Warm cream base, deep forest green, gold (light + deep), one soft terracotta
# accent used sparingly. 3-4 colours, cohesive and timeless.
CREAM = (250, 246, 238)      # #FAF6EE  page base
FOREST = (46, 74, 58)        # #2E4A3A  deep forest green (primary ink)
GOLD = (201, 168, 76)        # #C9A84C  gold (rules / display)
GOLD_DEEP = (160, 127, 74)   # #A07F4A  deep gold (fine keylines)
TERRA = (200, 128, 106)      # #C8806A  soft terracotta/rose (accent, sparing)
INK = (52, 58, 52)           # near-forest body ink for long captions
GRAY = (122, 124, 116)       # muted secondary text
PAPER = (255, 252, 246)      # photo-mat / inset paper (a touch brighter)

# The dua printed on the dua page. VERIFIED — Qur'an 17:24. Mirrors
# lib/photobook.ts; render EXACTLY (the Arabic is shaped RTL by AR/reshape).
DUA = {
    "about-mama": {
        "arabic": "رَّبِّ ٱرْحَمْهُمَا كَمَا رَبَّيَانِى صَغِيرًا",
        "translit": "Rabbi-rḥamhumā kamā rabbayānī ṣaghīrā",
        "english":
            "My Lord, have mercy upon them as they raised me when I was small.",
        "ref": "Qur'an 17:24",
    },
}
TITLES = {"about-mama": "Everything I Love About Mama"}


def CG(sz, w=600, it=False):
    f = ImageFont.truetype(CORM_IT if it else CORM, sz)
    try:
        f.set_variation_by_axes([w])
    except Exception:
        pass
    return f


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
def _cream_page():
    """A bare cream trim-size page with generous breathing room (no frame)."""
    img = Image.new("RGB", (TRIM, TRIM), CREAM)
    return img, ImageDraw.Draw(img)


def _gold_rule(d, cx, y, half=320, color=GOLD, width=3, dot=True):
    """A centred gold hairline with an optional small star at its centre."""
    d.line([cx - half, y, cx + half, y], fill=color, width=width)
    if dot:
        star_n(d, cx, y, 11, 8, fill=color)


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
    """Designed title: cream + forest, gold rule, gold display title."""
    img, d = _cream_page()
    cx = TRIM // 2
    M = 300  # generous side margin
    # slim double keyline frame, well inside the safe area
    d.rectangle([M - 70, M - 70, TRIM - M + 70, TRIM - M + 70],
                outline=GOLD, width=3)
    d.rectangle([M - 54, M - 54, TRIM - M + 54, TRIM - M + 54],
                outline=GOLD_DEEP, width=1)
    star_n(d, cx, 460, 26, 8, fill=GOLD)
    ls(d, "A KETABI STUDIO KEEPSAKE", CG(40, 600), cx, 560, GOLD_DEEP, 8)

    lines = ["Everything I Love", f"About {recipient}"]
    y = 760
    for ln in lines:
        fo, s = _fit_one_line(d, ln, lambda z: CG(z, 660), TRIM - 2 * M, 158, 70)
        ctext(d, ln, fo, cx, y, FOREST)
        y += s + 18
    y += 40
    _gold_rule(d, cx, y, half=300, color=GOLD, width=3)
    ctext(d, f"by {author}", CG(76, 560, it=True), cx, y + 70, TERRA)
    return img


def dedication_page(recipient, author):
    img, d = _cream_page()
    cx = TRIM // 2
    star_n(d, cx, 640, 22, 8, fill=GOLD)
    msg = f"For {recipient},"
    sub = f"with love — {author}"
    ctext(d, msg, CG(120, 560, it=True), cx, 980, FOREST)
    ctext(d, sub, CG(86, 560, it=True), cx, 1170, INK)
    _gold_rule(d, cx, 1420, half=210, color=GOLD_DEEP, width=2, dot=False)
    star_n(d, cx, 1420, 12, 8, fill=TERRA)
    return img


def hero_photo_page(photo, caption):
    """Full-bleed hero: photo bleeds past trim, caption sits in a small
    translucent forest band near the bottom. Returns a FULLBLEED image."""
    base = _cover_fit(photo, FULLBLEED, FULLBLEED)
    cap = (caption or "").strip()
    if cap:
        d = ImageDraw.Draw(base, "RGBA")
        # caption band — translucent forest, content kept inside the safe area
        fo, s, lines, lh = _fit_lines(
            d, cap, lambda z: CG(z, 540, it=True), FULLBLEED - 2 * (FBM + 220),
            72, 56, lh_factor=1.3, max_h=420)
        block_h = len(lines) * lh
        band_h = block_h + 150
        band_top = FULLBLEED - FBM - band_h - 90
        d.rectangle([0, band_top, FULLBLEED, band_top + band_h],
                    fill=(FOREST[0], FOREST[1], FOREST[2], 205))
        # thin gold edge on the band
        d.line([0, band_top, FULLBLEED, band_top], fill=GOLD + (235,), width=3)
        cx = FULLBLEED // 2
        y = band_top + 60
        for ln in lines:
            ctext(d, ln, fo, cx, y, (250, 246, 238))
            y += lh
    return base


def framed_photo_page(photo, caption, photo_left=True):
    """Framed inset on a cream page: thin gold keyline + mat, generous margins,
    a short baseline-anchored caption beneath in Cormorant Italic. The photo is
    offset to one side (alternating across spreads) so the book feels composed
    rather than 12 identical pages."""
    img, d = _cream_page()
    cx = TRIM // 2
    # Asymmetric margins so the page breathes; the photo hugs one side.
    near = 250   # margin on the side the photo hugs
    far = 470    # larger margin on the far side -> generous whitespace
    top = 360
    win = TRIM - near - far
    win_h = win
    wx = near if photo_left else far
    wy = top

    # mat + keyline
    mat = 28
    d.rectangle([wx - mat, wy - mat, wx + win + mat, wy + win_h + mat],
                fill=PAPER, outline=GOLD, width=4)
    d.rectangle([wx - mat + 9, wy - mat + 9, wx + win + mat - 9,
                 wy + win_h + mat - 9], outline=GOLD_DEEP, width=1)
    photo_fit = _cover_fit(photo, win, win_h)
    img.paste(photo_fit, (wx, wy))
    d.rectangle([wx, wy, wx + win, wy + win_h], outline=GOLD_DEEP, width=2)

    # short caption beneath, centred under the photo column
    cap = (caption or "").strip()
    if cap:
        col_cx = wx + win // 2
        cap_top = wy + win_h + mat + 90
        cap_avail_h = TRIM - cap_top - 180
        fo, s, lines, lh = _fit_lines(
            d, cap, lambda z: CG(z, 520, it=True), win + 2 * mat + 40, 84, 48,
            lh_factor=1.32, max_h=max(110, cap_avail_h))
        block_h = len(lines) * lh
        y = cap_top + max(0, (cap_avail_h - block_h) // 2)
        for ln in lines:
            ctext(d, ln, fo, col_cx, y, FOREST)
            y += lh
        star_n(d, col_cx, y + 44, 8, 8, fill=TERRA)
    return img


def dua_page(template):
    """Calligraphic Arabic (17:24) + transliteration + English + reference.
    Arabic is shaped RTL via the duas_pipeline approach (AR/reshape) — DO NOT
    change the text or the shaping path."""
    dua = DUA[template]
    img, d = _cream_page()
    cx = TRIM // 2
    M = 280
    d.rectangle([M - 60, M - 60, TRIM - M + 60, TRIM - M + 60],
                outline=GOLD, width=2)
    star_n(d, cx, 470, 20, 8, fill=GOLD)
    ls(d, "A DUA FOR MAMA & BABA", CG(44, 600), cx, 600, TERRA, 4)

    # Arabic — shaped + fit to width (verified glyphs, RTL).
    rsh = reshape(dua["arabic"])
    s = 124
    while s > 50 and d.textlength(rsh, font=AR(s)) > TRIM - 2 * M:
        s -= 2
    afo = AR(s)
    y = 960
    ctext(d, rsh, afo, cx, y, FOREST)
    y += s + 150
    _gold_rule(d, cx, y - 30, half=180, color=GOLD, width=2)
    # transliteration
    trf = CG(60, 520, it=True)
    for ln in wrap(d, dua["translit"], trf, TRIM - 2 * M):
        ctext(d, ln, trf, cx, y, GRAY)
        y += 86
    y += 46
    # english
    enf = CG(56, 520)
    for ln in wrap(d, dua["english"], enf, TRIM - 2 * M):
        ctext(d, ln, enf, cx, y, INK)
        y += 80
    y += 44
    ctext(d, dua["ref"], CG(44, 600), cx, y, GOLD_DEEP)
    return img


def closing_page(author):
    img, d = _cream_page()
    cx = TRIM // 2
    star_n(d, cx, 720, 26, 8, fill=GOLD)
    ctext(d, "Made with love", CG(116, 560, it=True), cx, 1010, FOREST)
    ctext(d, f"by {author}", CG(86, 520, it=True), cx, 1200, TERRA)
    _gold_rule(d, cx, 1440, half=260, color=GOLD, width=2)
    ls(d, "KETABI STUDIO", CG(46, 600), cx, 1540, GOLD_DEEP, 8)
    return img


# ── cover ───────────────────────────────────────────────────────────
def _front_cover(recipient, author, cover_photo):
    """Designed cream/gold front panel with a small framed photo window."""
    img = Image.new("RGB", (FULLBLEED, FULLBLEED), CREAM)
    d = ImageDraw.Draw(img)
    cx = FULLBLEED // 2
    # outer gold rules
    d.rectangle([FBM + 50, FBM + 50, FULLBLEED - FBM - 50, FULLBLEED - FBM - 50],
                outline=GOLD, width=5)
    d.rectangle([FBM + 72, FBM + 72, FULLBLEED - FBM - 72, FULLBLEED - FBM - 72],
                outline=GOLD_DEEP, width=1)
    star_n(d, cx, 470, 28, 8, fill=GOLD)
    ls(d, "A KETABI STUDIO KEEPSAKE", CG(38, 600), cx, 560, GOLD_DEEP, 6)
    # title
    y = 660
    for ln in ["Everything I Love", f"About {recipient}"]:
        fo, s = _fit_one_line(d, ln, lambda z: CG(z, 660), FULLBLEED - 760,
                              150, 64)
        ctext(d, ln, fo, cx, y, FOREST)
        y += s + 18
    # small framed photo window
    win = 980
    wx, wy = cx - win // 2, y + 100
    frame_pad = 26
    d.rectangle([wx - frame_pad, wy - frame_pad, wx + win + frame_pad,
                 wy + win + frame_pad], fill=PAPER, outline=GOLD, width=6)
    d.rectangle([wx - frame_pad + 10, wy - frame_pad + 10,
                 wx + win + frame_pad - 10, wy + win + frame_pad - 10],
                outline=GOLD_DEEP, width=1)
    photo = _cover_fit(cover_photo, win, win)
    img.paste(photo, (wx, wy))
    d.rectangle([wx, wy, wx + win, wy + win], outline=GOLD_DEEP, width=2)
    # byline
    ctext(d, f"by {author}", CG(70, 560, it=True), cx, wy + win + 120, TERRA)
    return img


def _back_cover(recipient, author):
    img = Image.new("RGB", (FULLBLEED, FULLBLEED), CREAM)
    d = ImageDraw.Draw(img)
    cx = FULLBLEED // 2
    d.rectangle([FBM + 50, FBM + 50, FULLBLEED - FBM - 50, FULLBLEED - FBM - 50],
                outline=GOLD, width=5)
    d.rectangle([FBM + 72, FBM + 72, FULLBLEED - FBM - 72, FULLBLEED - FBM - 72],
                outline=GOLD_DEEP, width=1)
    star_n(d, cx, 720, 24, 8, fill=GOLD)
    blurb = (f"Twenty things {author} loves about {recipient} — in {author}'s "
             "own photos and words, sealed with the dua for parents.")
    fo = CG(64, 520, it=True)
    y = 1020
    for ln in wrap(d, blurb, fo, FULLBLEED - 940):
        ctext(d, ln, fo, cx, y, FOREST)
        y += 96
    ls(d, "KETABI STUDIO", CG(42, 600), cx, FULLBLEED - FBM - 210, GOLD_DEEP, 8)
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
                                 max(total_h, FULLBLEED)), CREAM)
        y_off = (wrap.height - FULLBLEED) // 2
        wrap.paste(bc, (0, y_off))
        wrap.paste(fc, (FULLBLEED + spine, y_off))
        if spine > 0:
            ImageDraw.Draw(wrap).rectangle(
                [FULLBLEED, 0, FULLBLEED + spine, wrap.height],
                fill=lerp(CREAM, GOLD, 0.14))
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
    wrap = Image.new("RGB", (W, H), CREAM)
    wrap.paste(bc, (0, 0))
    wrap.paste(fc, (FULLBLEED + spine, 0))
    ImageDraw.Draw(wrap).rectangle([FULLBLEED, 0, FULLBLEED + spine, H],
                                   fill=lerp(CREAM, GOLD, 0.14))
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
                framed_photo_page(photo, cap, photo_left=left))
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
        lambda: dedication_page(recipient, author),
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
