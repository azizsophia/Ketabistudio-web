#!/usr/bin/env python3
"""
KETABI BASE RENDERER (CI)

Renders flat art bases (no text) for every page x look, uploads each to
Supabase book-assets/bases/, deletes locally. Resumable: skips bases that
already exist in the bucket, so re-running a range is always safe.

Page taxonomy (verified against the PSDs):
  cover + pages 1-11 : full character -> 48 variants each
  pages 12-25        : skin-only (hijab) -> 3 variants each
  page 17            : side character only -> 1 base

Naming (must stay stable; the worker depends on it):
  pageNN__{skin}-{hair}-{style}.jpg   e.g. page03__medium-brown-long-curly.jpg
  pageNN__{skin}.jpg                  e.g. page14__dark.jpg
  page17.jpg
  cover__{skin}-{hair}-{style}.jpg

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, MODESTY_DIR (folder with the PSDs)
Arg: a range like "1-3", or "12-25", or "cover"
"""
import gc
import os
import sys
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "pipeline"))

from psd_tools import PSDImage  # noqa: E402
from PIL import Image  # noqa: E402
import warnings  # noqa: E402

warnings.filterwarnings("ignore")
import modesty_pipeline as m  # noqa: E402

# join+split scrubs any whitespace/newlines picked up during mobile paste
SB = "".join(os.environ["SUPABASE_URL"].split()).rstrip("/")
KEY = "".join(os.environ["SUPABASE_SERVICE_KEY"].split())

SEARCH_ROOT = "/tmp/modesty"


def _discover_psds() -> dict:
    """Walk the extraction root, extract nested zips, map lowercase
    filename -> full path for every .psd found. Prints structure to log."""
    import subprocess, shutil
    def _extract(p, dest):
        """unzip -> 7z -> apt install p7zip cascade (handles Deflate64 etc)."""
        r = subprocess.run(["unzip", "-q", "-o", p, "-d", dest],
                           capture_output=True)
        if r.returncode == 0:
            return
        exe = shutil.which("7z") or shutil.which("7zz") or shutil.which("7za")
        if not exe:
            subprocess.run(["sudo", "apt-get", "install", "-y", "-qq",
                            "p7zip-full"], capture_output=True)
            exe = shutil.which("7z") or shutil.which("7za")
        subprocess.run([exe, "x", "-y", f"-o{dest}", p],
                       check=True, capture_output=True)
    # extract any nested zips first
    for root, _dirs, files in os.walk(SEARCH_ROOT):
        for f in files:
            if f.lower().endswith(".zip"):
                p = os.path.join(root, f)
                print(f"found nested zip, extracting: {p}", flush=True)
                try:
                    _extract(p, root)
                    os.remove(p)
                except Exception as e:
                    print(f"  (skipping zip: {e})", flush=True)
    psds = {}
    for root, dirs, files in os.walk(SEARCH_ROOT):
        if "__MACOSX" in root:
            continue
        for f in files:
            if f.lower().endswith(".psd"):
                psds[f.lower().strip()] = os.path.join(root, f)
    print(f"discovered {len(psds)} PSDs:", flush=True)
    for k in sorted(psds)[:30]:
        print("  ", psds[k], flush=True)
    return psds


_PSDS = _discover_psds()


def psd_path(name: str) -> str:
    """Case/space-insensitive lookup, with substring fallback."""
    key = name.lower().strip()
    if key in _PSDS:
        return _PSDS[key]
    stem = key.replace(".psd", "")
    for k, v in _PSDS.items():
        if stem in k:
            return v
    raise FileNotFoundError(f"no PSD matching {name!r}; have: {sorted(_PSDS)[:8]}")

SKINS = [("Blonde light", "light"), ("Blonde dark", "medium"), ("Dark", "dark")]
HAIRS = [("Black", "black"), ("Brown", "brown"),
         ("Blonde", "blonde"), ("Red", "red")]
STYLES = [("Long straight", "long-straight"), ("Long curly", "long-curly"),
          ("Short straight", "short-straight"), ("Short curly", "short-curly")]

FULL_PAGES = set(range(1, 12))
SKIN_PAGES = set(range(12, 26)) - {17}


