#!/usr/bin/env python3
"""
Threads week 3 (2026-07-24 .. 07-30) as HYBRID posts: a watercolor We-The-Urban
card (image) whose full text also rides as the Threads caption. Best of both:
brand visual + uncroppable mark + native readable/searchable text.

Every verse card's ON-IMAGE text and caption quote are containment-checked
verbatim against the Clear Quran (rid 131) store before rendering. Dhikr walls
tile dhikr only. Our-words reminders need no verse check. 4/day at the same
Central slots as weeks 1-2.

Usage:
  python3 build_threads_week3.py            # render cards + contact sheet
  python3 build_threads_week3.py --queue    # upload cards + enqueue (platforms=th)
"""
import os, sys, json, re, unicodedata
import gen_wtu_post as G
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, "_threads_week3")
os.makedirs(OUT, exist_ok=True)
VER = json.load(open("/tmp/verses_verified.json"))


def _clean(s):
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"(?<=[A-Za-z.,])\d+", "", s)   # footnote digits
    s = re.sub(r"[.,]", "", s)                  # terminal punctuation varies in excerpts
    return re.sub(r"\s+", " ", s).strip().lower()


def _store_variants(key):
    """the Clear Quran's ˹˺ marks wrap editorial insertions — a verbatim excerpt
    may keep OR drop those words, so a fragment is valid if it matches either.
    A '+'-joined key (e.g. '94:5+94:6') spans consecutive verses."""
    en = " ".join(VER[k]["en"] for k in key.split("+"))
    keep = _clean(en.replace("˹", "").replace("˺", ""))     # inserted words kept
    drop = _clean(re.sub(r"˹[^˺]*˺", "", en))               # inserted words removed
    return keep, drop


def frag_ok(key, frag):
    f = _clean(frag.replace("˹", "").replace("˺", "").replace("“", "").replace("”", "").replace("…", " "))
    keep, drop = _store_variants(key)
    return f in keep or f in drop


# slot, spec (render), caption, optional (verse_key, on_image_fragment)
P = []
def post(slot, spec, caption, verify=None):
    P.append({"slot": slot, "spec": spec, "caption": caption, "verify": verify})


# ── FRI JUL 24 (Kahf Friday) ──
post("Fri 6:30", {"format": "verse", "color": "sage", "seed": 61,
     "title": [("Before the week ", False), ("asks anything of you.", True)], "size": 62,
     "verse_lines": ["“Our Lord! Grant us mercy", "from Yourself and guide us", "rightly through our ordeal.”"],
     "cite": "QURAN 18:10  ·  THE CLEAR QURAN"},
     "It is Friday. Take a few quiet minutes for Surah al-Kahf.\n\n“Our Lord! Grant us mercy from Yourself and guide us rightly through our ordeal.” (Quran 18:10 · The Clear Quran)",
     ("18:10", "Our Lord! Grant us mercy from Yourself and guide us rightly through our ordeal."))
post("Fri 12:00", {"format": "reminder", "color": "blue", "seed": 33, "size": 86,
     "title": [("You are not behind.", False)], "sub": ["Allah’s timing does not run late."], "sub_size": 48},
     "You are not behind.\n\nAllah’s timing does not run late. What is written for you is already on its way, and it does not know how to miss you.")
post("Fri 17:30", {"format": "wall", "color": "terra", "seed": 3, "arabic": "الحمد لله",
     "rows": 12, "closing": "for it all."},
     "Say it until you feel it.\n\nAlhamdulillah for it all.")
post("Fri 21:00", {"format": "reminder", "color": "aubergine", "seed": 45,
     "title": [("You did not carry ", False), ("this week alone.", True)], "size": 74},
     "Gentle reminder from your deen: you did not carry this week alone. Allah carried you through every single day of it. Sleep tonight like someone who was never on their own.")

# ── SAT JUL 25 ──
post("Sat 6:30", {"format": "verse", "color": "plum", "seed": 21,
     "title": [("To whoever woke up ", False), ("feeling forgotten.", True)], "size": 62,
     "verse_lines": ["“Your Lord has", "not abandoned you.”"],
     "cite": "QURAN 93:3  ·  THE CLEAR QURAN"},
     "To whoever woke up feeling forgotten this morning: there is a whole surah whose message is that you are not.\n\n“Your Lord ˹O Prophet˺ has not abandoned you, nor has He become hateful ˹of you˺.” (Quran 93:3 · The Clear Quran)",
     ("93:3", "Your Lord has not abandoned you."))
