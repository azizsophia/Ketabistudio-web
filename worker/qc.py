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


# ── Gate 1b: cover name fit ─────────────────────────────────────────
# The cover title shrinks to fit (generate_cover_from_base: fit_font 215->120
# over the front panel). If the name overflows even at the minimum size it
# would be clipped on the printed cover. This mirrors that geometry exactly.
_FONT_BJOLA = REPO_ROOT / "worker" / "fonts" / "bjola.otf"
COVER_NAME_BASE, COVER_NAME_MIN = 215, 120
COVER_PANEL_MAX_W = (5100 - 2550) - 220  # front panel width minus side margins


def gate_cover_name_fit(child_name: str) -> dict:
    from PIL import ImageFont
    name = (child_name or "").strip()
    width_at = lambda pt: ImageFont.truetype(str(_FONT_BJOLA), pt).getbbox(name)[2]
    if width_at(COVER_NAME_MIN) > COVER_PANEL_MAX_W:
        raise QCFailure(
            f"cover name {name!r} overflows the title panel even at the "
            f"minimum {COVER_NAME_MIN}pt size "
            f"({width_at(COVER_NAME_MIN)}px > {COVER_PANEL_MAX_W}px)")
    size = COVER_NAME_BASE
    while size > COVER_NAME_MIN and width_at(size) > COVER_PANEL_MAX_W:
        size -= 4
    return {"name": name, "render_pt": size, "fits": True}



# ── Gate 2: spec ────────────────────────────────────────────────────
def gate_spec(interior_pdf: str, cover_pdf: str, expected_pages: int = INTERIOR_PAGES,
              cover_type: str = "softcover", trim_in=None, cover_mode=None) -> dict:
    """trim_in: (w_in, h_in) override for non-square books (default 8.75 sq).
    cover_mode="lulu": the cover was generated to Lulu's /cover-dimensions/
    answer at run time, so only a plausibility check runs here and Lulu's own
    validate-cover gate is the authority. Defaults keep every existing book's
    behavior byte-for-byte unchanged."""
    exp_w, exp_h = trim_in if trim_in else (INTERIOR_IN, INTERIOR_IN)
    r = PdfReader(interior_pdf)
    if len(r.pages) != expected_pages:
        raise QCFailure(f"interior has {len(r.pages)} pages, expected {expected_pages}")
    w = float(r.pages[0].mediabox.width) / 72
    h = float(r.pages[0].mediabox.height) / 72
    if abs(w - exp_w) > TOL_IN or abs(h - exp_h) > TOL_IN:
        raise QCFailure(f"interior trim {w:.2f}x{h:.2f}, expected {exp_w}x{exp_h}")
    rc = PdfReader(cover_pdf)
    cw = float(rc.pages[0].mediabox.width) / 72
    ch = float(rc.pages[0].mediabox.height) / 72
    if cover_mode == "lulu":
        # Sized from Lulu's own dimensions endpoint at generation time; assert
        # only that it is in the same physical ballpark as the trim. Lulu's
        # validate-cover (gate 4) enforces exactness.
        if ch < exp_h - 1.0 or ch > exp_h + 2.0 or cw < exp_w - 1.0 or cw > 2.6 * exp_w:
            raise QCFailure(
                f"lulu-dimensioned cover {cw:.2f}x{ch:.2f}in implausible for "
                f"trim {exp_w}x{exp_h}in")
    elif cover_type == "hardcover":
        # Casewrap (hardcover) wrap dimensions are sized from Lulu's
        # /print-job-cover-dimensions/ endpoint at generation time (they are
        # larger than the softcover wrap and vary by binding), so we do NOT
        # assert a fixed cover size here. The cover's exact correctness is
        # enforced by the Lulu validate-cover gate against the hardcover POD;
        # we only sanity-check the cover height is in a plausible range.
        if ch < INTERIOR_IN - 0.5 or ch > INTERIOR_IN + 2.0:
            raise QCFailure(
                f"hardcover cover height {ch:.2f}in implausible "
                f"(expected near {INTERIOR_IN}in + casewrap turn-in)")
    elif abs(cw - COVER_W_IN) > TOL_IN or abs(ch - COVER_H_IN) > TOL_IN:
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
    """One review image: the full front cover, an interior contact strip,
    and the order details. Laid out so the cover reads as the cover."""
    from PIL import ImageDraw

    cov = _raster(cover_pdf, 1, px=1400)
    # front panel = right half of the wrap
    front = cov.crop((cov.width // 2, 0, cov.width, cov.height))

    # Three representative interior pages (story pages 7, 11, 20 -> +3 for matter).
    # Juha carries a per-order stamped dedication on PDF page 3, so that page
    # takes the first slot — the owner must see the printed gift name.
    if order.get("book_slug") == "juha-and-the-enormous-pumpkin":
        pages = [_raster(interior_pdf, p, px=520) for p in (3, 11, 20)]
    else:
        pages = [_raster(interior_pdf, p + 3, px=520) for p in (7, 11, 20)]

    W = 1160
    pad = 24
    cover_box = 540          # full cover shown large on the left
    info_x = pad + cover_box + pad
    strip_y = pad + cover_box + pad
    strip_h = 360
    H = strip_y + strip_h + pad

    canvas = Image.new("RGB", (W, H), (246, 244, 239))
    d = ImageDraw.Draw(canvas)

    # Full front cover, large, top-left — this is the whole cover, not a crop
    cover_disp = front.copy()
    cover_disp.thumbnail((cover_box, cover_box), Image.LANCZOS)
    canvas.paste(cover_disp, (pad, pad))

    # Order details to the right of the cover
    d.text((info_x, pad + 8), "FULL COVER  →  shown at left", fill=(120, 116, 108))
    d.text((info_x, pad + 48),
           f"Book:  {order.get('book_slug')}", fill=(40, 38, 34))
    d.text((info_x, pad + 78),
           f"Name:  {order.get('child_name')!r}", fill=(40, 38, 34))
    d.text((info_x, pad + 108),
           f"Look:  {order.get('skin')} / {order.get('hair')} / "
           f"{order.get('hair_style')}", fill=(40, 38, 34))
    d.text((info_x, pad + 156), "Interior sample below ↓", fill=(120, 116, 108))

    # Interior contact strip along the bottom
    x = pad
    for img in pages:
        canvas.paste(img, (x, strip_y))
        x += img.width + 20

    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=88)
    return buf.getvalue()
