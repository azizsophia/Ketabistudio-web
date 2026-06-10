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


# ── Gate 3: certified-reference diff ────────────────────────────────
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


def _diff(a: Image.Image, b: Image.Image) -> float:
    b = b.convert("RGB").resize(a.size, Image.LANCZOS)
    return float(np.abs(np.asarray(a, dtype=int) - np.asarray(b, dtype=int)).mean())


def gate_reference(interior_pdf: str, skin: str, hair: str, style: str) -> dict:
    """Story page N lives at PDF page N+3 (title/copyright/dedication first)."""
    checks = {
        7: REF_DIR / f"peek-7-{skin}-{hair}-{style}.jpg",
        11: REF_DIR / f"peek-11-{skin}-{hair}-{style}.jpg",
        20: REF_DIR / f"peek-20-{skin}.jpg",
    }
    report = {}
    for story_page, ref_path in checks.items():
        if not ref_path.exists():
            raise QCFailure(f"missing certified reference: {ref_path.name}")
        rendered = _raster(interior_pdf, story_page + 3)
        ref = Image.open(ref_path)
        # compare art region only (skip the bleed border): center crop 92%
        w, h = rendered.size
        m = int(w * 0.04)
        rendered_c = rendered.crop((m, m, w - m, h - m))
        ref_c = ref.crop(
            (int(ref.width * 0.0), 0, ref.width, ref.height)
        )
        mean = _diff(rendered_c, ref_c)
        darkness = float(255 - np.asarray(rendered_c.convert("L")).mean())
        report[f"story_p{story_page}"] = {"mean_diff": round(mean, 2), "ink": round(darkness, 1)}
        if mean > REF_MEAN_MAX:
            raise QCFailure(
                f"page {story_page} differs from certified {skin}/{hair}/{style} "
                f"reference (mean {mean:.1f} > {REF_MEAN_MAX})"
            )
        if darkness < REF_DARK_MIN:
            raise QCFailure(f"page {story_page} looks blank (ink {darkness:.1f})")
    return report


# ── Gate 4: Lulu validation ─────────────────────────────────────────
def gate_lulu(client, interior_url: str, cover_url: str, pod_package_id: str,
              page_count: int = INTERIOR_PAGES, timeout_s: int = 600) -> dict:
    import time
    import requests

    B = client.base_url
    ri = requests.post(f"{B}/validate-interior/", headers=client._headers(),
                       json={"source_url": interior_url,
                             "pod_package_id": pod_package_id}, timeout=60).json()
    rc = requests.post(f"{B}/validate-cover/", headers=client._headers(),
                       json={"source_url": cover_url,
                             "pod_package_id": pod_package_id,
                             "interior_page_count": page_count}, timeout=60).json()
    vid, cid = ri.get("id"), rc.get("id")
    deadline = time.time() + timeout_s
    istat = cstat = None
    while time.time() < deadline and not (istat and cstat):
        time.sleep(8)
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
    return {"interior": istat.get("status"), "cover": cstat.get("status"),
            "interior_id": vid, "cover_id": cid}


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
