#!/usr/bin/env python3
"""
Import a zip of PSDs from a URL (Dropbox/Drive direct link) — runs in CI,
which has open internet (unlike the sandbox). For every PSD it:
  - renders a flattened JPG preview (downscaled),
  - writes a layer-tree report (groups, visibility, bboxes, text/raster-text,
    and detected skin/hair variant layers),
  - optionally backs up the raw PSD into Supabase book-assets/duas-psd/.
Previews + report are committed so they can be reviewed.

Env: ZIP_URL (required), SUPABASE_URL, SUPABASE_SERVICE_KEY (optional).
"""
import glob
import os
import zipfile
from pathlib import Path

import requests
from psd_tools import PSDImage

ZIP_URL = os.environ["ZIP_URL"]
OUT = Path("psd_import")
PREV = OUT / "previews"
PREV.mkdir(parents=True, exist_ok=True)

SB = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

VARIANT_HINTS = ("white", "indian", "india", "afro", "asian", "skin", "hair",
                 "light", "medium", "dark", "boy", "girl")


def normalize(url: str) -> str:
    if "dropbox.com" in url:
        url = url.replace("dl=0", "dl=1")
        if "dl=1" not in url:
            url += ("&" if "?" in url else "?") + "dl=1"
    return url


def walk(layer, depth, lines):
    pad = "  " * depth
    kind = layer.kind
    nm = layer.name or ""
    extra = ""
    if kind == "type":
        try:
            extra = f'  TEXT="{layer.text[:90]}"'
        except Exception:  # noqa: BLE001
            extra = "  TEXT(live)"
    elif "[" in nm and "]" in nm:
        extra = "  (rasterized text)"
    if any(h in nm.lower() for h in VARIANT_HINTS):
        extra += "  <-- variant?"
    vis = "vis" if layer.visible else "hid"
    lines.append(f"{pad}- [{kind}/{vis}] {nm!r}  {layer.bbox}{extra}")
    if layer.is_group():
        for c in layer:
            walk(c, depth + 1, lines)


def upload_raw(path: Path, folder: str, ctype: str):
    if not (SB and KEY):
        return "no-supabase"
    with open(path, "rb") as fh:
        r = requests.post(
            f"{SB}/storage/v1/object/book-assets/{folder}/{path.name}",
            headers={"Authorization": f"Bearer {KEY}",
                     "Content-Type": ctype, "x-upsert": "true"},
            data=fh.read(), timeout=600)
    return f"uploaded({r.status_code})"


def extract_all(zpath: Path, dest: Path):
    """Extract a zip, then recursively extract any nested zips it contains."""
    with zipfile.ZipFile(zpath) as z:
        z.extractall(dest)
    seen = {str(zpath)}
    while True:
        nested = [p for p in glob.glob(str(dest / "**" / "*.zip"), recursive=True)
                  if p not in seen and not Path(p).name.startswith("._")]
        if not nested:
            break
        for n in nested:
            seen.add(n)
            try:
                with zipfile.ZipFile(n) as z:
                    z.extractall(Path(n).with_suffix(""))
                print(f"  unpacked nested zip: {Path(n).name}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"  could not unpack {n}: {e}", flush=True)


def find(dest: Path, *exts):
    out = []
    for ext in exts:
        out += [p for p in glob.glob(str(dest / "**" / f"*{ext}"), recursive=True)
                if not Path(p).name.startswith("._")]
    return sorted(set(out))


def main():
    url = normalize(ZIP_URL)
    print("downloading:", url, flush=True)
    r = requests.get(url, timeout=1800)
    r.raise_for_status()
    zpath = Path("/tmp/in.zip")
    zpath.write_bytes(r.content)
    print(f"download: {len(r.content)/1e6:.1f} MB", flush=True)

    zd = Path("/tmp/psd_in")
    extract_all(zpath, zd)

    psds = find(zd, ".psd")
    images = [p for p in find(zd, ".png", ".jpg", ".jpeg")
              if "__MACOSX" not in p]
    print(f"found {len(psds)} PSD + {len(images)} image files", flush=True)

    report = [f"# Import report\n\n{len(psds)} PSDs, {len(images)} images found.\n"]

    report.append("## PSDs\n")
    for p in psds:
        path = Path(p)
        lines = [f"### {path.name}"]
        try:
            psd = PSDImage.open(p)
            lines.append(f"- size: {psd.size}  mode: {psd.color_mode}")
            tree = []
            for layer in psd:
                walk(layer, 0, tree)
            lines.append("```")
            lines.extend(tree)
            lines.append("```")
            img = psd.composite().convert("RGB")
            img.thumbnail((1500, 1500))
            img.save(PREV / (path.stem + ".jpg"), "JPEG", quality=82)
            lines.append(f"- backup: {upload_raw(path, 'duas-psd', 'image/vnd.adobe.photoshop')}")
            print(f"  ok PSD {path.name} {psd.size}", flush=True)
        except Exception as e:  # noqa: BLE001
            lines.append(f"- ERROR: {e}")
            print(f"  ERROR {path.name}: {e}", flush=True)
        report.append("\n".join(lines))

    report.append("\n## Image assets\n")
    for p in images:
        path = Path(p)
        try:
            from PIL import Image
            im = Image.open(p)
            size = im.size
            prev = im.convert("RGB")
            prev.thumbnail((1100, 1100))
            prev.save(PREV / ("asset_" + path.stem + ".jpg"), "JPEG", quality=80)
            ct = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
            up = upload_raw(path, "duas-assets", ct)
            report.append(f"- {path.name}  {size}  {up}")
            print(f"  ok IMG {path.name} {size}", flush=True)
        except Exception as e:  # noqa: BLE001
            report.append(f"- {path.name}  ERROR: {e}")

    (OUT / "report.md").write_text("\n\n".join(report))
    print("wrote psd_import/report.md and previews/", flush=True)


if __name__ == "__main__":
    main()