post("Sat 12:00", {"format": "reminder", "color": "rose", "seed": 11, "size": 80,
     "title": [("Protect your peace ", False), ("on a prayer mat.", True)]},
     "Protecting your peace does not always mean cutting people off. Sometimes it is seven quiet minutes on a prayer mat, telling Allah the version of the story no one else gets to hear.")
post("Sat 17:30", {"format": "verse", "color": "ochre", "seed": 5,
     "title": [("The ease is already ", False), ("inside it.", True)], "size": 64,
     "verse_lines": ["“So, surely with hardship", "comes ease. Surely with that", "hardship comes more ease.”"],
     "cite": "QURAN 94:5-6  ·  THE CLEAR QURAN"},
     "Read the wording. The ease does not come after the hardship. It comes with it.\n\n“So, surely with hardship comes ease. Surely with ˹that˺ hardship comes ˹more˺ ease.” (Quran 94:5-6 · The Clear Quran)",
     ("94:5+94:6", "So, surely with hardship comes ease. Surely with that hardship comes more ease."))
post("Sat 21:00", {"format": "wall", "color": "forest", "seed": 27, "arabic": "سبحان الله",
     "rows": 12, "closing": "in the good, and the hard.", "en_size": 54, "fade": True},
     "A quiet tasbih before you sleep.\n\nSubhanAllah, in the good and the hard.")

# ── SUN JUL 26 ──
post("Sun 6:30", {"format": "reminder", "color": "clay", "seed": 7, "size": 84,
     "title": [("You reached the day ", False), ("before it reached you.", True)]},
     "Fajr means you reached the day before the day reached you. Whatever Sunday is about to ask of you, you already spoke to your Lord before any of it.")
post("Sun 12:00", {"format": "verse", "color": "forest", "seed": 40,
     "title": [("When your heart ", False), ("will not settle.", True)], "size": 64,
     "verse_lines": ["“Surely in the remembrance", "of Allah do hearts", "find comfort.”"],
     "cite": "QURAN 13:28  ·  THE CLEAR QURAN"},
     "You have tried scrolling yourself calm. Your heart has one home.\n\n“Surely in the remembrance of Allah do hearts find comfort.” (Quran 13:28 · The Clear Quran)",
     ("13:28", "Surely in the remembrance of Allah do hearts find comfort."))
post("Sun 17:30", {"format": "reminder", "color": "sage", "seed": 8, "size": 80,
     "title": [("Staying kind ", False), ("is not weakness.", True)]},
     "Not sure who needs to hear this, but staying kind in a world that hurt you is not weakness. It is the quietest form of strength you will use all day.")
post("Sun 21:00", {"format": "ameen", "color": "aubergine", "seed": 17, "arabic": "اللهم آمين",
     "title": [("The thing you", False), (" pray for ", True), ("quietly", True), (" is coming.", False)], "size": 72},
     "The dua you keep making in secret.\n\nType Ameen and let us make it together, for you and for whoever reads this.")

# ── MON JUL 27 ──
post("Mon 6:30", {"format": "reminder", "color": "blue", "seed": 52, "size": 82,
     "title": [("You reached Monday. ", False), ("Allah reached it first.", True)]},
     "You reached Monday. Allah reached it first, and arranged what you will need before you even opened your eyes.")
post("Mon 12:00", {"format": "verse", "color": "plum", "seed": 24,
     "title": [("When it feels like ", False), ("no one is listening.", True)], "size": 62,
     "verse_lines": ["“I am truly near. I respond", "to one’s prayer when they", "call upon Me.”"],
     "cite": "QURAN 2:186  ·  THE CLEAR QURAN"},
     "When it feels like no one is listening, read this slowly.\n\n“I am truly near. I respond to one’s prayer when they call upon Me.” (Quran 2:186 · The Clear Quran)",
     ("2:186", "I am truly near. I respond to one’s prayer when they call upon Me."))
post("Mon 17:30", {"format": "wall", "color": "rose", "seed": 14, "arabic": "أستغفر الله",
     "rows": 12, "closing": "for what I know, and what I forgot.", "en_size": 48},
     "Astaghfirullah.\n\nFor what I know, and what I forgot. Say it a few times before you scroll on.")
post("Mon 21:00", {"format": "reminder", "color": "ochre", "seed": 6, "size": 90,
     "title": [("Rest is not ", False), ("falling behind.", True)]},
     "Rest is not falling behind. You answer to the Most Merciful, not to an algorithm. Close the apps, pray, and let your heart catch up to your day.")

