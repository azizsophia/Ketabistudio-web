#!/usr/bin/env python3
"""
Render engine for Ketabi Studio PHOTO-BOOK keepsakes.

A photo book is built from the CUSTOMER's own uploaded photos + editable
captions (orders.photo_data). It is the same physical spec as the existing
books — 8.5x8.5in trim, 32 physical pages, full-bleed 8.75in, 300 DPI — and
prints through the same Lulu rails (softcover perfect-bound or hardcover
casewrap).

Type system (worker/fonts):
  Cormorant Garamond + Cormorant Italic  — English display/serif
  Amiri                                  — Arabic (the dua page)

This module deliberately reuses the proven primitives from duas_pipeline:
  - FULLBLEED (2625 px @ 300 DPI) + to_fb full-bleed padding
  - the _RAQM / AR() / reshape() Arabic shaping (RTL, exact glyphs)
  - the img2pdf streaming build (render -> save JPEG -> free, per page)
  - the hardcover casewrap cover-wrap via Lulu calculate_cover_dimensions

Env: nothing extra (photos are downloaded from public URLs in photo_data).
"""
import gc
import io
import os
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

# Reuse the verified Arabic shaping + full-bleed helpers from the duas engine so
# the dua renders identically (exact glyphs, correct RTL) and the page geometry
# matches the existing books exactly.
from duas_pipeline import (
    FULLBLEED, TRIM, FBM, CREAM, GOLD, DARK, GRAY, BORD, BYL, ACCENT,
    AR, reshape, to_fb, wrap, ctext, ls, star_n, lerp,
)