def existing(prefix: str) -> set:
    have, offset = set(), 0
    while True:
        r = _retry(lambda: requests.post(
            f"{SB}/storage/v1/object/list/book-assets",
            headers={"Authorization": f"Bearer {KEY}",
                     "Content-Type": "application/json"},
            json={"prefix": "bases", "limit": 1000, "offset": offset},
            timeout=60))
        batch = r.json()
        have |= {i["name"] for i in batch}
        if len(batch) < 1000:
            break
        offset += 1000
    return {n for n in have if n.startswith(prefix)}


def _retry(fn, tries=4):
    import time
    last = None
    for i in range(tries):
        try:
            r = fn()
            if getattr(r, "status_code", 200) >= 500:
                raise RuntimeError(f"HTTP {r.status_code}")
            return r
        except Exception as e:
            last = e
            wait = 5 * (i + 1)
            print(f"  retry {i+1} in {wait}s ({type(e).__name__})", flush=True)
            time.sleep(wait)
    raise last


def upload(path: str) -> bool:
    name = os.path.basename(path)
    data = open(path, "rb").read()
    r = _retry(lambda: requests.post(
        f"{SB}/storage/v1/object/book-assets/bases/{name}",
        headers={"Authorization": f"Bearer {KEY}",
                 "Content-Type": "image/jpeg",
                 "x-upsert": "true"},
        data=data, timeout=180))
    return r.status_code in (200, 201)


def flatten(img) -> Image.Image:
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        return bg
    return img.convert("RGB")


def render_combo(psd_path: str, out: str, sp=None, hp=None, stp=None):
    psd = PSDImage.open(psd_path)
    if sp is not None:
        m.set_variant(psd, m._normalize_skin_name(sp), hp, stp)
    for layer in psd:
        if layer.kind == "type":
            layer.visible = False
    img = flatten(psd.composite(force=True))
    img.save(out, "JPEG", quality=92, dpi=(300, 300))
    del psd, img
    gc.collect()


def do_page(pg: int):
    tag = f"page{pg:02d}"
    have = existing(tag)
    path = psd_path(f"Modesty_{pg:02d}_colored.psd")
    todo = []
    if pg == 17:
        todo = [(None, None, None, f"{tag}.jpg")]
    elif pg in FULL_PAGES:
        for sp, sk in SKINS:
            for hp, hk in HAIRS:
                for stp, stk in STYLES:
                    todo.append((sp, hp, stp, f"{tag}__{sk}-{hk}-{stk}.jpg"))
    elif pg in SKIN_PAGES:
        for sp, sk in SKINS:
            todo.append((sp, "Black", "Long straight", f"{tag}__{sk}.jpg"))
    done = skipped = 0
    for sp, hp, stp, name in todo:
        if name in have:
            skipped += 1
            continue
        out = f"/tmp/{name}"
        render_combo(path, out, sp, hp, stp)
        if not upload(out):
            raise RuntimeError(f"upload failed: {name}")
        os.remove(out)
        done += 1
        print(f"  {name} ok", flush=True)
    print(f"{tag}: rendered {done}, skipped {skipped} existing", flush=True)


def do_cover():
    have = existing("cover")
    path = psd_path("Cover.psd")
    done = skipped = 0
    for sp, sk in SKINS:
        for hp, hk in HAIRS:
            for stp, stk in STYLES:
                name = f"cover__{sk}-{hk}-{stk}.jpg"
                if name in have:
                    skipped += 1
                    continue
                out = f"/tmp/{name}"
                render_combo(path, out, sp, hp, stp)
                if not upload(out):
                    raise RuntimeError(f"upload failed: {name}")
                os.remove(out)
                done += 1
                print(f"  {name} ok", flush=True)
    print(f"cover: rendered {done}, skipped {skipped} existing", flush=True)


if __name__ == "__main__":
    which = sys.argv[1].strip().lower()
    print(f"rendering range: {which}", flush=True)
    if which == "cover":
        do_cover()
    else:
        a, b = map(int, which.split("-"))
        for pg in range(a, b + 1):
            do_page(pg)
    print("RANGE COMPLETE", flush=True)
