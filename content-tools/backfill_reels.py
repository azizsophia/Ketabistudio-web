#!/usr/bin/env python3
# Append-only backfill of the odd-day reels that were not yet rendered when the
# master schedule ran. Reads _master_payload.json to see which reel days already
# exist, uploads + appends ONLY the missing ones (replace=false), so today's
# already-published posts and the rest of the queue are untouched.
import os, sys, json, subprocess, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_dictionary_card as G
import requests

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(D, "etsy"))
from journal_data import DAYS

HOST = "https://www.ketabistudio.com"
UP = HOST + "/api/cards/photo"; VID = HOST + "/api/social/video"; ENQ = HOST + "/api/social/enqueue"
SECRET = "ketabi-cron-2027"

KEYS = [d["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0] for d in DAYS]
ORDER = KEYS[2:] + KEYS[:2]
CACHE_PATH = os.path.join(D, "_url_cache.json")
CACHE = json.load(open(CACHE_PATH)) if os.path.exists(CACHE_PATH) else {}
TAGS = "#islam #quran #arabic #islamicreminders #muslim #deen #islamicquotes #muslimah #revert #arabiclanguage"


def utc(d, hh):
    dt = datetime.date(2026, 7, 7) + datetime.timedelta(days=d)
    return f"{dt.isoformat()}T{hh:02d}:00:00Z"


def upload_img(path):
    k = f"{path}:{int(os.path.getmtime(path))}"
    if k in CACHE: return CACHE[k]
    with open(path, "rb") as f:
        u = requests.post(UP, files={"file": (os.path.basename(path), f, "image/jpeg")}, timeout=120).json().get("url")
    if u: CACHE[k] = u; json.dump(CACHE, open(CACHE_PATH, "w"))
    return u


def upload_vid(path):
    k = f"{path}:{int(os.path.getmtime(path))}"
    if k in CACHE: return CACHE[k]
    r = subprocess.run(["curl", "-s", "-X", "POST", VID, "-H", f"Authorization: Bearer {SECRET}",
                        "-F", f"file=@{path};type=video/mp4"], capture_output=True, text=True, timeout=300)
    try: u = json.loads(r.stdout).get("url")
    except Exception: u = None
    if u: CACHE[k] = u; json.dump(CACHE, open(CACHE_PATH, "w"))
    return u


def cap_ig(key):
    return f"{G.CONTENT[key][1]}\n\n{TAGS} #{key} #islamicart"


def main():
    payload = json.load(open(os.path.join(D, "_master_payload.json")))
    have = {p["scheduled_for"] for p in payload["posts"]
            if p["platforms"] == "ig,fb" and ".mp4" in p["image_url"]}
    reeldir = os.path.join(D, "_reels_light")
    new = []
    for d in range(1, 30, 2):
        key = ORDER[d]; sched = utc(d, 13)
        if sched in have:
            print("skip (already queued)", key, flush=True); continue
        mp4 = os.path.join(reeldir, f"reel_{key}.mp4")
        if not os.path.exists(mp4):
            print("MISSING still", key, flush=True); continue
        vu = upload_vid(mp4)
        if not vu:
            print("upload fail", key, flush=True); continue
        cov = os.path.join(D, "_reel_covers", f"cover_{key}.jpg")
        media = vu + (" " + upload_img(cov) if os.path.exists(cov) else "")
        new.append({"image_url": media, "caption": cap_ig(key), "platforms": "ig,fb", "scheduled_for": sched})
        print("queued reel", key, sched, flush=True)
    if not new:
        print("nothing to backfill", flush=True); return
    r = requests.post(ENQ, headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
                      data=json.dumps({"posts": new, "replace": False}), timeout=120)
    print("APPEND", r.status_code, r.text[:150], "count", len(new), flush=True)


if __name__ == "__main__":
    main()
