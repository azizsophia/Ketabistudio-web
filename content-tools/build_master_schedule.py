#!/usr/bin/env python3
# MASTER schedule (supersedes build_ig_package). Root-of-the-day across platforms:
#   Threads : 4 cards/day  -> root 10:00, etymology 13:00, verse 19:00, prompt 22:00 UTC
#   IG/FB   : 1/day alternating -> carousel on EVEN days, reel on ODD days, 13:00 UTC
#   Today (Jul 7): only the 22:00 window remains, so post the root card + carousel.
# Uploads are cached by (path, mtime) so re-runs (e.g. after reels finish) don't
# re-upload. Reels not yet rendered are simply skipped this run and picked up on
# the next run (replace-enqueue keeps the queue a pure function of what exists).
import os, sys, json, subprocess, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_dictionary_card as G
import gen_dict_carousel as CAR
import requests

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(D, "etsy"))
from journal_data import DAYS

HOST = "https://www.ketabistudio.com"
UP = HOST + "/api/cards/photo"
VID = HOST + "/api/social/video"
ENQ = HOST + "/api/social/enqueue"
SECRET = "ketabi-cron-2027"

KEYS = [d["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0] for d in DAYS]
ORDER = KEYS[2:] + KEYS[:2]
DAY_OF = {KEYS[i]: DAYS[i] for i in range(30)}
NUM_OF = {KEYS[i]: i + 1 for i in range(30)}

CACHE_PATH = os.path.join(D, "_url_cache.json")
CACHE = json.load(open(CACHE_PATH)) if os.path.exists(CACHE_PATH) else {}


def _save_cache():
    json.dump(CACHE, open(CACHE_PATH, "w"))


def upload_img(path):
    key = f"{path}:{int(os.path.getmtime(path))}"
    if key in CACHE:
        return CACHE[key]
    with open(path, "rb") as f:
        r = requests.post(UP, files={"file": (os.path.basename(path), f, "image/jpeg")}, timeout=120)
    u = r.json().get("url")
    if u:
        CACHE[key] = u; _save_cache()
    return u


def upload_vid(path):
    key = f"{path}:{int(os.path.getmtime(path))}"
    if key in CACHE:
        return CACHE[key]
    r = subprocess.run(["curl", "-s", "-X", "POST", VID, "-H", f"Authorization: Bearer {SECRET}",
                        "-F", f"file=@{path};type=video/mp4"], capture_output=True, text=True, timeout=300)
    try:
        u = json.loads(r.stdout).get("url")
    except Exception:
        u = None
    if u:
        CACHE[key] = u; _save_cache()
    return u


def utc(d, hh):
    dt = datetime.date(2026, 7, 7) + datetime.timedelta(days=d)
    return f"{dt.isoformat()}T{hh:02d}:00:00Z"


TAGS = "#islam #quran #arabic #islamicreminders #muslim #deen #islamicquotes #muslimah #revert #arabiclanguage"


def cap_root(key):
    return f"{G.CONTENT[key][1]}\n\n{TAGS} #{key}"


def cap_etym(key):
    return f"Where the word {key} begins.\n\n{DAY_OF[key]['gloss'].capitalize()}.\n\n{TAGS} #etymology"


def cap_verse(key):
    return f"The word {key} in the Qur'an.\n\n{DAY_OF[key]['citation']}\n\n{TAGS}"


def cap_prompt(key):
    p = DAY_OF[key]['prompts'][0] if DAY_OF[key].get('prompts') else DAY_OF[key]['gloss']
    return f"{p}\n\nReply with yours.\n\n{TAGS} #reflection"


def cap_ig(key):
    return f"{G.CONTENT[key][1]}\n\n{TAGS} #{key} #islamicart"


def main():
    ex = os.path.join(D, "_threads_extra")
    cardir = os.path.join(D, "_carousels"); os.makedirs(cardir, exist_ok=True)
    reeldir = os.path.join(D, "_reels_light")

    # ---- upload the 120 Threads cards (root + 3 extras per root) ----
    print("== uploading threads cards ==", flush=True)
    THU = {}
    for key in ORDER:
        num = NUM_OF[key]
        root_p = os.path.join(D, "_dict_daily", f"day_{num:02d}_{key}.jpg")
        THU[key] = {
            "root": upload_img(root_p),
            "etym": upload_img(os.path.join(ex, f"th_{num:02d}_{key}_2etym.jpg")),
            "verse": upload_img(os.path.join(ex, f"th_{num:02d}_{key}_3verse.jpg")),
            "prompt": upload_img(os.path.join(ex, f"th_{num:02d}_{key}_4prompt.jpg")),
        }
    print("threads cards uploaded", flush=True)

    # ---- render + upload the 15 even-day carousels ----
    print("== carousels (even days) ==", flush=True)
    CARU = {}
    for d in range(0, 30, 2):
        key = ORDER[d]
        slides = CAR.carousel(key, NUM_OF[key], cardir)
        urls = [upload_img(s) for s in slides]
        CARU[key] = " ".join(urls) if all(urls) else None
        print("car", key, "ok" if CARU[key] else "FAIL", flush=True)

    # ---- upload whatever odd-day reels exist ----
    print("== reels (odd days, if rendered) ==", flush=True)
    REELU = {}
    for d in range(1, 30, 2):
        key = ORDER[d]
        mp4 = os.path.join(reeldir, f"reel_{key}.mp4")
        if not os.path.exists(mp4):
            print("reel", key, "PENDING (not rendered yet)", flush=True); continue
        vu = upload_vid(mp4)
        if vu:
            cov = os.path.join(D, "_reel_covers", f"cover_{key}.jpg")
            REELU[key] = vu + (" " + upload_img(cov) if os.path.exists(cov) else "")
            print("reel", key, "ok", flush=True)
        else:
            print("reel", key, "UPLOAD FAIL", flush=True)

    # ---- build the schedule ----
    posts = []

    def th(url, cap, d, hh):
        if url:
            posts.append({"image_url": url, "caption": cap, "platforms": "th", "scheduled_for": utc(d, hh)})

    def ig(media, cap, d, hh):
        if media:
            posts.append({"image_url": media, "caption": cap, "platforms": "ig,fb", "scheduled_for": utc(d, hh)})

    for d in range(30):
        key = ORDER[d]; c = THU[key]
        if d == 0:
            # today: only 22:00 left -> launch with the root card + the carousel
            th(c["root"], cap_root(key), 0, 22)
            ig(CARU.get(key), cap_ig(key), 0, 22)
        else:
            th(c["root"], cap_root(key), d, 10)
            th(c["etym"], cap_etym(key), d, 13)
            th(c["verse"], cap_verse(key), d, 19)
            th(c["prompt"], cap_prompt(key), d, 22)
            if d % 2 == 0:
                ig(CARU.get(key), cap_ig(key), d, 13)
            else:
                ig(REELU.get(key), cap_ig(key), d, 13)  # skipped if reel not ready

    body = {"posts": posts, "replace": True}
    json.dump(body, open(os.path.join(D, "_master_payload.json"), "w"))
    th_n = sum(1 for p in posts if p["platforms"] == "th")
    ig_n = sum(1 for p in posts if p["platforms"] == "ig,fb")
    reel_n = sum(1 for p in posts if p["platforms"] == "ig,fb" and ".mp4" in p["image_url"])
    car_n = ig_n - reel_n
    print(f"POSTS total={len(posts)} threads={th_n} ig(carousel={car_n} reel={reel_n})", flush=True)

    r = requests.post(ENQ, headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
                      data=json.dumps(body), timeout=120)
    print("ENQUEUE", r.status_code, r.text[:200], flush=True)


if __name__ == "__main__":
    main()