FD = Path(__file__).resolve().parent.parent / "fonts"
CORM = str(FD / "Cormorant.ttf")
CORM_IT = str(FD / "Cormorant-Italic.ttf")

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
    NEVER ship a blank page."""
    if not url:
        raise RuntimeError("photo url missing")
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content))
    img.load()
    return img.convert("RGB")


def _cover_fit(img, w, h):
    """Cover-fit (fill + centre-crop) a photo into a w x h box."""
    sc = max(w / img.width, h / img.height)
    nw, nh = max(1, int(img.width * sc)), max(1, int(img.height * sc))
    r = img.resize((nw, nh), Image.LANCZOS)
    x0, y0 = (nw - w) // 2, (nh - h) // 2
    return r.crop((x0, y0, x0 + w, y0 + h))


# ── design helpers ──────────────────────────────────────────────────
def _blank(frame=True, border=BORD):
    img = Image.new("RGB", (TRIM, TRIM), CREAM)
    d = ImageDraw.Draw(img)
    if frame:
        d.rectangle([54, 54, TRIM - 54, TRIM - 54], outline=GOLD, width=4)
        d.rectangle([70, 70, TRIM - 70, TRIM - 70], outline=border, width=2)
    return img, d


def _fit_title(d, text, maxw, start, minsz, it=True, w=700):
    s = start
    while s > minsz and d.textlength(text, font=CG(s, w, it=it)) > maxw:
        s -= 4
    return CG(s, w, it=it), s


# ── interior pages (all trim-size; padded to full-bleed by to_fb) ────
def title_page(recipient, author):
    img, d = _blank(frame=True)
    cx = TRIM // 2
    star_n(d, cx, 360, 30, 8)
    title = f"Everything I Love\nAbout {recipient}"
    lines = title.split("\n")
    y = 560
    for ln in lines:
        fo, s = _fit_title(d, ln, TRIM - 440, 150, 70)
        ctext(d, ln, fo, cx, y, GOLD)
        y += s + 30
    d.line([cx - 320, y + 60, cx + 320, y + 60], fill=BORD, width=2)
    star_n(d, cx, y + 60, 12, 8)
    ctext(d, f"by {author}", CG(72, 600, it=True), cx, y + 150, DARK)
    ls(d, "A KETABI STUDIO KEEPSAKE", CG(40, 600), cx, TRIM - 320, BYL, 8)
    return img


def dedication_page(recipient, author):
    img, d = _blank(frame=True)
    cx = TRIM // 2
    star_n(d, cx, 560, 26, 8)
    msg = f"For {recipient},\nwith love — {author}"
    fo = CG(96, 600, it=True)
    y = 980
    for ln in msg.split("\n"):
        for wl in wrap(d, ln, fo, TRIM - 520):
            ctext(d, wl, fo, cx, y, DARK)
            y += 130
    star_n(d, cx, y + 120, 14, 8)
    return img


def caption_page(caption):
    """Verso: a luxury cream caption page (the child's words)."""
    img, d = _blank(frame=True)
    cx = TRIM // 2
    star_n(d, cx, 470, 20, 8)
    # Fit the caption to a generous serif, centred vertically.
    s = 110
    while s > 46:
        fo = CG(s, 500, it=True)
        lines = wrap(d, caption, fo, TRIM - 540)
        lh = int(s * 1.42)
        if len(lines) * lh <= TRIM - 1100:
            break
        s -= 4
    fo = CG(s, 500, it=True)
    lines = wrap(d, caption, fo, TRIM - 540)
    lh = int(s * 1.42)
    y = (TRIM - len(lines) * lh) // 2
    for ln in lines:
        ctext(d, ln, fo, cx, y, DARK)
        y += lh
    d.line([cx - 160, TRIM - 470, cx + 160, TRIM - 470], fill=BORD, width=2)
    return img


def photo_page(photo):
    """Recto: the customer photo, cover-fit full-bleed with a subtle inset
    frame. Returns a FULLBLEED image directly (already bled)."""
    base = _cover_fit(photo, FULLBLEED, FULLBLEED)
    d = ImageDraw.Draw(base)
    # subtle inset frame, kept inside the safe area
    m = FBM + 40
    d.rectangle([m, m, FULLBLEED - m, FULLBLEED - m], outline=(255, 250, 240),
                width=5)
    d.rectangle([m + 12, m + 12, FULLBLEED - m - 12, FULLBLEED - m - 12],
                outline=GOLD, width=2)
    return base


def dua_page(template):
    """Calligraphic Arabic (17:24) + transliteration + English + reference.
    Arabic is shaped RTL via the duas_pipeline approach (AR/reshape)."""
    dua = DUA[template]
    img, d = _blank(frame=True)
    cx = TRIM // 2
    star_n(d, cx, 470, 22, 8)
    ls(d, "A DUA FOR MAMA & BABA", CG(44, 600), cx, 620, ACCENT, 4)
    # Arabic — shaped + fit to width.
    rsh = reshape(dua["arabic"])
    s = 120
    while s > 50 and d.textlength(rsh, font=AR(s)) > TRIM - 460:
        s -= 2
    afo = AR(s)
    y = 1000
    ctext(d, rsh, afo, cx, y, DARK)
    y += s + 90
    # transliteration
    trf = CG(58, 500, it=True)
    for ln in wrap(d, dua["translit"], trf, TRIM - 520):
        ctext(d, ln, trf, cx, y, GRAY)
        y += 84
    y += 50
    # english
    enf = CG(54, 500)
    for ln in wrap(d, dua["english"], enf, TRIM - 540):
        ctext(d, ln, enf, cx, y, ACCENT)
        y += 78
    y += 40
    ctext(d, dua["ref"], CG(42, 600), cx, y, BYL)
    return img


def closing_page(author):
    img, d = _blank(frame=True)
    cx = TRIM // 2
    star_n(d, cx, 700, 30, 8)
    ctext(d, "Made with love", CG(110, 600, it=True), cx, 1020, GOLD)
    ctext(d, f"by {author}", CG(84, 500, it=True), cx, 1200, DARK)
    d.line([cx - 280, 1430, cx + 280, 1430], fill=BORD, width=2)
    ls(d, "KETABI STUDIO", CG(46, 600), cx, 1520, BYL, 8)
    return img


def spacer_page():
    """A quiet cream page (gold star) used to pad to exactly 32 pages."""
    img, d = _blank(frame=True)
    star_n(d, TRIM // 2, TRIM // 2, 24, 8)
    return img


# ── cover ───────────────────────────────────────────────────────────
def _front_cover(recipient, author, cover_photo):
    """Designed cream/gold front panel with a small framed photo window."""
    img = Image.new("RGB", (FULLBLEED, FULLBLEED), CREAM)
    d = ImageDraw.Draw(img)
    cx = FULLBLEED // 2
    # outer gold rule
    d.rectangle([FBM + 40, FBM + 40, FULLBLEED - FBM - 40, FULLBLEED - FBM - 40],
                outline=GOLD, width=6)
    d.rectangle([FBM + 64, FBM + 64, FULLBLEED - FBM - 64, FULLBLEED - FBM - 64],
                outline=BORD, width=2)
    star_n(d, cx, 470, 30, 8)
    # title
    y = 640
    for ln in ["Everything I Love", f"About {recipient}"]:
        fo, s = _fit_title(d, ln, FULLBLEED - 720, 150, 64)
        ctext(d, ln, fo, cx, y, GOLD)
        y += s + 24
    # small framed photo window
    win = 980
    wx, wy = cx - win // 2, y + 90
    frame_pad = 26
    d.rectangle([wx - frame_pad, wy - frame_pad, wx + win + frame_pad,
                 wy + win + frame_pad], fill=(255, 250, 240), outline=GOLD,
                width=6)
    photo = _cover_fit(cover_photo, win, win)
    img.paste(photo, (wx, wy))
    d.rectangle([wx, wy, wx + win, wy + win], outline=BORD, width=2)
    # byline
    ctext(d, f"by {author}", CG(70, 600, it=True), cx, wy + win + 110, DARK)
    ls(d, "A KETABI STUDIO KEEPSAKE", CG(38, 600), cx, FULLBLEED - FBM - 150,
       BYL, 6)
    return img


def _back_cover(recipient, author):
    img = Image.new("RGB", (FULLBLEED, FULLBLEED), CREAM)
    d = ImageDraw.Draw(img)
    cx = FULLBLEED // 2
    d.rectangle([FBM + 40, FBM + 40, FULLBLEED - FBM - 40, FULLBLEED - FBM - 40],
                outline=GOLD, width=6)
    d.rectangle([FBM + 64, FBM + 64, FULLBLEED - FBM - 64, FULLBLEED - FBM - 64],
                outline=BORD, width=2)
    star_n(d, cx, 700, 26, 8)
    blurb = (f"Ten things {author} loves about {recipient} — in {author}'s own "
             "photos and words, sealed with the dua for parents.")
    fo = CG(64, 500, it=True)
    y = 1020
    for ln in wrap(d, blurb, fo, FULLBLEED - 900):
        ctext(d, ln, fo, cx, y, DARK)
        y += 96
    ls(d, "KETABI STUDIO", CG(42, 600), cx, FULLBLEED - FBM - 200, BYL, 8)
    return img


def cover_wrap(recipient, author, cover_photo, cover_type="softcover",
               client=None, page_count=32, pod=None):
    """Full-bleed Lulu wrap: back + spine + front.

    softcover: 17.39x8.75in perfect-bound wrap (same as the books).
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
    # ── softcover (perfect bound) ────────────────────────────────────
    spine = 60
    W, H = spine + 2 * FULLBLEED, FULLBLEED
    wrap = Image.new("RGB", (W, H), CREAM)
    wrap.paste(bc, (0, 0))
    wrap.paste(fc, (FULLBLEED + spine, 0))
    ImageDraw.Draw(wrap).rectangle([FULLBLEED, 0, FULLBLEED + spine, H],
                                   fill=lerp(CREAM, GOLD, 0.14))
    wrap = wrap.resize((5217, 2625), Image.LANCZOS)  # 17.39 x 8.75 @ 300dpi
    return wrap, fc


# ── build ───────────────────────────────────────────────────────────
def build(photo_data, out_dir, cover_type="softcover", client=None,
          page_count=32, pod=None, template="about-mama"):
    """Build the interior PDF + cover PDF from a customer's photo_data.

    Returns (interior_pdf_path, cover_pdf_path, page_count).

    photo_data = { recipient_name, author_name, cover_photo_url,
                   pages: [ { photo_url, caption }, ... ] }

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

    # Build the page sequence as lazy thunks so each is rendered, saved, freed.
    # Front matter (2) + spreads (10*2=20) + dua + closing = 24 structural
    # pages; the remaining 8 are quiet cream spacers placed BEFORE the closing
    # pages so the book still ends on the dua + signature.
    front = [
        lambda: title_page(recipient, author),
        lambda: dedication_page(recipient, author),
    ]
    spread_thunks = []
    for pg in pages:
        photo = _download(pg.get("photo_url"))
        cap = (pg.get("caption") or "").strip()
        spread_thunks.append(lambda cap=cap: caption_page(cap))      # verso
        spread_thunks.append(lambda photo=photo: photo_page(photo))  # recto
    back = [
        lambda: dua_page(template),
        lambda: closing_page(author),
    ]
    structural = len(front) + len(spread_thunks) + len(back)
    if structural > page_count:
        raise RuntimeError(
            f"photo book would be {structural} pages, exceeds {page_count}")
    pad = page_count - structural  # quiet spacer pages, in even pairs
    spacers = [lambda: spacer_page() for _ in range(pad)]
    thunks = front + spread_thunks + spacers + back

    jpgs = []
    for i, mk in enumerate(thunks):
        img = to_fb(mk())  # full-bleed (8.75in) — photo_page already is
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
                      "You teach me to love Allah.",
                      "I love praying right beside you.",
                      "Thank you for every duʿā you make for me.",
                      "You fill our home with barakah.",
                      "Your hugs make everything better.",
                      "When I'm scared, you remind me Allah is near.",
                      "I love the way you say bismillah before everything.",
                      "I pray we're together in Jannah, always.",
                      "I love you more than all the stars, Mama.",
                  ]],
    }
    build(sample, "/tmp/photobook_sample")
