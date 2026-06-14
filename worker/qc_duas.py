#!/usr/bin/env python3
"""
QC for the 9 "My Beautiful Duas" combos (character x look). Renders each book,
verifies 32 pages, 8.5in square interior, cover wrap present, and no blank
pages; checks the cover title fits a long name; builds contact sheets + a
PASS/FAIL report into duas_qc/ for review.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
"""
import json
import sys
import traceback
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "pipeline"))
import duas_pipeline as P  # noqa: E402

CHARS = ["boy", "girl", "hijab"]
LOOKS = ["afro", "indian", "white"]
SHORT, LONG = "Maya", "Abdurrahmaan"
LABELF = ImageFont.truetype(str(ROOT / "fonts" / "DejaVuSans.ttf"), 30)
OUT = Path("duas_qc"); OUT.mkdir(exist_ok=True)
WORK = Path("/tmp/qcduas"); WORK.mkdir(parents=True, exist_ok=True)


def is_blank(jpg):
    return ImageStat.Stat(Image.open(jpg).convert("L")).stddev[0] < 3.0


def thumb(path, w=320):
    im = Image.open(path).convert("RGB"); im.thumbnail((w, w)); return im


def grid(title, cells, cols=3, cw=320):
    ch = max(c[0].size[1] for c in cells) + 34
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cw + 16) + 16, 70 + rows * (ch + 16)), (245, 243, 238))
    d = ImageDraw.Draw(sheet); d.text((16, 22), title, fill=(40, 38, 34), font=LABELF)
    for i, (im, lab) in enumerate(cells):
        r, c = divmod(i, cols); x = 16 + c * (cw + 16); y = 70 + r * (ch + 16)
        sheet.paste(im, (x + (cw - im.size[0]) // 2, y))
        d.text((x, y + ch - 28), lab, fill=(70, 66, 60), font=LABELF)
    return sheet


def main():
    report = {"items": [], "summary": {}}
    npass = nfail = 0
    covers, pages = [], []

    def rec(item, ok, detail=""):
        nonlocal npass, nfail
        report["items"].append({"item": item, "status": "PASS" if ok else "FAIL", "detail": str(detail)[:300]})
        if ok:
            npass += 1
        else:
            nfail += 1
            print(f"FAIL {item}: {detail}", flush=True)

    for ch in CHARS:
        for lk in LOOKS:
            combo = f"{ch}-{lk}"
            wd = WORK / combo
            try:
                interior, cover, n = P.build(SHORT, ch, lk, "brown", wd)
                r = PdfReader(interior)
                if len(r.pages) != 32:
                    raise AssertionError(f"{len(r.pages)} pages, expected 32")
                mb = r.pages[0].mediabox
                win = round(float(mb.width) / 72, 2); hin = round(float(mb.height) / 72, 2)
                if not (8.6 <= win <= 8.9 and 8.6 <= hin <= 8.9):
                    raise AssertionError(f"page {win}x{hin}in, expected 8.75sq (8.5 trim + bleed)")
                if not Path(cover).exists():
                    raise AssertionError("cover missing")
                blanks = [i + 1 for i in range(32) if is_blank(wd / f"page{i+1:02d}.jpg")]
                if blanks:
                    raise AssertionError(f"blank pages: {blanks}")
                rec(f"spec:{combo}", True, f"32pp {win}x{hin}")
                covers.append((thumb(wd / "cover_front.jpg"), combo))
                pages.append((thumb(wd / "page13.jpg"), f"{combo} story"))
            except Exception as e:  # noqa: BLE001
                rec(f"spec:{combo}", False, e)
                traceback.print_exc()
                bad = Image.new("RGB", (320, 320), (200, 90, 90))
                ImageDraw.Draw(bad).text((10, 150), "FAIL", font=LABELF)
                covers.append((bad, combo))
            finally:
                P._art.clear()  # free source art between combos (avoid OOM)

    # cover title fit for a long name (per character)
    for ch in CHARS:
        try:
            wd = WORK / f"long-{ch}"
            _, _, _ = P.build(LONG, ch, "indian", "brown", wd)
            covers.append((thumb(wd / "cover_front.jpg"), f"{ch} (long name)"))
            rec(f"longname:{ch}", True)
        except Exception as e:  # noqa: BLE001
            rec(f"longname:{ch}", False, e)
        finally:
            P._art.clear()

    grid("Duas covers — 9 combos + long-name", covers).save(OUT / "covers.jpg", quality=85)
    grid("Duas interior sample (story page)", pages).save(OUT / "interiors.jpg", quality=85)
    report["summary"] = {"pass": npass, "fail": nfail, "result": "PASS" if nfail == 0 else "FAIL"}
    (OUT / "report.json").write_text(json.dumps(report, indent=2))
    print(f"\nDUAS QC {report['summary']['result']}: {npass} pass, {nfail} fail", flush=True)
    if nfail:
        sys.exit(1)


if __name__ == "__main__":
    main()
