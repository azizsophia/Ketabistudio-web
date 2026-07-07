#!/usr/bin/env python3
# After build_ig_package.py finishes, shift IG/FB CAROUSELS back one day so the
# first carousel lands TODAY (Jul 7). Reels + Threads unchanged. Re-enqueue
# (replace) from the already-uploaded payload — no re-render.
import os, json, datetime, requests

D = os.path.dirname(os.path.abspath(__file__))
ENQ = "https://www.ketabistudio.com/api/social/enqueue"
SECRET = "ketabi-cron-2027"

with open(os.path.join(D, "_ig_package_payload.json")) as f:
    body = json.load(f)

def shift_back_one_day(iso):
    # iso like 2026-07-08T13:00:00Z -> 2026-07-07T13:00:00Z
    date_part, time_part = iso.split("T")
    d = datetime.date.fromisoformat(date_part) - datetime.timedelta(days=1)
    return f"{d.isoformat()}T{time_part}"

carousels = reels = threads = 0
for p in body["posts"]:
    plats = p.get("platforms", "")
    img = p.get("image_url", "")
    if plats == "th":
        threads += 1
    elif ".mp4" in img:
        reels += 1
    else:  # ig,fb carousel (4 space-joined jpg urls, no mp4)
        p["scheduled_for"] = shift_back_one_day(p["scheduled_for"])
        carousels += 1

body["replace"] = True
print(f"threads={threads} carousels(shifted)={carousels} reels={reels} total={len(body['posts'])}")
# show the first carousel's new date to confirm it's today
firstcar = next(p for p in body["posts"] if p["platforms"] != "th" and ".mp4" not in p["image_url"])
print("first carousel now:", firstcar["scheduled_for"])

r = requests.post(ENQ, headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
                  data=json.dumps(body), timeout=120)
print("ENQUEUE", r.status_code, r.text[:200])
