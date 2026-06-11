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

SB = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
PSD_DIR = os.environ["MODESTY_DIR"].rstrip("/")

SKINS = [("Blonde light", "light"), ("Blonde dark", "medium"), ("Dark", "dark")]
HAIRS = [("Black", "black"), ("Brown", "brown"),
         ("Blonde", "blonde"), ("Red", "red")]
STYLES = [("Long straight", "long-straight"), ("Long curly", "long-curly"),
          ("Short straight", "short-straight"), ("Short curly", "short-curly")]

FULL_PAGES = set(range(1, 12))
SKIN_PAGES = set(range(12, 26)) - {17}


def existing(prefix: str) -> set:
    r = requests.post(f"{SB}/storage/v1/object/list/book-assets",
                      headers={"Authorization": f"Bearer {KEY}",
                               "Content-Type": "application/json"},
                      json={"prefix": f"bases/{prefix}", "limit": 1000},
                      timeout=30)
    r.raise_for_status()
    return {i["name"] for i in r.json()}


def upload(path: str) -> bool:
    name = os.path.basename(path)
    with open(path, "rb") as fh:
        r = requests.post(f"{SB}/storage/v1/object/book-assets/bases/{name}",
                          headers={"Authorization": f"Bearer {KEY}",
                                   "Content-Type": "image/jpeg",
                                   "x-upsert": "true"},
                          data=fh.read(), timeout=120)
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
    path = f"{PSD_DIR}/Modesty_{pg:02d}_colored.psd"
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
    path = f"{PSD_DIR}/Cover.psd"
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
