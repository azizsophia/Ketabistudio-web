#!/usr/bin/env python3
"""
Build the "Say this dua when you feel ___" reel series (silent, off-grid).

Every dua is a VERIFIED Qur'anic dua: the Arabic and English are sliced straight
from the verified store (never retyped), and asserted to be substrings of the
stored verse. Transliteration is helper text (not sacred). ˹˺ marks stripped for
display only; all words kept.

Usage:
  python3 build_dua_reels.py            # render mp4s + poster frames to _dua_reels/
  python3 build_dua_reels.py --queue    # upload each mp4 + enqueue (ig,fb, off-grid)
"""
import os, sys, json, re, unicodedata, tempfile, shutil
import gen_dua_reel as R

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, "_dua_reels")
os.makedirs(OUT, exist_ok=True)
VER = json.load(open("/tmp/verses_verified.json"))


WAQF = "ۖۗۘۙۚۛۜ۞"


def strip_marks(s):
    return s.replace("˹", "").replace("˺", "")


def ar_words(key):
    """store Arabic split into words, waqf tokens removed (never retyped)."""
    toks = VER[key]["ar"].split()
    out = []
    for t in toks:
        for w in WAQF:
            t = t.replace(w, "")
        if t.strip():
            out.append(t.strip())
    return out


def en_dua(key):
    """the quoted dua portion of the English translation, marks stripped.
    The dua is the LAST quoted segment (some verses quote a warning first, then
    the supplication — e.g. 3:173). If the last quote is open-ended (verse
    continues into the next ayah, e.g. 20:25), take from the last “ to the end."""
    s = VER[key]["en"]
    segs = re.findall(r"“([^”]*)”", s)
    if segs:
        out = segs[-1]
    elif "“" in s:
        out = s[s.index("“") + 1:]
    else:
        out = s  # continuation verse with no quote marks (e.g. 20:26)
    out = re.sub(r"(?<=[a-zA-Z.,])\d+", "", out)
    return strip_marks(out).strip()


# feeling -> dua. ar_from = word index in the store text where the DUA begins
# (dropping the narrative lead-in like "Moses prayed"); join = second verse to
# append in full. Nothing Arabic is retyped — we slice the store's own words.
DUAS = [
 {"feeling": "anxious", "key": "3:173", "ar_from": -4, "color": (120, 142, 168), "dark": True, "seed": 55,
  "translit": "Hasbunallahu wa ni'mal-wakeel", "cite": "QURAN 3:173  ·  THE CLEAR QURAN"},
 {"feeling": "alone in it", "key": "21:87", "ar_from": 14, "color": (58, 46, 64), "dark": False, "seed": 12,
  "translit": "La ilaha illa anta, subhanaka inni kuntu mina-dhalimin",
  "cite": "QURAN 21:87  ·  THE CLEAR QURAN"},
 {"feeling": "overwhelmed", "key": "20:25", "ar_from": 1, "join": "20:26",
  "color": (150, 168, 148), "dark": True, "seed": 8,
  "translit": "Rabbi-shrah li sadri wa yassir li amri", "cite": "QURAN 20:25-26  ·  THE CLEAR QURAN"},
 {"feeling": "like you failed", "key": "7:23", "ar_from": 1, "color": (110, 74, 96), "dark": False, "seed": 21,
  "translit": "Rabbana zalamna anfusana wa in lam taghfir lana", "cite": "QURAN 7:23  ·  THE CLEAR QURAN"},
 {"feeling": "in need", "key": "28:24", "ar_from": 7, "color": (196, 158, 78), "dark": True, "seed": 5,
  "translit": "Rabbi inni lima anzalta ilayya min khayrin faqir",
  "cite": "QURAN 28:24  ·  THE CLEAR QURAN"},
 {"feeling": "your faith shake", "key": "3:8", "ar_from": 0, "color": (52, 82, 66), "dark": False, "seed": 17,
  "translit": "Rabbana la tuzigh qulubana ba'da idh hadaytana",
  "cite": "QURAN 3:8  ·  THE CLEAR QURAN"},
]


