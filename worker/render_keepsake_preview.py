#!/usr/bin/env python3
"""Render web-optimised PREVIEW pages for the photo-book keepsakes so the
storefront flip-book shows the real design.

For each template it generates label-free, photographic-feel stand-in images
(real stock photos are not used here), runs the REAL pipeline, then writes
downscaled JPGs to:

    public/images/keepsake/<slug>/cover.jpg      (front cover panel)
    public/images/keepsake/<slug>/page01..24.jpg

These are committed and served statically by the flip-book. Replace the
stand-ins with curated sample photos whenever they're available — the layout,
type and cover are exactly what customers receive.

Run from the repo root:  python3 worker/render_keepsake_preview.py
"""
import random
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "worker" / "pipeline"))
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402
import photobook_pipeline as pb  # noqa: E402

WEB_W = 1000          # web preview width (px)
SRC_PX = 2700         # stand-in source size

TONES = [
    ((226, 208, 184), (120, 96, 78)),
    ((210, 198, 188), (96, 110, 96)),
    ((232, 214, 200), (158, 110, 96)),
    ((200, 206, 206), (84, 92, 104)),
    ((228, 216, 196), (150, 128, 86)),
    ((214, 200, 198), (132, 100, 110)),
]


def _photo(seed):
    random.seed(seed * 977 + 13)
    top, bot = TONES[seed % len(TONES)]
    img = Image.new("RGB", (SRC_PX, SRC_PX), top)
    px = img.load()
    for y in range(SRC_PX):
        t = (y / (SRC_PX - 1)) ** 1.1
        row = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(SRC_PX):
            px[x, y] = row
    blob = Image.new("RGB", (SRC_PX, SRC_PX), (0, 0, 0))
    bd = ImageDraw.Draw(blob, "RGBA")
    for _ in range(5):
        cxp = random.randint(int(SRC_PX * 0.2), int(SRC_PX * 0.8))
        cyp = random.randint(int(SRC_PX * 0.25), int(SRC_PX * 0.85))
        r = random.randint(int(SRC_PX * 0.18), int(SRC_PX * 0.42))
        tone = random.choice(TONES)[random.randint(0, 1)]
        bd.ellipse([cxp - r, cyp - r, cxp + r, cyp + r],
                   fill=tone + (random.randint(70, 150),))
    blob = blob.filter(ImageFilter.GaussianBlur(160))
    img = Image.blend(img, blob, 0.55).filter(ImageFilter.GaussianBlur(2))
    vig = Image.new("L", (SRC_PX, SRC_PX), 0)
    ImageDraw.Draw(vig).ellipse(
        [-int(SRC_PX * 0.15), -int(SRC_PX * 0.15),
         int(SRC_PX * 1.15), int(SRC_PX * 1.15)], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(260))
    dark = Image.new("RGB", (SRC_PX, SRC_PX), (40, 34, 30))
    return Image.composite(img, Image.blend(img, dark, 0.45), vig)


# Captions mirror lib/photobook.ts (kept in sync by hand).
CAPTIONS = {
    "about-mama": [
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
    ],
    "about-baba": [
        "Baba, Allah blessed me with you.",
        "You are an answer to a dua I never had to make.",
        "You teach me to love Allah.",
        "I love standing beside you in salah.",
        "Thank you for every duʿā you make for me.",
        "You work hard so our home is full of barakah.",
        "Your shoulders are the safest place in the world.",
        "You answer my biggest questions about Allah.",
        "When I'm scared, you remind me Allah is the strongest.",
        "I love the way you say bismillah before everything.",
        "You carry me when my legs are tired.",
        "You're the first to make duʿā when I'm sick.",
        "You're proud of me even when I make mistakes.",
        "You make ordinary days feel like an adventure.",
        "You forgive me before I even finish saying sorry.",
        "You are patient with me on my hardest days.",
        "Being your child is a gift from Allah.",
        "I want to make you proud, in this life and the next.",
        "I pray we're together in Jannah, always.",
        "I love you more than all the stars, Baba.",
    ],
}
RECIPIENTS = {"about-mama": ("Mama", "Yusuf"), "about-baba": ("Baba", "Layla")}


def render(slug):
    caps = CAPTIONS[slug]
    recipient, author = RECIPIENTS[slug]
    work = Path(f"/tmp/keepsake_preview_{slug}")
    src = work / "_src"
    if work.exists():
        shutil.rmtree(work)
    src.mkdir(parents=True)

    urls = []
    for n in range(1, 21):
        p = src / f"p{n:02d}.jpg"
        _photo(n if slug == "about-mama" else n + 40).save(p, "JPEG", quality=90)
        urls.append(p.as_uri())
    cover = src / "cover.jpg"
    _photo(99 if slug == "about-mama" else 199).save(cover, "JPEG", quality=90)

    photo_data = {
        "recipient_name": recipient,
        "author_name": author,
        "cover_photo_url": cover.as_uri(),
        "pages": [{"photo_url": urls[i], "caption": caps[i]} for i in range(20)],
    }
    pb.build(photo_data, str(work), cover_type="softcover", template=slug)

    out = ROOT / "public" / "images" / "keepsake" / slug
    out.mkdir(parents=True, exist_ok=True)
    # cover (front panel) + 24 interior pages -> web-optimised JPGs
    def web_save(srcp, dstp):
        im = Image.open(srcp).convert("RGB")
        h = int(im.height * (WEB_W / im.width))
        im.resize((WEB_W, h), Image.LANCZOS).save(dstp, "JPEG", quality=82,
                                                  optimize=True)
    web_save(work / "cover_front.jpg", out / "cover.jpg")
    for n in range(1, 25):
        web_save(work / f"page{n:02d}.jpg", out / f"page{n:02d}.jpg")
    shutil.rmtree(work, ignore_errors=True)
    print(f"wrote preview for {slug} -> {out}")


if __name__ == "__main__":
    for s in ("about-mama", "about-baba"):
        render(s)
