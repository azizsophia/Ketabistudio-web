#!/usr/bin/env python3
"""
Render a SAMPLE "About Mama" photo book with PLACEHOLDER photos so the design
can be viewed in CI without any real customer photos or Lulu keys.

It generates 20 tasteful placeholder images in-script with PIL (soft gradients
in the keepsake palette, a centred "Photo N" label, ~2600px so they pass the
DPI guard), then calls the REAL pipeline:

    photobook_pipeline.build(photo_data, out, cover_type="softcover")

so what we see in the output IS what customers get (same interior layout, same
cover art). The keepsake SELLS as a 24pp hardcover casewrap, but the casewrap
cover geometry needs Lulu; for this design-preview render we use the fixed
softcover wrap (identical cover art, only the spine/turn-in geometry differs) so
NO Lulu client is needed.

Env (optional, only if any asset fetch is ever needed): SUPABASE_URL,
SUPABASE_SERVICE_KEY. Nothing is printed from them.

Output: page01..page24 JPGs + cover.jpg in /tmp/photobook_sample, copied by the
workflow to ./photobook_sample.
"""
import shutil
import sys
from pathlib import Path

# Render the placeholders + book using the SAME pipeline as production.
sys.path.insert(0, str(Path(__file__).resolve().parent / "pipeline"))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

import photobook_pipeline as pb  # noqa: E402

OUT = Path("/tmp/photobook_sample")
PLACEHOLDER_DIR = OUT / "_placeholders"
PX = 2600  # short side >= 2400 so the DPI guard would pass


# Soft gradient stops drawn from the keepsake palette so the placeholders look
# at home in the design (cream / forest / gold / terracotta blends).
def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


PALETTE_PAIRS = [
    (pb.BONE, pb.ESPRESSO),
    (pb.BONE, pb.GOLD),
    (pb.PAPER, pb.STONE),
    (pb.GOLD_DEEP, pb.ESPRESSO),
    (pb.BONE, pb.STONE),
    (pb.ESPRESSO, pb.GOLD),
]


def _placeholder(n):
    """A soft diagonal-ish gradient with a centred 'Photo N' label."""
    top, bot = PALETTE_PAIRS[(n - 1) % len(PALETTE_PAIRS)]
    img = Image.new("RGB", (PX, PX))
    px = img.load()
    # vertical soft gradient (cheap, smooth)
    for y in range(PX):
        t = y / (PX - 1)
        # ease so the blend feels gentle
        t = t * t * (3 - 2 * t)
        row = _lerp(top, bot, t)
        for x in range(0, PX, 1):
            px[x, y] = row
    d = ImageDraw.Draw(img)
    # a soft inner glow rectangle to add depth
    d.rectangle([PX * 0.10, PX * 0.10, PX * 0.90, PX * 0.90],
                outline=_lerp(top, bot, 0.5), width=6)
    # centred label
    label = f"Photo {n}"
    try:
        fo = ImageFont.truetype(pb.CORM_IT, 320)
        try:
            fo.set_variation_by_axes([560])
        except Exception:
            pass
    except Exception:
        fo = ImageFont.load_default()
    tw = d.textlength(label, font=fo)
    # pick a label colour that contrasts the midtone
    mid = _lerp(top, bot, 0.5)
    ink = (247, 242, 234) if sum(mid) < 380 else pb.ESPRESSO
    d.text(((PX - tw) / 2, PX / 2 - 200), label, font=fo, fill=ink)
    sub = "sample placeholder"
    sfo = ImageFont.truetype(pb.CORM, 120)
    stw = d.textlength(sub, font=sfo)
    d.text(((PX - stw) / 2, PX / 2 + 220), sub, font=sfo, fill=ink)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PLACEHOLDER_DIR.mkdir(parents=True, exist_ok=True)

    # 20 placeholder photo pages + 1 cover photo, written to disk as files.
    urls = []
    for n in range(1, 21):
        p = PLACEHOLDER_DIR / f"photo{n:02d}.jpg"
        _placeholder(n).save(p, "JPEG", quality=92)
        urls.append(p.as_uri())
    cover_p = PLACEHOLDER_DIR / "cover.jpg"
    _placeholder(1).save(cover_p, "JPEG", quality=92)
    cover_url = cover_p.as_uri()

    # Mirror lib/photobook.ts default captions (20), same loving voice.
    default_captions = [
        "Mama, Allah blessed me with you.",
        "You are the first dua Allah answered for me.",
        "You teach me to love Allah.",
        "I love praying right beside you.",
        "Thank you for every duʿā you make for me.",
        "You fill our home with barakah.",
        "Your hugs make everything better.",
        "You read to me until my eyes grow sleepy.",
        "When I'm scared, you remind me Allah is near.",
        "I love the way you say bismillah before everything.",
        "You wipe my tears and make a dua over me.",
        "You're the first to make duʿā when I'm sick.",
        "You celebrate every little thing I learn.",
        "Your kitchen smells like love and good things.",
        "You forgive me before I even finish saying sorry.",
        "You are gentle with me on my hardest days.",
        "Being your child is a gift from Allah.",
        "I want to make you proud, in this life and the next.",
        "I pray we're together in Jannah, always.",
        "I love you more than all the stars, Mama.",
    ]

    photo_data = {
        "recipient_name": "Mama",
        "author_name": "Yusuf",
        "cover_photo_url": cover_url,
        "pages": [
            {"photo_url": urls[i], "caption": default_captions[i]}
            for i in range(20)
        ],
    }

    interior, cover_pdf, n_pages = pb.build(
        photo_data, str(OUT), cover_type="softcover", template="about-mama")
    print(f"sample built: {n_pages} pages")
    print(f"interior: {interior}")
    print(f"cover:     {cover_pdf}")
    assert n_pages == 24, f"expected 24 pages, got {n_pages}"

    # Clean up the placeholder source files so only the book output is pushed.
    shutil.rmtree(PLACEHOLDER_DIR, ignore_errors=True)


if __name__ == "__main__":
    main()
