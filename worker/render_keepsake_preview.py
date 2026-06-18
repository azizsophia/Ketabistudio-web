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
    "about-grandma": [
        "Allah blessed our family with you.",
        "Your dua have wrapped around me my whole life.",
        "You tell the best stories about our family.",
        "Your hands have made a thousand meals with love.",
        "I love the way you speak about our deen.",
        "You always have room on your lap and in your heart.",
        "Your home smells like every happy memory.",
        "You slip me treats and a little extra love.",
        "You make every visit feel like Eid.",
        "You taught my parent everything good in them.",
        "Your patience is softer than anyone I know.",
        "You remember every name in every dua.",
        "I love praying beside you.",
        "You keep our family's stories alive.",
        "You forgive before I can even ask.",
        "Your hugs feel like coming home.",
        "Being your grandchild is a gift from Allah.",
        "I pray Allah grants you long life and good health.",
        "I pray we're together in Jannah, always.",
        "I love you more than all the stars, Grandma.",
    ],
    "about-grandpa": [
        "Allah blessed our family with you.",
        "Your dua are a shade over all of us.",
        "You tell the stories no one else remembers.",
        "I love sitting beside you after salah.",
        "You taught my parent to be strong and kind.",
        "Your hands have worked hard for all of us.",
        "You answer my questions with patience.",
        "You make me feel brave.",
        "You remember the old days so beautifully.",
        "I love hearing you recite Qur'an.",
        "You always have wisdom and a little joke.",
        "You taught me to give without being asked.",
        "Your faith is a light passed down to me.",
        "You never miss a chance to make dua for me.",
        "You forgive before I can even ask.",
        "Your blessing means the world to me.",
        "Being your grandchild is a gift from Allah.",
        "I pray Allah grants you long life and good health.",
        "I pray we're together in Jannah, always.",
        "I love you more than all the stars, Grandpa.",
    ],
    "about-spouse": [
        "Alhamdulillah, Allah wrote you into my life.",
        "You are the answer to a dua I made before I knew you.",
        "I love praying Fajr beside you.",
        "You make our house a home full of barakah.",
        "Your patience makes me a better Muslim.",
        "You hold my hand through every hard day.",
        "I love hearing you make dua for us.",
        "You forgive me, again and again.",
        "You believe in me when I forget to.",
        "Our laughter is one of Allah's gifts to me.",
        "You are my comfort, the coolness of my eyes.",
        "I love building this life and this deen with you.",
        "You carry me in your dua wherever I go.",
        "Every ordinary day with you feels like a blessing.",
        "You are my home in this dunya.",
        "I love growing closer to Allah alongside you.",
        "Loving you is part of how I worship Allah.",
        "I pray our love is a sadaqah that lasts.",
        "I pray Allah keeps us together in Jannah.",
        "I love you more, every single year.",
    ],
    "about-baby": [
        "You are an answered dua, little one.",
        "We whispered the adhan into your ear.",
        "We made dua for you before we ever met you.",
        "Allah chose us to be your family.",
        "Your tiny hands hold our whole hearts.",
        "We say bismillah over you every day.",
        "You are an amanah from Allah we will protect.",
        "We pray you grow to love Allah.",
        "Every sleepless night is worth your smile.",
        "We see Allah's mercy in your face.",
        "You made us a family.",
        "We can't wait to teach you your first dua.",
        "You are the coolness of our eyes.",
        "We pray you are of the righteous.",
        "Your laugh is our favorite sound in the world.",
        "We thank Allah for you in every salah.",
        "May your heart always be full of iman.",
        "We pray for Jannah for you, and for us with you.",
        "You are loved beyond measure, by us and by Allah.",
        "Welcome to the world, our little blessing.",
    ],
    "our-ramadan": [
        "The first crescent moon of Ramadan.",
        "Suhoor together before the sky turns light.",
        "The adhan that means it's time to break our fast.",
        "Dates and water, and a whispered alhamdulillah.",
        "Standing together for taraweeh.",
        "The smell of our kitchen at iftar.",
        "Giving sadaqah with our own hands.",
        "Reading Qur'an as a family.",
        "Lanterns and lights around our home.",
        "Making dua in the last ten nights.",
        "Searching for Laylatul Qadr together.",
        "Helping prepare the iftar table.",
        "Forgiving each other and starting fresh.",
        "The quiet of the masjid at night.",
        "Learning a new surah this month.",
        "Sharing food with our neighbors.",
        "The excitement the night before Eid.",
        "New clothes and Eid morning prayer.",
        "Hugging everyone and saying Eid Mubarak.",
        "A whole month that brought us closer to Allah.",
    ],
}
RECIPIENTS = {
    "about-mama": ("Mama", "Yusuf"),
    "about-baba": ("Baba", "Layla"),
    "about-grandma": ("Teta", "Maryam"),
    "about-grandpa": ("Jiddo", "Yusuf"),
    "about-spouse": ("Aisha", "Omar"),
    "about-baby": ("Yusuf", "Mama & Baba"),
    "our-ramadan": ("Ramadan", "Your Family"),
}
# distinct photo seeds per template so previews don't all look identical
SEEDS = {s: i for i, s in enumerate(RECIPIENTS)}


def render(slug):
    caps = CAPTIONS[slug]
    recipient, author = RECIPIENTS[slug]
    base = SEEDS[slug] * 40
    work = Path(f"/tmp/keepsake_preview_{slug}")
    src = work / "_src"
    if work.exists():
        shutil.rmtree(work)
    src.mkdir(parents=True)

    urls = []
    for n in range(1, 21):
        p = src / f"p{n:02d}.jpg"
        _photo(base + n).save(p, "JPEG", quality=90)
        urls.append(p.as_uri())
    cover = src / "cover.jpg"
    _photo(base + 99).save(cover, "JPEG", quality=90)

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
    import sys
    targets = sys.argv[1:] or list(RECIPIENTS.keys())
    for s in targets:
        render(s)
