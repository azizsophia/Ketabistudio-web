"""Per-order gift dedication for the fixed Juha book.

The master interior (book-assets/juha/Juha_interior.pdf) ships as flattened
300-dpi page images. Its dedication page (page 3) was exported with a sample
name baked in, so every copy must have that band rewritten before printing:
the name row is erased (the background is a pure vertical gradient, so each
row refills from its own left-margin colour) and the order's gift name is
drawn in Baloo 2 ExtraBold — a pixel-match for the original lettering. No
name on the order means the generic "you".

Geometry and colour were measured off the master file (2026-07-12). A sanity
check asserts the sample name's gold pixels are where we expect before any
pixels are touched, so a re-exported master that moves the layout fails the
order loudly instead of printing a misplaced name.
"""
import io
from pathlib import Path

import fitz  # PyMuPDF
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = Path(__file__).resolve().parent.parent / "fonts" / "Baloo2.ttf"

PAGE_INDEX = 2          # "Made especially for ___" page
IMG_SIZE = 2625         # flattened page image is 2625x2625 (300 dpi, 8.75in)
CENTER_X = 1312
BASELINE_Y = 1444       # baseline of the original name
NAME_HEIGHT = 132       # cap-to-baseline height of the original name
ERASE_ROWS = (1250, 1500)
MAX_NAME_WIDTH = 900    # divider below is 831px wide; slight overflow ok
GOLD = (167, 117, 39)   # sampled from the original glyphs
SAMPLE_X = 200          # column used to read the background gradient


def _font(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT_PATH), size)
    f.set_variation_by_axes([800])  # ExtraBold
    return f


def _calibrated_size(draw: ImageDraw.ImageDraw) -> int:
    """Font size whose no-descender glyph height matches the original name."""
    size = 100
    for _ in range(30):
        b = _font(size).getbbox("Amira")
        h = b[3] - b[1]
        if abs(h - NAME_HEIGHT) <= 1:
            return size
        size = max(20, int(size * NAME_HEIGHT / h))
    return size


def _check_layout(arr: np.ndarray) -> None:
    """The erase band must hold gold name pixels and nothing at the margins."""
    band = arr[ERASE_ROWS[0]:ERASE_ROWS[1]]
    gold = (
        (band[:, :, 0] > 140) & (band[:, :, 1] > 80)
        & (band[:, :, 1] < 180) & (band[:, :, 2] < 100)
    )
    if gold.sum() < 5000:
        raise RuntimeError(
            "fixed_dedication: no baked-in name found where expected — "
            "master PDF layout changed, refusing to stamp")
    if gold[:, :700].any() or gold[:, -700:].any():
        raise RuntimeError(
            "fixed_dedication: name band reaches the margins — "
            "master PDF layout changed, refusing to stamp")


def stamp_dedication(pdf_path: str, gift_name: str | None) -> dict:
    """Rewrite the dedication name on PAGE_INDEX of pdf_path, in place.

    gift_name None/blank prints the generic "you". Returns a small report
    for the order's ref_report.
    """
    name = (gift_name or "").strip() or "you"
    if name != "you" and name.islower():
        name = name[0].upper() + name[1:]

    doc = fitz.open(pdf_path)
    page = doc[PAGE_INDEX]
    images = page.get_images(full=True)
    if len(images) != 1:
        raise RuntimeError(
            f"fixed_dedication: expected 1 image on page {PAGE_INDEX + 1}, "
            f"got {len(images)}")
    xref = images[0][0]
    pix = fitz.Pixmap(doc, xref)
    if pix.n not in (3, 4) or pix.width != IMG_SIZE or pix.height != IMG_SIZE:
        raise RuntimeError(
            f"fixed_dedication: unexpected page image "
            f"{pix.width}x{pix.height} n={pix.n}")
    im = Image.frombytes("RGB" if pix.n == 3 else "RGBA",
                         (pix.width, pix.height), pix.samples).convert("RGB")

    arr = np.array(im)
    _check_layout(arr)
    for y in range(*ERASE_ROWS):
        arr[y, :, :] = arr[y, SAMPLE_X]
    im = Image.fromarray(arr)

    d = ImageDraw.Draw(im)
    size = _calibrated_size(d)
    f = _font(size)
    while d.textlength(name, font=f) > MAX_NAME_WIDTH and size > 40:
        size -= 4
        f = _font(size)
    d.text((CENTER_X, BASELINE_Y), name, font=f, fill=GOLD, anchor="ms")

    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=95)
    page.replace_image(xref, stream=buf.getvalue())
    doc.save(pdf_path + ".tmp", garbage=3, deflate=True)
    doc.close()
    Path(pdf_path + ".tmp").replace(pdf_path)
    return {"gift_name": name, "font_px": size}
