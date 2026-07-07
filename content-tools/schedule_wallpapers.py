#!/usr/bin/env python3
# Render the 4 Friday dua wallpapers and APPEND them (replace=false) to Threads +
# IG/FB on the Fridays inside the 30-day window: Jul 10/17/24/31 (day offsets
# 3/10/17/24 from Jul 7), at 13:00 UTC. Does not disturb the master queue.
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_dua_wallpaper as WP
import requests

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(D, "etsy"))
from deck_data import DECK1
try:
    from deck_data import DECK2
except Exception:
    DECK2 = []
DECK = DECK1 + DECK2

HOST = "https://www.ketabistudio.com"
UP = HOST + "/api/cards/photo"; ENQ = HOST + "/api/social/enqueue"
SECRET = "ketabi-cron-2027"
TAGS = "#islam #quran #dua #islamicreminders #muslim #deen #islamicwallpaper #muslimah #jummah #wallpaper"

# (translit match, Friday day-offset)
PICKS = [
    ("muqallibal-qulubi", 3),        # Jul 10 — heart firm
    ("Hasbunal-lahu", 10),           # Jul 17 — Allah is sufficient
    ("min sharri ma khalaq", 17),    # Jul 24 — refuge in the perfect words
    ("la sahla illa", 24),           # Jul 31 — nothing is easy but what You make easy
]


def find(sub):
    for e in DECK:
        if sub.lower() in e["translit"].lower():
            return e
    raise KeyError(sub)


def utc(d, hh):
    dt = datetime.date(2026, 7, 7) + datetime.timedelta(days=d)
    return f"{dt.isoformat()}T{hh:02d}:00:00Z"


def upload(path):
    with open(path, "rb") as f:
        return requests.post(UP, files={"file": (os.path.basename(path), f, "image/jpeg")}, timeout=120).json().get("url")


def caption(e):
    return f"Save this one for your week.\n\n{e['translation']}\n\n{e['source']}\n\n{TAGS}"


def main():
    outdir = os.path.join(D, "_dua_wallpapers"); os.makedirs(outdir, exist_ok=True)
    posts = []
    for sub, d in PICKS:
        e = find(sub)
        p = os.path.join(outdir, f"wp_d{d:02d}.jpg")
        WP.wallpaper(e, p)
        u = upload(p)
        if not u:
            print("UPLOAD FAIL", sub); continue
        cap = caption(e)
        posts.append({"image_url": u, "caption": cap, "platforms": "th", "scheduled_for": utc(d, 13)})
        posts.append({"image_url": u, "caption": cap, "platforms": "ig,fb", "scheduled_for": utc(d, 13)})
        print("scheduled", sub[:24], "-> Fri", utc(d, 13)[:10])
    r = requests.post(ENQ, headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
                      data=json.dumps({"posts": posts, "replace": False}), timeout=120)
    print("APPEND", r.status_code, r.text[:150], "count", len(posts))


if __name__ == "__main__":
    main()
