#!/usr/bin/env python3
"""
Build one week of Ketabi "We The Urban" Instagram posts (1/day) and verify every
quoted verse against the verified store before anything is rendered or queued.

Usage:
  python3 build_wtu_week.py            # render PNGs + contact sheet to _wtu_week/
  python3 build_wtu_week.py --queue    # also upload each PNG and enqueue (ig,fb)

Content guardrails baked in:
  - 'verse' posts quote the Quran ONCE, verbatim, cited. Fragment is
    containment-checked against the Clear Quran (rid 131) verified store.
  - 'wall' posts tile dhikr only (our praise of Allah), never a verse.
  - 'reminder'/'ameen' use our own words / duas.
"""
import os, sys, json, re, unicodedata
import gen_wtu_post as G
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, "_wtu_week")
os.makedirs(OUT, exist_ok=True)
VER_PATH = "/tmp/verses_verified.json"

# schedule: 1/day at 11:00a Central (16:00Z), starting the given Friday.
# CDT = UTC-5. Change START_DAY when queuing a fresh week.
START = "2026-07-17"  # Fri
POST_UTC = "16:00"


def norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("˹", "").replace("˺", "").replace("’", "'").replace("‘", "'")
    s = s.replace("“", '"').replace("”", '"')
    s = re.sub(r"(?<=[a-zA-Z.,])\d+", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


# ── the week (1/day). Each: caption for IG + the render spec. ────────────
POSTS = [
 # day 1 — verse post
 {"caption": "A reminder to keep.\n\n“And He is with you wherever you are.” (Quran 57:4 · The Clear Quran)\n\nSave this for the nights the house is quiet and your thoughts are not.",
  "verify": [("57:4", "And He is with you wherever you are.")],
  "spec": {"format": "verse", "color": "aubergine", "seed": 41,
           "title": [("For the nights when the house is quiet ", False), ("and your thoughts are not.", True)],
           "size": 66, "verse_lines": ["“And He is with you", "wherever you are.”"],
           "cite": "QURAN 57:4  ·  THE CLEAR QURAN"}},
 # day 2 — dhikr wall
 {"caption": "Say it until you feel it.\n\nAlhamdulillah for it all.",
  "verify": [],
  "spec": {"format": "wall", "color": "terra", "seed": 3, "arabic": "الحمد لله",
           "rows": 12, "closing": "for it all."}},
 # day 3 — reminder (our words)
 {"caption": "Not sure who needs to hear this today.",
  "verify": [],
  "spec": {"format": "reminder", "color": "sage", "seed": 8, "size": 78,
           "title": [("Allah is ", False), ("closer", True), (" than the thing", False),
                     (" you are afraid of.", False)]}},
 # day 4 — ameen engagement (our dua)
 {"caption": "The dua you keep making in secret. Type Ameen and let’s make it together.",
  "verify": [],
  "spec": {"format": "ameen", "color": "forest", "seed": 17, "arabic": "اللهم آمين",
           "title": [("The thing you", False), (" pray for ", True), ("quietly", True),
                     (" is coming.", False)], "size": 72}},
 # day 5 — verse post
 {"caption": "For the one who thinks they’ve gone too far to come back.\n\n“As for those who repent, believe, and do good deeds, they are the ones whose evil deeds Allah will change into good deeds.” (Quran 25:70 · The Clear Quran)",
  "verify": [("25:70", "whose evil deeds Allah will change into good deeds")],
  "spec": {"format": "verse", "color": "plum", "seed": 21,
           "title": [("There is no version of you ", False), ("He cannot restore.", True)],
           "size": 70, "verse_lines": ["“…whose evil deeds Allah will", "change into good deeds.”"],
           "cite": "QURAN 25:70  ·  THE CLEAR QURAN"}},
 # day 6 — reminder / dua (our words)
 {"caption": "Send this to someone carrying something heavy.",
  "verify": [],
  "spec": {"format": "reminder", "color": "rose", "seed": 11, "size": 80,
           "title": [("May Allah ", False), ("soften", True), (" what life", False),
                     (" made you carry.", False)],
           "sub": ["Ameen."], "sub_size": 46}},
 # day 7 — dhikr wall (night)
 {"caption": "A quiet Sunday tasbih. Glory be to Him, in the good and the hard.",
  "verify": [],
  "spec": {"format": "wall", "color": "aubergine", "seed": 27, "arabic": "سبحان الله",
           "rows": 12, "closing": "in the good, and the hard.", "en_size": 54, "fade": True}},
]


def verify_all(ver):
    errs = []
    for i, p in enumerate(POSTS):
        for key, frag in p["verify"]:
            if key not in ver:
                errs.append(f"post {i+1}: {key} not in store"); continue
            if norm(frag) not in norm(ver[key]["en"]):
                errs.append(f"post {i+1}: {key} fragment not found: {norm(frag)}")
        # verse posts must carry a verify tuple AND the ON-IMAGE verse text must
        # itself be verbatim (containment) against the cited verse — a paraphrase
        # inside quote marks with a citation is misattribution.
        if p["spec"]["format"] == "verse":
            if not p["verify"]:
                errs.append(f"post {i+1}: verse format with no verification")
                continue
            key = p["verify"][0][0]
            onimg = " ".join(p["spec"]["verse_lines"])
            onimg = norm(onimg.replace("…", " ").replace('"', "").replace("“", "").replace("”", ""))
            if key in ver and onimg not in norm(ver[key]["en"]):
                errs.append(f"post {i+1}: ON-IMAGE verse not verbatim vs {key}:\n"
                            f"    image: {onimg}\n    en:    {norm(ver[key]['en'])[:150]}")
    return errs


def sched(i):
    day = int(START.split("-")[2]) + i
    return f"2026-07-{day:02d}T{POST_UTC}:00Z"


def main():
    ver = json.load(open(VER_PATH)) if os.path.exists(VER_PATH) else {}
    errs = verify_all(ver)
    if errs:
        print("VERIFY FAILURES:")
        for e in errs:
            print(" -", e)
        sys.exit(1)
    print(f"{len(POSTS)} posts — all verse fragments verified ✓")

    paths = []
    for i, p in enumerate(POSTS):
        out = os.path.join(OUT, f"wtu_day{i+1}_{p['spec']['format']}.png")
        G.render(p["spec"], out)
        paths.append(out)
        print(f"  rendered {os.path.basename(out)}  ({p['spec']['color']})")

    # contact sheet
    tw, th, gap = 360, 450, 6
    sheet = Image.new("RGB", (tw * 4 + gap * 5, th * 2 + gap * 3), (247, 245, 240))
    for i, pth in enumerate(paths):
        im = Image.open(pth).resize((tw, th), Image.LANCZOS)
        r, c = i // 4, i % 4
        sheet.paste(im, (gap + c * (tw + gap), gap + r * (th + gap)))
    sheet.save(os.path.join(OUT, "wtu_week_sheet.png"))
    print("wrote wtu_week_sheet.png")

    if "--queue" in sys.argv:
        import urllib.request
        secret = os.environ.get("CRON_SECRET", "ketabi-cron-2027")
        base = "https://www.ketabistudio.com"
        rows = []
        for i, (p, pth) in enumerate(zip(POSTS, paths)):
            with open(pth, "rb") as fh:
                body, ct = _multipart(fh.read(), os.path.basename(pth))
            req = urllib.request.Request(f"{base}/api/social/photo", data=body, method="POST",
                headers={"Content-Type": ct, "Authorization": f"Bearer {secret}"})
            url = json.load(urllib.request.urlopen(req, timeout=60))["url"]
            rows.append({"platforms": "ig,fb", "caption": p["caption"],
                         "image_url": url, "scheduled_for": sched(i)})
            print(f"  uploaded day {i+1} -> {url.split('/')[-1]}")
        req = urllib.request.Request(f"{base}/api/social/enqueue",
            data=json.dumps({"posts": rows}).encode(), method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret}"})
        print(json.load(urllib.request.urlopen(req, timeout=60)))


def _multipart(data, filename):
    boundary = "----ketabiwtu"
    pre = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
           f"filename=\"{filename}\"\r\nContent-Type: image/png\r\n\r\n").encode()
    post = f"\r\n--{boundary}--\r\n".encode()
    return pre + data + post, f"multipart/form-data; boundary={boundary}"


if __name__ == "__main__":
    main()
