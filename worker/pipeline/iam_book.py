#!/usr/bin/env python3
"""
Render the "I Am [Child]" personalized book to print-ready PDFs for Lulu.

This book is an HTML template that uses modern CSS (container queries, :has()),
so it is rendered with headless Chromium (Playwright). We produce two PDFs per
order:
  - interior  : the 32 pages (front/back COVER sheets stripped out)
  - cover     : one-piece paperback (bleed) OR hardcover casewrap (wrap+spine)

Tokens filled per order: CHILD_NAME, CHILD_NAME_ARABIC, the four pronoun tokens
(from gender), DEDICATION, PHOTO_COVER + PHOTO_1..12, LOGO, SPINE_IN/WRAP_IN.
Colourway "rose" swaps the teal palette to rose; default is teal.

Lulu specs: 8.5x8.5 trim, 0.125 bleed -> 8.75 interior pages, 300 PPI, sRGB.
Cover sizes are computed from the spine (and wrap for casewrap) Lulu returns.
"""
import base64
import io
import os
import re
from pathlib import Path

import requests
from PIL import Image, ImageOps

# Embed photos at print resolution (not the customer's full multi-megapixel
# originals) so the rendered PDF stays a sane size — 8.5in at 300 DPI ≈ 2550px,
# so ~2800px on the long edge is plenty even full-bleed.
_PHOTO_CAP_PX = 2800
_DATA_URI_CACHE: dict[str, str] = {}


def photo_data_uri(url: str) -> str:
    """Download a customer photo, downscale to print resolution, and return a
    JPEG data URI for embedding. Cached per URL. Falls back to the original URL
    if anything goes wrong (Chromium can still fetch it)."""
    if not url or url.startswith("data:"):
        return url or ""
    if url in _DATA_URI_CACHE:
        return _DATA_URI_CACHE[url]
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content))
        # honour the phone's EXIF orientation (bake it in) so photos don't flip
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        w, h = im.size
        m = max(w, h)
        if m > _PHOTO_CAP_PX:
            s = _PHOTO_CAP_PX / float(m)
            im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
        buf = io.BytesIO()
        im.convert("RGB").save(buf, "JPEG", quality=85, optimize=True)
        uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        if len(_DATA_URI_CACHE) < 64:
            _DATA_URI_CACHE[url] = uri
        return uri
    except Exception:  # noqa: BLE001 — fall back to the URL; never block a render
        return url

DIR = None
for _cand in (
    "/iam-templates",  # container: COPY iam-templates /iam-templates
    str(Path(__file__).resolve().parents[2] / "iam-templates"),  # local repo
    "/public/iam",  # legacy
    str(Path(__file__).resolve().parents[2] / "public" / "iam"),  # legacy
):
    if os.path.isdir(_cand):
        DIR = Path(_cand)
        break
if DIR is None:  # last resort so import never crashes; render will error clearly
    DIR = Path("/iam-templates")

PRONOUNS = {
    "boy":  {"Subject": "He",  "subject": "he",  "object": "him", "possessive": "his"},
    "girl": {"Subject": "She", "subject": "she", "object": "her", "possessive": "her"},
}

# teal palette -> rose palette (only the hues that should change; cream/gold/
# terra are warm neutrals that work in both colourways)
ROSE = {
    "#2f5d57": "#a8596a",   # teal
    "#21443f": "#7e3f4e",   # teal-dk
    "#24493f": "#7a4150",   # dark photo bg
    "#bcd0c9": "#e3c6cd",   # muted tint on dark
}


def _logo_data_uri():
    for p in ("/public/images/logo-vertical-dark.png",
              str(Path(__file__).resolve().parents[2] / "public/images/logo-vertical-dark.png")):
        if os.path.exists(p):
            return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()
    return ""


def _crop_style(crop):
    """Inline style that positions a photo so the customer's chosen crop/zoom is
    exactly what prints. `crop` is the visible source rectangle in fractions
    {x,y,w,h}; we scale the image so that rectangle fills the frame. Empty crop
    -> "" (the CSS default object-fit:cover, centred)."""
    if not crop:
        return ""
    try:
        x, y = float(crop["x"]), float(crop["y"])
        w, h = float(crop["w"]), float(crop["h"])
    except (KeyError, TypeError, ValueError):
        return ""
    if w <= 0 or h <= 0:
        return ""
    wp, hp = 100.0 / w, 100.0 / h
    lp, tp = -(x / w) * 100.0, -(y / h) * 100.0
    return (f"position:absolute;left:{lp:.4f}%;top:{tp:.4f}%;"
            f"width:{wp:.4f}%;height:{hp:.4f}%;max-width:none;object-fit:cover")


def _cover_crop_style(crop):
    """Style for the FULL-BLEED cover photo: object-fit cover + object-position
    from the crop, so it fills the cover and honours where the customer framed it
    without ever distorting (works for any crop aspect)."""
    if not crop:
        return ""
    try:
        x, y = float(crop["x"]), float(crop["y"])
        w, h = float(crop["w"]), float(crop["h"])
    except (KeyError, TypeError, ValueError):
        return ""
    if w <= 0 or h <= 0:
        return ""
    px = (x / (1 - w) * 100.0) if w < 0.999 else 50.0
    py = (y / (1 - h) * 100.0) if h < 0.999 else 50.0
    px = max(0.0, min(100.0, px))
    py = max(0.0, min(100.0, py))
    return f"object-fit:cover;object-position:{px:.2f}% {py:.2f}%"


