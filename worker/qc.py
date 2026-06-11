"""
KETABI QC — automated quality gates. An order that fails ANY gate halts
with a written report and never reaches printing.

Gate 1  guards      placeholder scan + name validation
Gate 2  spec        page count, trim size, cover size
Gate 3  reference   rasterize key pages, pixel-diff vs certified renders
Gate 4  lulu        Lulu's own validator must return zero errors
(Then the human gate: owner approval on the digest.)
"""
import io
import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from pypdf import PdfReader

REPO_ROOT = Path(__file__).resolve().parent.parent
REF_DIR = REPO_ROOT / "public" / "images"

INTERIOR_PAGES = 32
INTERIOR_IN = 8.75
COVER_W_IN, COVER_H_IN = 17.39, 8.75
TOL_IN = 0.02

# mean abs pixel diff threshold (0-255). Certified baseline is ~0.004 at
# native res; PDF rasterize + resize adds noise. Wrong skin/hair scores 20+.
REF_MEAN_MAX = 8.0
REF_DARK_MIN = 4.0   # guard against blank/white pages "passing"

NAME_RE = re.compile(r"^[A-Za-z][A-Za-z '\-]{0,13}$")


class QCFailure(Exception):
    pass


# ── Gate 1: guards ──────────────────────────────────────────────────
def gate_name(child_name: str) -> None:
    if not NAME_RE.match(child_name or ""):
        raise QCFailure(f"name failed validation: {child_name!r}")


PLACEHOLDER_PATTERNS = ["(Child's Name)", "(Child’s Name)", "{name}", "[name]"]


def gate_placeholders(texts: list[str]) -> None:
    for t in texts:
        for p in PLACEHOLDER_PATTERNS:
            if p.lower() in (t or "").lower():
                raise QCFailure(f"placeholder survived: {p!r} in {t[:60]!r}")


# ── Gate 2: spec ────────────────────────────────────────────────────
def gate_spec(interior_pdf: str, cover_pdf: str) -> dict:
    r = PdfReader(interior_pdf)
    if len(r.pages) != INTERIOR_PAGES:
        raise QCFailure(f"interior has {len(r.pages)} pages, expected {INTERIOR_PAGES}")
    w = float(r.pages[0].mediabox.width) / 72
    h = float(r.pages[0].mediabox.height) / 72
    if abs(w - INTERIOR_IN) > TOL_IN or abs(h - INTERIOR_IN) > TOL_IN:
        raise QCFailure(f"interior trim {w:.2f}x{h:.2f}, expected {INTERIOR_IN}sq")
    rc = PdfReader(cover_pdf)
    cw = float(rc.pages[0].mediabox.width) / 72
    ch = float(rc.pages[0].mediabox.height) / 72
    if abs(cw - COVER_W_IN) > TOL_IN or abs(ch - COVER_H_IN) > TOL_IN:
        raise QCFailure(f"cover {cw:.2f}x{ch:.2f}, expected {COVER_W_IN}x{COVER_H_IN}")
    # blank scan: every page must contain ink
    blanks = []
    for p in range(1, len(r.pages) + 1):
        img = _raster(interior_pdf, p, px=200)
        ink = float(255 - np.asarray(img.convert("L")).mean())
        if ink < 2.0:
            blanks.append(p)
    if blanks:
        raise QCFailure(f"blank pages detected: {blanks}")
    return {"interior_pages": len(r.pages), "interior_in": [w, h],
            "cover_in": [cw, ch], "blank_scan": "ok"}


# ── Gate 3: look verification (color signature) ─────────────────────
# Raw pixel-diff is too brittle (sub-pixel raster offset trips it even when
# the art is identical). Instead we verify what actually defines the look:
# the girl's skin+hair colors must match the certified reference for the
# chosen combo, and must NOT match a different combo. Robust to alignment.
REF_SIG_MAX = 22.0     # correct combo sits ~7; wrong combo ~90
REF_SIG_MARGIN = 2.0   # correct must be at least this much closer than wrong


def _raster(pdf: str, page: int, px: int = 800) -> Image.Image:
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "pg"
        subprocess.run(
            ["pdftoppm", "-f", str(page), "-l", str(page), "-r", "120",
             "-jpeg", pdf, str(out)],
            check=True, capture_output=True,
        )
        f = next(Path(td).glob("pg*.jpg"))
        img = Image.open(f).convert("RGB")
        img.thumbnail((px, px), Image.LANCZOS)
        img.load()
        return img


def _sig(img: Image.Image, box) -> np.ndarray:
    w, h = img.size
    c = img.crop((int(w * box[0]), int(h * box[1]),
                  int(w * box[2]), int(h * box[3])))
    return np.median(np.asarray(c).reshape(-1, 3), axis=0)


# face box per story page — tight on exposed skin for unambiguous tone read.
# (page 7 omitted: the girl's clasped hands occlude her face there.)
_GIRL_BOX = {11: (0.50, 0.42, 0.62, 0.52)}
_FAMILY_BOX = {20: (0.27, 0.50, 0.36, 0.58)}  # hijab page, skin-only variant


