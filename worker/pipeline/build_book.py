"""
Strict production build for the personalized hijab book.

Identical calls to the validated modesty_pipeline.run_pipeline, with ONE
difference: any page/cover error RAISES and halts the order. No blank-page
fallbacks in production — a book is perfect or it does not exist.
"""
from pathlib import Path


def build_strict(child_name, skin_tone, hair_color, hair_style, out_dir):
    import modesty_pipeline as m

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    name = m.clean_child_name(child_name)

    pages = []
    for pg in range(1, 26):
        img = m.generate_page(pg, name, skin_tone, hair_color, hair_style)
        pages.append(img)  # generate_page raises on any failure → halt

    cover_img = m.generate_cover(name, skin_tone, hair_color, hair_style)

    interior_pdf, cover_pdf = m.assemble_pdf(pages, cover_img, out, name)
    return str(interior_pdf), str(cover_pdf)