def _tokens(order):
    g = (order.get("gender") or "boy").lower()
    pr = PRONOUNS.get(g, PRONOUNS["boy"])
    name = order.get("name") or ""
    ded = (order.get("dedication") or "").strip() or f"For {name}, a gift to grow into."
    t = {
        "CHILD_NAME": name,
        "CHILD_NAME_ARABIC": order.get("name_arabic") or "",
        "DEDICATION": ded,
        "LOGO": _logo_data_uri(),
        **pr,
    }
    photos = order.get("photos") or {}
    crops = order.get("crops") or {}
    t["PHOTO_COVER"] = photos.get("cover") or photos.get("PHOTO_COVER") or ""
    # cover prints onto a square face that equals the cropped square, so the
    # precise crop maps 1:1 (WYSIWYG) and bleeds into the wrap behind it
    t["PHOTO_COVER_STYLE"] = _crop_style(crops.get("cover"))
    for i in range(1, 13):
        t[f"PHOTO_{i}"] = photos.get(str(i)) or photos.get(f"PHOTO_{i}") or ""
        t[f"PHOTO_{i}_STYLE"] = _crop_style(crops.get(str(i)))
    return t


def _fill(html, tokens):
    return re.sub(r"{{\s*([A-Za-z0-9_]+)\s*}}",
                  lambda m: str(tokens.get(m.group(1), "")), html)


def _colorway(html, colorway):
    if (colorway or "teal").lower() == "rose":
        for a, b in ROSE.items():
            html = html.replace(a, b)
    return html


def _html_to_pdf(html, width_in=None, height_in=None, prefer_css=False) -> bytes:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")
        page.emulate_media(media="print")
        # Fit the child's name to one line AFTER switching to print media, so the
        # measurement uses the real print page size (not the on-screen size) and
        # any shrink is print-accurate. Wait for fonts first so it's exact.
        try:
            page.evaluate("document.fonts ? document.fonts.ready : true")
            page.evaluate("window.__fitNames && window.__fitNames()")
        except Exception:  # noqa: BLE001 — never let fitting break the render
            pass
        kw = dict(print_background=True, margin={"top": "0", "right": "0",
                                                 "bottom": "0", "left": "0"})
        if prefer_css:
            kw["prefer_css_page_size"] = True
        else:
            kw["width"] = f"{width_in}in"
            kw["height"] = f"{height_in}in"
        pdf = page.pdf(**kw)
        browser.close()
    return pdf


# ── interior ────────────────────────────────────────────────────────
def render_interior(order) -> bytes:
    html = (DIR / "book-template.html").read_text("utf-8")
    # strip the FRONT and BACK cover sheets (the cover is a separate PDF)
    fs = html.index("  <!-- ===== FRONT COVER")
    inter = html.index("  <!-- ===== INTERIOR")
    html = html[:fs] + html[inter:]
    bs = html.index("  <!-- ===== BACK COVER")
    html = html[:bs] + "</div>\n" + html[html.index("<script>", bs):]
    html = _colorway(_fill(html, _tokens(order)), order.get("colorway"))
    return _html_to_pdf(html, prefer_css=True)   # @page 8.75in is in the template


# ── cover ───────────────────────────────────────────────────────────
_PRINT_CSS = """
<style>@media print{
  body{margin:0!important;padding:0!important;display:block!important;background:#fff!important}
  .cap{display:none!important}.g,.gh,.fold{display:none!important}
  .case,.wrap{box-shadow:none!important;transform:none!important}.fitme{transform:none!important}
}</style>"""


def render_cover(order, spine_in, wrap_in=0.75) -> bytes:
    binding = (order.get("binding") or "hardcover").lower()
    f = "cover-hardcover.html" if binding == "hardcover" else "cover-paperback.html"
    html = (DIR / f).read_text("utf-8")

    # Lulu does not recommend spine text on a thin spine — a small bindery shift
    # can push it onto the fold/cover. Drop the spine text when the spine is
    # under ~0.22in (glyph height + Lulu's ~1/16in clearance each side). For the
    # current 32pp books this clears the paperback (0.139in spine) and keeps it
    # on the hardcover (0.25in spine); thicker future books keep it on both.
    if spine_in < 0.22:
        html = re.sub(r'<div class="txt">.*?</div>',
                      '<div class="txt"></div>', html, flags=re.S)

    # print scale: 1 inch = 96 CSS px so sizes map 1:1 in page.pdf
    html = html.replace("--in:80px", "--in:96px").replace("--in:70px", "--in:96px")
    # drop in Lulu's exact spine (+ wrap for casewrap)
    html = html.replace("--spine:calc(0.25 * var(--in))", f"--spine:calc({spine_in} * var(--in))")
    if binding == "hardcover":
        html = html.replace("--wrap:calc(0.75 * var(--in))", f"--wrap:calc({wrap_in} * var(--in))")
        width = 2 * wrap_in + 2 * 8.5 + spine_in
        height = 2 * wrap_in + 8.5
    else:
        width = 17.25 + spine_in          # (8.5+0.125)*2 + spine
        height = 8.75                     # 8.5 + 0.125 bleed top/bottom
    html = html.replace("</head>", _PRINT_CSS + "</head>")
    html = _colorway(_fill(html, _tokens(order)), order.get("colorway"))
    return _html_to_pdf(html, width, height)


if __name__ == "__main__":
    # quick smoke test (run on the worker where chromium is installed)
    import sys
    sample = {
        "name": "Yusuf", "name_arabic": "يُوسُف", "gender": "boy",
        "colorway": "teal", "binding": "hardcover",
        "dedication": "To Yusuf, with all our love, Mama and Baba.",
        "photos": {},   # empty -> designed fallback pages
    }
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp")
    (out / "iam-interior.pdf").write_bytes(render_interior(sample))
    (out / "iam-cover.pdf").write_bytes(render_cover(sample, spine_in=0.25))
    print("wrote", out / "iam-interior.pdf", "and", out / "iam-cover.pdf")
