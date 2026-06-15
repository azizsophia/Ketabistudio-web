#!/usr/bin/env python3
"""
QC for the fixed (pre-made) books Juha + Maryam: download each interior PDF
from Supabase storage, rasterize every page to an image, and build a per-book
contact sheet for a human accuracy review (text vs. art). Pushes to the
'qc-fixed-results' branch.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
"""
import os
from pathlib import Path

import requests
from PIL import Image, ImageDraw
import fitz  # PyMuPDF

SB = "".join(os.environ["SUPABASE_URL"].split()).rstrip("/")
KEY = "".join(os.environ["SUPABASE_SERVICE_KEY"].split())
OUT = Path("qc_fixed")
(OUT / "pages").mkdir(parents=True, exist_ok=True)

BOOKS = {
    "juha": "juha/Juha_interior.pdf",
    "maryam": "maryam/Maryam_interior.pdf",
}


def dl(path: str) -> bytes:
    r = requests.get(
        f"{SB}/storage/v1/object/book-assets/{path}",
        headers={"Authorization": f"Bearer {KEY}"},
        timeout=180,
    )
    r.raise_for_status()
    return r.content


for name, path in BOOKS.items():
    pdf = fitz.open(stream=dl(path), filetype="pdf")
    thumbs = []
    for i, page in enumerate(pdf):
        pix = page.get_pixmap(dpi=120)
        im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        im.save(OUT / "pages" / f"{name}-p{i + 1:02d}.jpg", "JPEG", quality=82)
        t = im.copy()
        t.thumbnail((380, 380))
        thumbs.append((t, f"p{i + 1}"))
    cols = 4
    cw, chh = 392, 420
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw + 16, rows * chh + 56), (245, 243, 238))
    d = ImageDraw.Draw(sheet)
    d.text((16, 20), f"{name.upper()} interior — {len(thumbs)} pages", fill=(30, 28, 24))
    for j, (im, lab) in enumerate(thumbs):
        r, c = divmod(j, cols)
        x, y = 16 + c * cw, 56 + r * chh
        sheet.paste(im, (x + (380 - im.width) // 2, y))
        d.text((x, y + 388), lab, fill=(70, 66, 60))
    sheet.save(OUT / f"{name}_contact.jpg", quality=85)
    print(f"{name}: {len(thumbs)} pages", flush=True)

print("done", flush=True)
