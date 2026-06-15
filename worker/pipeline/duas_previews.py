#!/usr/bin/env python3
"""
Generate the storefront preview assets for the Duas book into public/images/:
  - duas/<character>-<look>.jpg        portrait bust for the look picker
  - duas/cover-<character>-<look>.jpg  NAMELESS cover (storefront overlays the
                                       customer's typed name on top)
  - book-duas.jpg                      catalogue cover (neutral, no sample name)
  - duas-preview-1/2/3.jpg             gallery: illustration, treasure chest,
                                       star chart (no names baked in)

Runs in CI (needs Supabase art). Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
"""
from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import duas_pipeline as P  # noqa: E402

OUT = Path("public/images")
(OUT / "duas").mkdir(parents=True, exist_ok=True)


def bust_portrait(ch, lk, size=620):
    """Child bust on cream for the look-picker grid (name-neutral)."""
    img = Image.new("RGB", (size, size), P.CREAM)
    cut = P.hero_cutout({"char": ch, "look": lk}, int(size * 0.82))
    x = (size - cut.width) // 2
    y = size - cut.height - int(size * 0.04)
    img.paste(cut, (x, max(0, y)), cut)
    return img


def main():
    for ch in ("boy", "girl", "hijab"):
        for lk in ("afro", "indian", "white"):
            ctx = {"name": "", "char": ch, "look": lk, "eye": "brown"}
            bust_portrait(ch, lk).save(OUT / "duas" / f"{ch}-{lk}.jpg", "JPEG", quality=88)
            P.front_cover(ctx, show_name=False).resize((900, 900), Image.LANCZOS).save(
                OUT / "duas" / f"cover-{ch}-{lk}.jpg", "JPEG", quality=90)
            # story illustration for the flip-through preview (reflects the look)
            P.picture_page(["page0005", "L"], {"char": ch, "look": lk, "eye": "brown"}).resize(
                (900, 900), Image.LANCZOS).save(
                OUT / "duas" / f"scene-{ch}-{lk}.jpg", "JPEG", quality=90)
            print("combo", ch, lk, flush=True)

    # catalogue cover — real design, neutral (no sample child name)
    P.front_cover({"name": "Your Child", "char": "hijab", "look": "indian", "eye": "brown"}).resize(
        (900, 900), Image.LANCZOS).save(OUT / "book-duas.jpg", "JPEG", quality=90)

    # gallery (name-free): an illustration, the treasure chest, the star chart
    art_ctx = {"char": "hijab", "look": "indian", "eye": "brown"}
    P.picture_page(["page0009", "L"], art_ctx).resize((900, 900), Image.LANCZOS).save(
        OUT / "duas-preview-1.jpg", "JPEG", quality=88)
    tc = P.BOOK["treasure_chest"]
    P.to_fb(P.chest_page(tc[:6])).resize((900, 900), Image.LANCZOS).save(
        OUT / "duas-preview-2.jpg", "JPEG", quality=88)
    P.to_fb(P.star_chart()).resize((900, 900), Image.LANCZOS).save(
        OUT / "duas-preview-3.jpg", "JPEG", quality=88)
    print("done", flush=True)


if __name__ == "__main__":
    main()