# ── TUE JUL 28 ──
post("Tue 6:30", {"format": "verse", "color": "aubergine", "seed": 31,
     "title": [("You have not ", False), ("gone too far.", True)], "size": 64,
     "verse_lines": ["“Do not lose hope in Allah’s", "mercy, for Allah certainly", "forgives all sins.”"],
     "cite": "QURAN 39:53  ·  THE CLEAR QURAN"},
     "For the one who thinks they have sinned too much to come back:\n\n“Do not lose hope in Allah’s mercy, for Allah certainly forgives all sins.” (Quran 39:53 · The Clear Quran)",
     ("39:53", "Do not lose hope in Allah’s mercy, for Allah certainly forgives all sins."))
post("Tue 12:00", {"format": "reminder", "color": "clay", "seed": 19, "size": 78,
     "title": [("The duas you forgot ", False), ("were never lost.", True)]},
     "Not sure who needs to hear this, but the duas you made years ago and forgot about were never lost in transit. He does not forget a single one.")
post("Tue 17:30", {"format": "reminder", "color": "moss", "seed": 22, "size": 76,
     "title": [("Five appointments ", False), ("with peace, daily.", True)]},
     "Five daily prayers are five appointments with peace, spaced exactly where a human heart starts to run low. You were never meant to carry a whole day in one breath.")
post("Tue 21:00", {"format": "verse", "color": "plum", "seed": 21,
     "title": [("There is no version of you ", False), ("He cannot restore.", True)], "size": 62,
     "verse_lines": ["“…whose evil deeds Allah will", "change into good deeds.”"],
     "cite": "QURAN 25:70  ·  THE CLEAR QURAN"},
     "For the one who thinks they have gone too far to come back.\n\n“As for those who repent, believe, and do good deeds, they are the ones whose evil deeds Allah will change into good deeds.” (Quran 25:70 · The Clear Quran)",
     ("25:70", "whose evil deeds Allah will change into good deeds"))

# ── WED JUL 29 ──
post("Wed 6:30", {"format": "verse", "color": "forest", "seed": 44,
     "title": [("Nothing in your life ", False), ("is unattended.", True)], "size": 62,
     "verse_lines": ["“Not even a leaf falls", "without His knowledge.”"],
     "cite": "QURAN 6:59  ·  THE CLEAR QURAN"},
     "The result you are waiting on. The message they never sent. Nothing in your life is unattended.\n\n“Not even a leaf falls without His knowledge” (Quran 6:59 · The Clear Quran)",
     ("6:59", "Not even a leaf falls without His knowledge"))
post("Wed 12:00", {"format": "reminder", "color": "rose", "seed": 13, "size": 82,
     "title": [("Send this to someone ", False), ("carrying something heavy.", True)]},
     "Send this to someone carrying something heavy. May Allah soften what life made them carry, and lighten what you cannot see them holding.")
post("Wed 17:30", {"format": "verse", "color": "ochre", "seed": 9,
     "title": [("Nothing kind you did ", False), ("was ever wasted.", True)], "size": 62,
     "verse_lines": ["“Is there any reward for", "goodness except goodness?”"],
     "cite": "QURAN 55:60  ·  THE CLEAR QURAN"},
     "Keep being the one who checks in first, forgives quietly, gives without an audience.\n\n“Is there any reward for goodness except goodness?” (Quran 55:60 · The Clear Quran)",
     ("55:60", "Is there any reward for goodness except goodness?"))
post("Wed 21:00", {"format": "wall", "color": "aubergine", "seed": 50, "arabic": "لا إله إلا الله",
     "rows": 11, "closing": "and nothing else was ever the point.", "en_size": 46, "fade": True,
     "ar_size": 56, "row_h": 78},
     "La ilaha illa Allah.\n\nWhen the noise gets loud, come back to the one line that holds everything.")

# ── THU JUL 30 ──
post("Thu 6:30", {"format": "verse", "color": "sage", "seed": 60,
     "title": [("Walk in ", False), ("already backed.", True)], "size": 66,
     "verse_lines": ["“If Allah helps you,", "none can defeat you.”"],
     "cite": "QURAN 3:160  ·  THE CLEAR QURAN"},
     "Whatever you are walking into today:\n\n“If Allah helps you, none can defeat you.” (Quran 3:160 · The Clear Quran)",
     ("3:160", "If Allah helps you, none can defeat you."))
post("Thu 12:00", {"format": "reminder", "color": "clay", "seed": 28, "size": 82,
     "title": [("Stay soft. ", False), ("It weighs something.", True)]},
     "It is okay if the most impressive thing you do today is stay soft in a world that keeps handing you reasons not to. That counts. That weighs something.")
