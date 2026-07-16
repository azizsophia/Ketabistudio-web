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
import os
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


# ── Real sample photos (audit 2026-07-16) ────────────────────────────
# The gradient _photo() stand-ins made every preview look blurry/broken, so
# each template now uses REAL licensed Pexels photos (curated: women in hijab
# only; warm object shots — hands, tea, letters, baby feet — where no person
# is needed). Set KEEPSAKE_PHOTO_DIR to the pool; files are m_<id>.jpg /
# k_<id>.jpg. Missing dir or file falls back to the old stand-in so CI never
# breaks.
PHOTO_DIR = os.environ.get(
    "KEEPSAKE_PHOTO_DIR",
    "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad/_kspool",
)

# 21 entries per template: [cover, p1..p20]. Prefixes: m_=Muslim-family pool,
# k_=face-free objects pool.
REAL_PHOTOS = {
    "about-mama": [
        # cover = the golden-hour mother+child the owner loved from the reel
        "m_38495231", "m_34251173", "m_27589458", "m_30647742", "m_6392810",
        "m_32483776", "m_29264210", "m_16011524", "m_17067956", "m_38473425",
        "m_18093186", "m_28808690", "m_36363429", "m_32535731", "m_18785860",
        "k_20228242", "k_15527661", "m_20511043", "m_20510966", "m_7249715",
        "m_36313329",
    ],
    "about-baba": [
        "m_9127593", "m_9127661", "m_9127757", "m_9127722", "m_9127577",
        "m_9127779", "m_9127756", "m_9127602", "m_9127161", "m_38487730",
        "m_38487738", "m_23021521", "k_7475804", "k_28725302", "k_36653640",
        "k_32779931", "m_9127571", "m_9127762", "m_9127155", "k_8114119",
        "k_8203550",
    ],
    "about-grandma": [
        "m_6482352", "m_5223975", "m_11444635", "k_5407277", "m_38473425",
        "k_20228242", "k_27403663", "k_13258831", "k_6634321", "k_281962",
        "k_30633929", "k_6918490", "k_16923833", "k_15527661", "k_17435323",
        "k_19040559", "k_31645187", "m_17067956", "m_28808690", "k_10445466",
        "k_29651943",
    ],
    "about-grandpa": [
        "m_9127577", "m_9127593", "k_281962", "k_30633929", "k_27682044",
        "k_3826650", "k_6918490", "k_19040559", "k_31645187", "k_10445466",
        "k_20228242", "k_13258831", "k_29651943", "k_6634321", "m_9127661",
        "m_9127722", "k_8203550", "k_37459168", "k_36653640", "k_28725302",
        "k_32779931",
    ],
    "about-spouse": [
        "k_28293167", "k_8260576", "k_37459168", "k_32695709", "k_14960151",
        "k_27572807", "k_19709850", "k_37023121", "k_29471808", "k_36327014",
        "k_30427076", "k_16923833", "k_15527661", "k_27743120", "k_17435323",
        "k_20228242", "k_13258831", "k_29651943", "k_6634321", "k_27403663",
        "k_2815693",
    ],
    "about-baby": [
        "k_326545", "k_19426923", "k_4964227", "k_32195922", "k_32112848",
        "k_31987551", "m_35053570", "m_27589458", "m_6392810", "m_28808690",
        "m_23021521", "m_20511043", "m_20511042", "m_20511041", "m_38495231",
        "k_28725302", "k_7475804", "k_36653640", "m_36363429", "m_32535731",
        "m_30647742",
    ],
    "our-ramadan": [
        "m_9127571", "m_9127762", "m_9127155", "m_36363451", "m_36363431",
        "m_36363437", "m_9127756", "k_2300710", "k_37023121", "k_29471808",
        "k_36327014", "k_30427076", "m_9127602", "m_9127577", "m_34175145",
        "m_36068787", "m_29264210", "m_18925178", "m_9127161", "m_38487730",
        "m_9127722",
    ],
}


def _real_photo(name, seed):
    """Load a curated real photo; fall back to the old stand-in gradient."""
    for cand in (f"{PHOTO_DIR}/{name}.jpg",):
        if name and not name.endswith("_SKIP") and Path(cand).exists():
            im = Image.open(cand).convert("RGB")
            w, h = im.size
            s = min(w, h)
            im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
            if s > SRC_PX:
                im = im.resize((SRC_PX, SRC_PX), Image.LANCZOS)
            return im
    return _photo(seed)


# Captions mirror lib/photobook.ts (kept in sync by hand).
CAPTIONS = {
    "about-mama": [
        "Mama, Allah blessed me with you.",
        "No one takes care of me the way you do.",
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
        "Allah picked you to be my Baba, and I'm so glad He did.",
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
        "You have made dua for me my whole life.",
        "You tell the best stories about our family.",
        "Your hands have made a thousand meals with love.",
        "I love the way you speak about our deen.",
        "You always have room on your lap and in your heart.",
        "Your home smells like every happy memory.",
        "You slip me treats and a little extra love.",
        "You make every visit feel like Eid.",
        "Everything good in our family started with you.",
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
        "Your dua protect all of us.",
        "You tell the stories no one else remembers.",
        "I love sitting beside you after salah.",
        "You taught our family to be strong and kind.",
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
        "I thank Allah for you, every single day.",
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

    names = REAL_PHOTOS.get(slug, [None] * 21)
    urls = []
    for n in range(1, 21):
        p = src / f"p{n:02d}.jpg"
        _real_photo(names[n], base + n).save(p, "JPEG", quality=90)
        urls.append(p.as_uri())
    cover = src / "cover.jpg"
    _real_photo(names[0], base + 99).save(cover, "JPEG", quality=90)

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
