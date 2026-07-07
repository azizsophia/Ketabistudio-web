#!/usr/bin/env python3
# Build one week of Threads posts (4/day) from the VERIFIED journal_data. Each
# day = one root: morning reveal, midday verse, afternoon reveal+website nudge,
# evening reflection. Renders images (gen_thread_post) on clean backgrounds,
# writes a posts.json (image_path, caption, slot, root) + a contact sheet.
# Only 1 of 4 links out. Nothing here is unverified — text comes from journal_data.
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "etsy"))
from journal_data import DAYS
import gen_thread_post as T
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
SCR = "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad"
BGB = os.path.join(SCR, "bgboard")
PREM = os.path.join(SCR, "premium")
OUT = os.path.join(D, "_threads_week")
os.makedirs(OUT, exist_ok=True)

# Excluded after a visual scan: human figures/silhouettes, skin, alcohol, crypto
# coins, and working files with baked-in text. Nothing with a face/figure ships.
EXCLUDE = {
    "sabr_bluehour_1753156.jpg",   # woman silhouette
    "salam_dawn_10408382.jpg",     # person in bed
    "khalq_earth_29047311.jpg",    # seated figure
    "r_shukr_5754653.jpg",         # whiskey bottle (alcohol)
    "shukr_options.jpg",           # working contact sheet
    "shukr_13647954.jpg",          # baked-in text overlay
    "r_sadaqah_6764554.jpg",       # bitcoin coins
    "r_sadaqah_8048194.jpg",       # ethereum coin
    "r_sadaqah_8358039.jpg",       # crypto coins
}

# curated, face-free, on-brand background pool (bgboard themed + r_ premium)
CLEAN = [p for p in (
    sorted([os.path.join(BGB, f) for f in os.listdir(BGB)
            if f.endswith(".jpg") and "board" not in f and f != "meta.json"]) +
    sorted([os.path.join(PREM, f) for f in os.listdir(PREM) if f.startswith("r_")])
) if os.path.basename(p) not in EXCLUDE]

# a themed bg per root for the reveal posts (falls back to pool)
THEMED = {
    "rahma": "qalb_candle_35410295.jpg", "qalb": "qalb_candle_37764589.jpg",
    "fitra": "khalq_earth_15923679.jpg", "nur": "nur_light_19149954.jpg",
    "huda": "salam_dawn_27671434.jpg", "kataba": "iman_lantern_11263713.jpg",
    "khalq": "khalq_earth_15923679.jpg",
}


def key(translit):
    t = translit.lower().split("·")[0].strip().replace("al-", "").replace("'", "")
    return t.split()[0]


# rotating soft nudge (varied so it never reads copy-paste)
NUDGES = [
    "One Arabic root a day, each traced back to its source. The full 30 are in the journal on my Etsy, ketabistudio.com",
    "This is one page of thirty. Every root, verified and cited, in the From One Root journal, ketabistudio.com",
    "I made a 30-day journal out of these, one root a day, every source cited. It is on my Etsy, ketabistudio.com",
    "The whole language opens up one root at a time. 30 of them, sourced, in the journal at ketabistudio.com",
    "If this is your kind of thing, the full journal walks through 30 roots like this. ketabistudio.com",
    "Thirty roots, thirty mornings, each one cited. From One Root, on my Etsy, ketabistudio.com",
    "This is how the whole journal reads. One root, one source, one page a day. ketabistudio.com",
]

SLOTS = ["10:00", "13:00", "19:00", "22:00"]  # UTC


def build(days, start_date):
    """days: list of DAYS entries; start_date: 'YYYY-MM-DD' for day 0."""
    from datetime import date, timedelta
    y, m, dd = map(int, start_date.split("-"))
    d0 = date(y, m, dd)
    posts = []
    bi = 0

    def nextbg():
        nonlocal bi
        p = CLEAN[bi % len(CLEAN)]; bi += 1
        return p

    for di, day in enumerate(days):
        k = key(day["translit"])
        the_date = (d0 + timedelta(days=di)).isoformat()
        reveal_bg = os.path.join(BGB, THEMED[k]) if k in THEMED else nextbg()
        translit = day["translit"].split("·")[0].strip()
        gloss = day["gloss"]
        story1 = day["story"].split(". ")[0] + "."
        story2 = ". ".join(day["story"].split(". ")[:2]) + "."
        anchor = day["anchor"]
        # the FIRST citation segment is always the source OF THE ANCHOR quote;
        # any second segment is the supplementary source for the story. On a
        # standalone verse card we cite only the anchor's own source.
        cite = day["citation"].split("·")[0].strip()
        reflect = day["prompts"][0]

        # 1 morning: reveal (no link)
        p1 = os.path.join(OUT, f"d{di+1:02d}_1_{k}.jpg")
        T.letters(reveal_bg, day["letters"], translit, gloss, p1)
        posts.append(dict(image=p1, slot=SLOTS[0], date=the_date, root=k,
                          caption=story2))

        # 2 midday: the verse / anchor (no link)
        p2 = os.path.join(OUT, f"d{di+1:02d}_2_{k}.jpg")
        T.textcard(nextbg(), anchor, p2, cite=cite, size=62)
        posts.append(dict(image=p2, slot=SLOTS[1], date=the_date, root=k,
                          caption=f"{anchor}\n\n{cite}"))

        # 3 afternoon: reveal + website nudge (the ONE link)
        p3 = os.path.join(OUT, f"d{di+1:02d}_3_{k}.jpg")
        T.letters(nextbg(), day["letters"], translit, gloss, p3, website=True)
        posts.append(dict(image=p3, slot=SLOTS[2], date=the_date, root=k,
                          caption=f"{translit}: {gloss.replace(' · ', ', ')}.\n\n{NUDGES[di % len(NUDGES)]}"))

        # 4 evening: reflection (no link)
        p4 = os.path.join(OUT, f"d{di+1:02d}_4_{k}.jpg")
        refl_line = reflect.split(". ")[0] + "."
        T.textcard(nextbg(), refl_line, p4, size=56)
        posts.append(dict(image=p4, slot=SLOTS[3], date=the_date, root=k,
                          caption=reflect))

    with open(os.path.join(OUT, "posts.json"), "w") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)

    # contact sheet, 4 cols (one row per day)
    cols, tw = 4, 300
    th = int(tw * T.H / T.W)
    rows = len(days)
    sheet = Image.new("RGB", (tw * cols + 8 * (cols + 1), th * rows + 8 * (rows + 1)), (20, 20, 20))
    for i, p in enumerate(posts):
        r, c = divmod(i, cols)
        sheet.paste(Image.open(p["image"]).resize((tw, th), Image.LANCZOS),
                    (8 + c * (tw + 8), 8 + r * (th + 8)))
    sheet.save(os.path.join(D, "_threads_week_sheet.jpg"), quality=90)
    print(f"BUILT {len(posts)} posts ({len(days)} days) -> {OUT}")
    return posts


if __name__ == "__main__":
    # args: [start_date] [start_root_idx] [ndays]
    start = sys.argv[1] if len(sys.argv) > 1 else "2026-07-08"
    idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    ndays = int(sys.argv[3]) if len(sys.argv) > 3 else 7
    build(DAYS[idx:idx + ndays], start)