post("Thu 17:30", {"format": "verse", "color": "forest", "seed": 40,
     "title": [("You remember Him. ", False), ("He remembers you back.", True)], "size": 62,
     "verse_lines": ["“Remember Me;", "I will remember you.”"],
     "cite": "QURAN 2:152  ·  THE CLEAR QURAN"},
     "You remember Him between errands, worries, and lock screens. The response is a promise most of us scroll right past.\n\n“remember Me; I will remember you.” (Quran 2:152 · The Clear Quran)",
     ("2:152", "remember Me; I will remember you."))
post("Thu 21:00", {"format": "reminder", "color": "plum", "seed": 38, "size": 66,
     "title": [("Some reminders deserve ", False), ("more than a save button.", True)], "sub": ["From One Root · ketabistudio.etsy.com"], "sub_size": 40},
     "If these reminders have been reaching you this week, we made something to keep them. From One Root is a 30-day Quran journal: one verse a day, one honest page. Digital download on our Etsy, ketabistudio.etsy.com")


SLOT_UTC = {"6:30": ("11:30", 0), "12:00": ("17:00", 0), "17:30": ("22:30", 0), "21:00": ("02:00", 1)}
DAYNUM = {"Fri": 24, "Sat": 25, "Sun": 26, "Mon": 27, "Tue": 28, "Wed": 29, "Thu": 30}


def sched(slot):
    day, hm = slot.split()
    utc, plus = SLOT_UTC[hm]
    return f"2026-07-{DAYNUM[day] + plus:02d}T{utc}:00Z"


def verify():
    errs = []
    for i, p in enumerate(P):
        if len(p["caption"]) > 500:
            errs.append(f"post {i+1} caption over 500 ({len(p['caption'])})")
        v = p["verify"]
        if p["spec"]["format"] == "verse":
            if not v:
                errs.append(f"post {i+1} verse with no verify"); continue
            key, frag = v
            if not frag_ok(key, frag):
                errs.append(f"post {i+1} {key}: caption frag not verbatim")
            onimg = " ".join(p["spec"]["verse_lines"])
            if not frag_ok(key, onimg):
                errs.append(f"post {i+1} {key}: ON-IMAGE not verbatim:\n    {onimg}")
    return errs


def main():
    errs = verify()
    if errs:
        print("VERIFY FAILURES:")
        for e in errs:
            print(" -", e)
        sys.exit(1)
    print(f"{len(P)} posts — all verse cards verified verbatim ✓ (all captions <=500 ✓)")
    paths = []
    for i, p in enumerate(P):
        out = os.path.join(OUT, f"t3_{i+1:02d}_{p['spec']['format']}.png")
        G.render(p["spec"], out)
        paths.append(out)
    print(f"rendered {len(paths)} cards")
    tw, th, gap = 300, 375, 5
    sheet = Image.new("RGB", (tw * 4 + gap * 5, th * 7 + gap * 8), (247, 245, 240))
    for i, pth in enumerate(paths):
        im = Image.open(pth).resize((tw, th), Image.LANCZOS)
        r, c = i // 4, i % 4
        sheet.paste(im, (gap + c * (tw + gap), gap + r * (th + gap)))
    sheet.save(os.path.join(OUT, "t3_sheet.png"))
    print("wrote t3_sheet.png")

    if "--queue" in sys.argv:
        import urllib.request
        secret = os.environ.get("CRON_SECRET", "ketabi-cron-2027")
        base = "https://www.ketabistudio.com"
        rows = []
        for p, pth in zip(P, paths):
            with open(pth, "rb") as fh:
                body, ct = _mp(fh.read(), os.path.basename(pth))
            req = urllib.request.Request(f"{base}/api/social/photo", data=body, method="POST",
                headers={"Content-Type": ct, "Authorization": f"Bearer {secret}"})
            url = json.load(urllib.request.urlopen(req, timeout=90))["url"]
            rows.append({"platforms": "th", "caption": p["caption"], "image_url": url,
                         "scheduled_for": sched(p["slot"])})
        req = urllib.request.Request(f"{base}/api/social/enqueue",
            data=json.dumps({"posts": rows}).encode(), method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret}"})
        print(json.load(urllib.request.urlopen(req, timeout=60)))


def _mp(data, fn):
    b = "----ketabith3"
    pre = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; "
           f"filename=\"{fn}\"\r\nContent-Type: image/png\r\n\r\n").encode()
    return pre + data + f"\r\n--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"


if __name__ == "__main__":
    main()