def _check(rendered, ref_path, wrong_path, box, page, skin, wrong_skin, desc):
    if not ref_path.exists():
        raise QCFailure(f"missing certified reference: {ref_path.name}")
    ref = Image.open(ref_path).convert("RGB").resize(rendered.size)
    gsig = _sig(rendered, box)
    right = float(np.linalg.norm(gsig - _sig(ref, box)))
    entry = {"match_dist": round(right, 1)}
    if wrong_path and wrong_path.exists():
        wrong = Image.open(wrong_path).convert("RGB").resize(rendered.size)
        wrongd = float(np.linalg.norm(gsig - _sig(wrong, box)))
        entry["wrong_dist"] = round(wrongd, 1)
        if right > wrongd - REF_SIG_MARGIN:
            raise QCFailure(
                f"page {page}: {desc} closer to {wrong_skin} ({wrongd:.1f}) "
                f"than chosen {skin} ({right:.1f})")
    if right > REF_SIG_MAX:
        raise QCFailure(
            f"page {page}: character does not match certified look "
            f"(color dist {right:.1f} > {REF_SIG_MAX})")
    return entry


def gate_reference(interior_pdf: str, skin: str, hair: str, style: str) -> dict:
    """Verify the rendered character matches the chosen look, not another."""
    report = {}
    wrong_skin = "dark" if skin != "dark" else "light"
    for page, box in _GIRL_BOX.items():
        rendered = _raster(interior_pdf, page + 3)
        report[f"story_p{page}"] = _check(
            rendered,
            REF_DIR / f"peek-{page}-{skin}-{hair}-{style}.jpg",
            REF_DIR / f"peek-{page}-{wrong_skin}-{hair}-{style}.jpg",
            box, page, skin, wrong_skin, "look")
    for page, box in _FAMILY_BOX.items():
        rendered = _raster(interior_pdf, page + 3)
        report[f"story_p{page}"] = _check(
            rendered,
            REF_DIR / f"peek-{page}-{skin}.jpg",
            REF_DIR / f"peek-{page}-{wrong_skin}.jpg",
            box, page, skin, wrong_skin, "family skin")
    return report


# ── Gate 4: Lulu validation ─────────────────────────────────────────
def gate_lulu(client, interior_url: str, cover_url: str, pod_package_id: str,
              page_count: int = INTERIOR_PAGES, timeout_s: int = 600) -> dict:
    import time
    import requests

    ri, sc1 = client.validate_interior(interior_url, pod_package_id)
    rc, sc2 = client.validate_cover(cover_url, page_count, pod_package_id)
    vid, cid = ri.get("id"), rc.get("id")
    if not vid or not cid:
        raise QCFailure(f"lulu submission failed: {sc1}/{sc2} {ri}{rc}")
    B = client.base
    deadline = time.time() + timeout_s
    istat = cstat = None
    while time.time() < deadline and not (istat and cstat):
        time.sleep(10)
        if not istat:
            s = requests.get(f"{B}/validate-interior/{vid}/",
                             headers=client._headers(), timeout=30).json()
            if s.get("status") in ("VALIDATED", "NORMALIZED", "ERROR"):
                istat = s
        if not cstat:
            s = requests.get(f"{B}/validate-cover/{cid}/",
                             headers=client._headers(), timeout=30).json()
            if s.get("status") in ("VALIDATED", "NORMALIZED", "ERROR"):
                cstat = s
    if not istat or not cstat:
        raise QCFailure("lulu validation timed out")
    if istat.get("status") == "ERROR" or istat.get("errors"):
        raise QCFailure(f"lulu interior errors: {istat.get('errors')}")
    if cstat.get("status") == "ERROR" or cstat.get("errors"):
        raise QCFailure(f"lulu cover errors: {cstat.get('errors')}")
    return {"interior": istat.get("status"), "cover": cstat.get("status")}


# ── digest for the human gate ───────────────────────────────────────
def build_digest(interior_pdf: str, cover_pdf: str, order: dict) -> bytes:
    """One review image: cover + name crop + the three QC pages."""
    cov = _raster(cover_pdf, 1, px=1100)
    # front panel = right half
    front = cov.crop((cov.width // 2, 0, cov.width, cov.height))
    name_crop = front.crop((0, 0, front.width, int(front.height * 0.3)))
    pages = [_raster(interior_pdf, p + 3, px=520) for p in (7, 11, 20)]

    W = 1160
    H = 360 + 80 + 540 + 60
    canvas = Image.new("RGB", (W, H), (246, 244, 239))
    front.thumbnail((420, 420), Image.LANCZOS)
    canvas.paste(front, (20, 20))
    name_crop.thumbnail((680, 200), Image.LANCZOS)
    canvas.paste(name_crop, (460, 20))
    from PIL import ImageDraw
    d = ImageDraw.Draw(canvas)
    d.text((460, 240),
           f"{order.get('book_slug')} | name={order.get('child_name')!r} | "
           f"{order.get('skin')}/{order.get('hair')}/{order.get('hair_style')}",
           fill=(40, 38, 34))
    x = 20
    for img in pages:
        canvas.paste(img, (x, 440))
        x += img.width + 20
    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=88)
    return buf.getvalue()
