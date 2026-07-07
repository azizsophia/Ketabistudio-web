#!/usr/bin/env python3
# Package the whole Instagram/Threads content month and REPLACE the queue:
#   Threads: 1 dict card/day 22:00 UTC (5pm CDT), order front-loads wide roots,
#            rahma+qalb LAST.
#   IG/FB:   2/day -> carousel 13:00 UTC (8am CDT) + reel 19:00 UTC (2pm CDT).
# Carousel and reel on the same day use DIFFERENT roots (reel order shifted 15).
# Renders everything, uploads, then enqueues once at the end (atomic-ish).
import os, sys, json, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_dictionary_card as G
import gen_dict_carousel as CAR
import gen_dict_reel as REEL
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "etsy"))
from journal_data import DAYS

D = os.path.dirname(os.path.abspath(__file__))
HOST = "https://www.ketabistudio.com"
UP = HOST + "/api/cards/photo"
VID = HOST + "/api/social/video"
ENQ = HOST + "/api/social/enqueue"
SECRET = "ketabi-cron-2027"

# root keys in journal order, then the posting order (rahma+qalb last)
KEYS = [d["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0] for d in DAYS]
ORDER = KEYS[2:] + KEYS[:2]            # fitra..ridwan, rahma, qalb  (30)
REEL_ORDER = ORDER[15:] + ORDER[:15]   # shifted so day i reel != day i carousel


def upload_img(path):
    import requests
    with open(path, "rb") as f:
        r = requests.post(UP, files={"file": (os.path.basename(path), f, "image/jpeg")}, timeout=120)
    return r.json().get("url")


def upload_vid(path):
    r = subprocess.run(["curl", "-s", "-X", "POST", VID, "-H", f"Authorization: Bearer {SECRET}",
                        "-F", f"file=@{path};type=video/mp4"], capture_output=True, text=True, timeout=300)
    try:
        return json.loads(r.stdout).get("url")
    except Exception:
        return None


def utc(day_from_jul7, hh):
    base = 1751925600  # 2026-07-07T22:00:00Z epoch? computed below to avoid Date
    # build ISO by hand from a fixed table (Jul 7 2026 + n days)
    import datetime
    d = datetime.date(2026, 7, 7) + datetime.timedelta(days=day_from_jul7)
    return f"{d.isoformat()}T{hh:02d}:00:00Z"


def cap_for(key):
    line = G.CONTENT[key][1]
    return f"{line}\n\n#islam #quran #arabic #islamicreminders #muslim #deen #islamicquotes #muslimah #{key} #revert"


def main():
    posts = []
    cardir = os.path.join(D, "_carousels"); os.makedirs(cardir, exist_ok=True)
    reeldir = os.path.join(D, "_reels_light"); os.makedirs(reeldir, exist_ok=True)

    # 1) Threads dict cards (already rendered in _dict_daily) -> upload in ORDER, 22:00
    print("== threads dict cards ==", flush=True)
    for i, key in enumerate(ORDER):
        idx = KEYS.index(key) + 1
        p = os.path.join(D, "_dict_daily", f"day_{idx:02d}_{key}.jpg")
        u = upload_img(p)
        if u:
            posts.append({"image_url": u, "caption": G.CONTENT[key][1], "platforms": "th",
                          "scheduled_for": utc(i, 22)})
        print("th", i, key, "ok" if u else "FAIL", flush=True)

    # 2) IG carousels -> render + upload, 13:00 starting Jul 8 (day offset 1)
    print("== carousels ==", flush=True)
    for i, key in enumerate(ORDER):
        num = KEYS.index(key) + 1
        slides = CAR.carousel(key, num, cardir)
        urls = [upload_img(s) for s in slides]
        if all(urls):
            posts.append({"image_url": " ".join(urls), "caption": cap_for(key), "platforms": "ig,fb",
                          "scheduled_for": utc(i + 1, 13)})
        print("car", i, key, "ok" if all(urls) else "FAIL", flush=True)

    # 3) IG reels -> render + upload, 19:00 starting Jul 8
    print("== reels (slow) ==", flush=True)
    for i, key in enumerate(REEL_ORDER):
        out = os.path.join(reeldir, f"reel_{key}.mp4")
        try:
            REEL.build(key, out, journal=(i % 3 == 0))  # journal CTA every 3rd reel
        except Exception as e:
            print("reel RENDER FAIL", key, str(e)[:80], flush=True); continue
        vu = upload_vid(out)
        if vu:
            # cover = the matching reel cover (9:16) if it exists, else none
            cov = os.path.join(D, "_reel_covers", f"cover_{key}.jpg")
            img = vu + (" " + upload_img(cov) if os.path.exists(cov) else "")
            posts.append({"image_url": img, "caption": cap_for(key), "platforms": "ig,fb",
                          "scheduled_for": utc(i + 1, 19)})
        print("reel", i, key, "ok" if vu else "UPFAIL", flush=True)

    # 4) keep today's sabr carousel (already out) — re-add at Jul 7 22:00
    #    (skip; it already fired / is queued separately)

    # 5) enqueue REPLACE
    body = {"posts": posts, "replace": True}
    with open(os.path.join(D, "_ig_package_payload.json"), "w") as f:
        json.dump(body, f)
    import requests
    r = requests.post(ENQ, headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
                      data=json.dumps(body), timeout=120)
    print("ENQUEUE", r.status_code, r.text[:200], flush=True)
    print("TOTAL posts:", len(posts), flush=True)


if __name__ == "__main__":
    main()
