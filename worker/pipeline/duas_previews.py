#!/usr/bin/env python3
"""
Generate the storefront preview assets for the Duas book into public/images/:
  - duas/<character>-<look>.jpg  (9 arch portraits for pick-by-picture + cover preview)
  - book-duas.jpg                (catalogue cover thumbnail)
  - duas-preview-1/2/3.jpg       (product-page gallery: story, treasure chest, star chart)

Runs in CI (needs Supabase art). Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
"""
from pathlib import Path
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import duas_pipeline as P  # noqa: E402

OUT = Path("public/images")
(OUT / "duas").mkdir(parents=True, exist_ok=True)


def arch_hero(ch, lk, size=1100):
    img = Image.new("RGB", (size, size), P.CREAM)
    d = ImageDraw.Draw(img)
    aw, ah, top = int(size * 0.62), int(size * 0.70), int(size * 0.15)
    P.hero_in_arch(img, d, {"char": ch, "look": lk}, size // 2, top, aw, ah)
    return img


def main():
    for ch in ("boy", "girl", "hijab"):
        for lk in ("afro", "indian", "white"):
            arch_hero(ch, lk).save(OUT / "duas" / f"{ch}-{lk}.jpg", "JPEG", quality=88)
            print("hero", ch, lk, flush=True)

    sample = {"name": "Layla", "char": "girl", "look": "indian", "eye": "hazel"}
    P.front_cover(sample).resize((900, 900), Image.LANCZOS).save(OUT / "book-duas.jpg", "JPEG", quality=90)
    P.story_page(["page0002", "R"], sample).resize((900, 900), Image.LANCZOS).save(OUT / "duas-preview-1.jpg", "JPEG", quality=88)
    tc = P.BOOK["treasure_chest"]
    P.chest_page(tc[:6], 0).resize((900, 900), Image.LANCZOS).save(OUT / "duas-preview-2.jpg", "JPEG", quality=88)
    P.star_chart().resize((900, 900), Image.LANCZOS).save(OUT / "duas-preview-3.jpg", "JPEG", quality=88)
    print("done", flush=True)


if __name__ == "__main__":
    main()
