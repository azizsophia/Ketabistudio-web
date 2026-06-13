#!/usr/bin/env python3
"""
KETABI QC BATCH — proactively verify every book/look renders correctly,
without ordering anything. Runs in CI (it needs Supabase access).

For "Her Beautiful Hijab" (personalized):
  - renders all 48 looks (skin x hair x style); the cover renderer itself
    guards against missing/broken character art, so a bad base fails here.
  - renders a full interior per skin and runs the spec + look-color gates.
  - checks the cover title fits for a short AND a long name.
For the fixed books (Juha, Maryam): runs the spec gate on the stored PDFs.

Outputs to Supabase book-assets/qc/:
  - report.json        machine + human readable PASS/FAIL for every item
  - sheet_*.jpg        phone-swipeable contact sheets (cover grids, samples)

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
import io
import json
import os
import sys
import time
import traceback
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "pipeline"))

import qc  # noqa: E402
import generate_from_bases as g  # noqa: E402

SB = "".join(os.environ["SUPABASE_URL"].split()).rstrip("/")
KEY = "".join(os.environ["SUPABASE_SERVICE_KEY"].split())

SKINS = ["light", "medium", "dark"]
HAIRS = ["black", "brown", "blonde", "red"]
STYLES = ["long-straight", "long-curly", "short-straight", "short-curly"]

SHORT_NAME = "Maya"
LONG_NAME = "Abdurrahmaan"   # 12 chars; near the 14-char limit

FIXED_BOOKS = {
    "juha-and-the-enormous-pumpkin": ("juha/Juha_interior.pdf", "juha/Juha_cover.pdf"),
    "maryam-is-kind-to-her-parents": ("maryam/Maryam_interior.pdf", "maryam/Maryam_cover.pdf"),
}

LABEL_FONT = ImageFont.truetype(str(ROOT / "fonts" / "bjola.otf"), 30)


# ── storage helpers ─────────────────────────────────────────────────
def storage_download(bucket, path) -> bytes:
    r = requests.get(f"{SB}/storage/v1/object/{bucket}/{path}",
                     headers={"Authorization": f"Bearer {KEY}"}, timeout=300)
    r.raise_for_status()
    return r.content


def storage_upload(bucket, path, data: bytes, ctype):
    r = requests.post(f"{SB}/storage/v1/object/{bucket}/{path}",
                      headers={"Authorization": f"Bearer {KEY}",
                               "Content-Type": ctype, "x-upsert": "true"},
                      data=data, timeout=300)
    r.raise_for_status()


# ── thumbnail + contact-sheet helpers ───────────────────────────────
def front_panel_thumb(cover_img: Image.Image, w=300) -> Image.Image:
    """Crop the front (right) panel of the wrap and thumbnail it."""
    cw, ch = cover_img.size
    front = cover_img.crop((cw // 2, 0, cw, ch))
    front.thumbnail((w, w * 2), Image.LANCZOS)
    return front


def grid_sheet(title, cells, cols=4, cell_w=300, pad=16):
    """cells: list of (PIL image, label). Returns a contact-sheet image."""
    if not cells:
        return None
    cw = cell_w
    ch = max(c[0].size[1] for c in cells)
    rows = (len(cells) + cols - 1) // cols
    head = 70
    W = pad + cols * (cw + pad)
    H = head + pad + rows * (ch + 34 + pad)
    sheet = Image.new("RGB", (W, H), (245, 243, 238))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 20), title, fill=(40, 38, 34), font=LABEL_FONT)
    for i, (img, label) in enumerate(cells):
        r, c = divmod(i, cols)
        x = pad + c * (cw + pad)
        y = head + pad + r * (ch + 34 + pad)
        sheet.paste(img, (x + (cw - img.size[0]) // 2, y))
        d.text((x, y + ch + 4), label, fill=(70, 66, 60), font=LABEL_FONT)
    return sheet


# ── the batch ───────────────────────────────────────────────────────
def run():
    work = Path("/tmp/qcbatch")
    work.mkdir(parents=True, exist_ok=True)
    report = {"generated_at": int(time.time()), "items": [], "summary": {}}
    cover_cells = {s: [] for s in SKINS}     # per-skin cover grids
    interior_cells = []                      # per-skin interior samples
    longname_cells = []                      # long-name cover samples
    fixed_cells = []
    npass = nfail = 0

    def record(name, ok, detail=""):
        nonlocal npass, nfail
        report["items"].append({"item": name, "status": "PASS" if ok else "FAIL",
                                "detail": str(detail)[:400]})
        if ok:
            npass += 1
        else:
            nfail += 1
            print(f"FAIL {name}: {detail}", flush=True)

    # name-fit gates (depend only on the name, not the look)
    for nm in (SHORT_NAME, LONG_NAME):
        try:
            info = qc.gate_cover_name_fit(nm)
            record(f"cover-name-fit:{nm}", True, info)
        except Exception as e:  # noqa: BLE001
            record(f"cover-name-fit:{nm}", False, e)

    # every Hijab look: render the cover (guards character art) + thumb
    for skin in SKINS:
        for hair in HAIRS:
            for style in STYLES:
                combo = f"{skin}-{hair}-{style}"
                try:
                    cover = g.generate_cover_from_base(SHORT_NAME, skin, hair, style)
                    cover_cells[skin].append((front_panel_thumb(cover), combo))
                    record(f"cover:{combo}", True)
                    del cover
                except Exception as e:  # noqa: BLE001
                    record(f"cover:{combo}", False, e)
                    bad = Image.new("RGB", (300, 300), (200, 90, 90))
                    ImageDraw.Draw(bad).text((10, 140), "RENDER FAIL", font=LABEL_FONT)
                    cover_cells[skin].append((bad, combo))

    # one full interior per skin: spec + look-color gates + sample page
    for skin in SKINS:
        combo = f"{skin}-black-short-curly"
        try:
            wd = work / f"int-{skin}"
            interior_pdf, cover_pdf = g.build_from_bases(SHORT_NAME, skin, "black", "short-curly", wd)
            spec = qc.gate_spec(interior_pdf, cover_pdf)
            ref = qc.gate_reference(interior_pdf, skin, "black", "short-curly")
            record(f"interior-spec:{skin}", True, spec)
            record(f"interior-look:{skin}", True, ref)
            pg = qc._raster(interior_pdf, 11, px=300)  # story page (girl)
            interior_cells.append((pg, f"{skin} p11"))
        except Exception as e:  # noqa: BLE001
            record(f"interior:{skin}", False, e)
            traceback.print_exc()

    # long-name cover samples (one per skin) — eyeball title fit
    for skin in SKINS:
        try:
            cover = g.generate_cover_from_base(LONG_NAME, skin, "black", "long-curly")
            longname_cells.append((front_panel_thumb(cover), f"{skin} (long)"))
            del cover
        except Exception as e:  # noqa: BLE001
            record(f"longname-cover:{skin}", False, e)

    # fixed books
    for slug, (ipath, cpath) in FIXED_BOOKS.items():
        try:
            wd = work / slug
            wd.mkdir(parents=True, exist_ok=True)
            ip, cp = wd / "interior.pdf", wd / "cover.pdf"
            ip.write_bytes(storage_download("book-assets", ipath))
            cp.write_bytes(storage_download("book-assets", cpath))
            spec = qc.gate_spec(str(ip), str(cp))
            record(f"fixed:{slug}", True, spec)
            fixed_cells.append((front_panel_thumb(qc._raster(str(cp), 1, px=600)),
                                slug.split("-")[0]))
        except Exception as e:  # noqa: BLE001
            record(f"fixed:{slug}", False, e)
            traceback.print_exc()

    # build + upload contact sheets
    sheets = {}
    for skin in SKINS:
        sheets[f"sheet_covers_{skin}.jpg"] = grid_sheet(
            f"Her Beautiful Hijab — {skin} covers (name: {SHORT_NAME})", cover_cells[skin])
    sheets["sheet_interior_samples.jpg"] = grid_sheet(
        "Interior sample (story page 11) per skin", interior_cells, cols=3)
    sheets["sheet_longname.jpg"] = grid_sheet(
        f"Long-name cover fit ({LONG_NAME})", longname_cells, cols=3)
    sheets["sheet_fixed_books.jpg"] = grid_sheet(
        "Fixed books (covers)", fixed_cells, cols=2)

    sheet_names = []
    for fn, sheet in sheets.items():
        if sheet is None:
            continue
        buf = io.BytesIO()
        sheet.convert("RGB").save(buf, "JPEG", quality=85)
        storage_upload("book-assets", f"qc/{fn}", buf.getvalue(), "image/jpeg")
        sheet_names.append(fn)

    report["sheets"] = sheet_names
    report["summary"] = {"pass": npass, "fail": nfail,
                         "result": "PASS" if nfail == 0 else "FAIL"}
    storage_upload("book-assets", "qc/report.json",
                   json.dumps(report, indent=2).encode(), "application/json")

    print(f"\nQC BATCH {report['summary']['result']}: {npass} pass, {nfail} fail", flush=True)
    print("sheets:", sheet_names, flush=True)
    if nfail:
        sys.exit(1)


if __name__ == "__main__":
    run()