def build_one(spec):
    key = spec["key"]
    words = ar_words(key)
    frm = spec["ar_from"]
    arabic = " ".join(words[frm:])
    english = en_dua(key)
    if spec.get("join"):
        arabic = arabic + " " + " ".join(ar_words(spec["join"]))
        english = (english + " " + en_dua(spec["join"])).strip()
    # sanity: the sliced Arabic words must all be present in the store verse
    store_ar = VER[key]["ar"]
    for w in words[frm:]:
        assert w in store_ar, f"{key}: sliced word not in store"
    return arabic, spec["translit"], english, spec["cite"]


def render_all():
    metas = []
    for spec in DUAS:
        arabic, translit, english, cite = build_one(spec)
        base, dark, seed = spec["color"], spec["dark"], spec["seed"]
        f1 = R.frame_hook(base, seed, dark, spec["feeling"])
        f2 = R.frame_dua(base, seed, dark, arabic, translit, english, cite)
        f3 = R.frame_end(base, seed, dark)
        slug = spec["feeling"].replace(" ", "_")
        mp4 = os.path.join(OUT, f"dua_{slug}.mp4")
        cover = os.path.join(OUT, f"dua_{slug}_cover.png")
        f1.save(cover)
        with tempfile.TemporaryDirectory() as td:
            R.compose([(f1, 3.4), (f2, 9.0), (f3, 3.2)], mp4, td)
        sz = os.path.getsize(mp4) / 1e6
        print(f"  {slug:16s} {sz:5.1f}MB  {spec['key']}  ✓verbatim")
        metas.append({"feeling": spec["feeling"], "key": spec["key"], "mp4": mp4, "cover": cover,
                      "caption": (f"Say this dua when you feel {spec['feeling']}.\n\n"
                                  f"{translit}\n“{english}” ({spec['cite'].replace('  ·  ', ' · ').title().replace('Quran','Quran')})\n\n"
                                  f"Save it for when you need it. 30 duas like this in our journal, ketabistudio.etsy.com")})
    return metas


def main():
    print(f"Building {len(DUAS)} verified dua reels...")
    metas = render_all()
    json.dump([{k: v for k, v in m.items() if k != "mp4"} for m in metas],
              open(os.path.join(OUT, "index.json"), "w"), ensure_ascii=False, indent=1)
    print(f"done → {OUT}")

    if "--queue" in sys.argv:
        import urllib.request
        secret = os.environ.get("CRON_SECRET", "ketabi-cron-2027")
        base = "https://www.ketabistudio.com"
        # 1 fires now; rest 2/day from Jul 24 (after current ayah reels end Jul 23)
        now = "2026-07-11T12:37:00Z"
        slots = [now, "2026-07-24T15:00:00Z", "2026-07-24T20:00:00Z",
                 "2026-07-25T15:00:00Z", "2026-07-25T20:00:00Z", "2026-07-26T15:00:00Z"]
        rows = []
        for m, when in zip(metas, slots):
            with open(m["mp4"], "rb") as fh:
                vb, ct = _multipart(fh.read(), os.path.basename(m["mp4"]), "video/mp4")
            req = urllib.request.Request(f"{base}/api/social/video", data=vb, method="POST",
                headers={"Content-Type": ct, "Authorization": f"Bearer {secret}"})
            vurl = json.load(urllib.request.urlopen(req, timeout=180))["url"]
            with open(m["cover"], "rb") as fh:
                cb, ct2 = _multipart(fh.read(), os.path.basename(m["cover"]), "image/png")
            req = urllib.request.Request(f"{base}/api/social/photo", data=cb, method="POST",
                headers={"Content-Type": ct2, "Authorization": f"Bearer {secret}"})
            curl_ = json.load(urllib.request.urlopen(req, timeout=90))["url"]
            rows.append({"platforms": "ig,fb", "caption": m["caption"],
                         "image_url": f"{vurl} {curl_}", "scheduled_for": when})
            print(f"  uploaded {m['feeling']} -> reel + cover")
        req = urllib.request.Request(f"{base}/api/social/enqueue",
            data=json.dumps({"posts": rows}).encode(), method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret}"})
        print(json.load(urllib.request.urlopen(req, timeout=60)))


def _multipart(data, filename, mime):
    b = "----ketabidua"
    pre = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; "
           f"filename=\"{filename}\"\r\nContent-Type: {mime}\r\n\r\n").encode()
    return pre + data + f"\r\n--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"


if __name__ == "__main__":
    main()
