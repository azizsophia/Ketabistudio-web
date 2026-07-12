#!/usr/bin/env python3
"""Fresh cinematic ayah cards (blend week). 13 verses never used on week-1
cards, all sliced verbatim from the verified store; 13 brand-new photos, each
eyeball-approved (no faces, silhouettes only, no hair, no junk).
Renders via gen_ayah_wallpaper.render and writes a contact sheet."""
import json, os, re, sys, unicodedata
import gen_ayah_wallpaper as G
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
POOL = "/tmp/ayah_pool2"
OUT = "/tmp/ayah_week2"
os.makedirs(OUT, exist_ok=True)
VER = json.load(open("/tmp/verses_verified.json"))
WAQF = "ۖۗۘۙۚۛۜ۞"


def ar_words(key):
    ws = ["".join(ch for ch in w if ch not in WAQF) for w in VER[key]["ar"].split()]
    return [w for w in ws if w]


def clean_en(s):
    s = unicodedata.normalize("NFKC", s).replace("’", "'").replace("‘", "'")
    s = re.sub(r"(?<=[A-Za-z.,])\d+", "", s)
    s = re.sub(r"[.,!?;:]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def en_ok(key, text):
    en = VER[key]["en"]
    keep = clean_en(en.replace("˹", "").replace("˺", ""))
    drop = clean_en(re.sub(r"˹[^˺]*˺", "", en))
    t = clean_en(text)
    return t in keep or t in drop


# (key, ar word range [a,b] inclusive, ar display lines(split points by word count),
#  en display lines, cite, photo id)
CARDS = [
 ("3:139",  (0, 8),  [(0, 4), (5, 8)],
  ["Do not falter or grieve, for you will", "have the upper hand, if you are true believers."],
  "QUR'AN 3:139", 10665348),
 ("41:30",  (10, 15), [(10, 13), (14, 15)],
  ["Do not fear, nor grieve. Rather, rejoice", "in the good news of Paradise"],
  "QUR'AN 41:30", 10635162),
 ("64:11",  (7, 11), [(7, 11)],
  ["And whoever has faith in Allah,", "He will guide their hearts."],
  "QUR'AN 64:11", 11989045),
 ("7:56",   (9, 14), [(9, 14)],
  ["Indeed, Allah's mercy is always", "close to the good-doers."],
  "QUR'AN 7:56", 14945912),
 ("12:87",  (6, 10), [(6, 10)],
  ["And do not lose hope", "in the mercy of Allah."],
  "QUR'AN 12:87", 33702618),
 ("39:10",  (15, 20), [(15, 17), (18, 20)],
  ["Only those who endure patiently will be", "given their reward without limit."],
  "QUR'AN 39:10", 11042657),
 ("16:97",  (0, 11), [(0, 6), (7, 11)],
  ["Whoever does good, whether male or female,", "and is a believer, We will surely", "bless them with a good life."],
  "QUR'AN 16:97", 10867803),
 ("33:3",   (0, 5),  [(0, 5)],
  ["And put your trust in Allah, for Allah", "is sufficient as a Trustee of Affairs."],
  "QUR'AN 33:3", 12183790),
 ("2:153",  (3, 9),  [(3, 5), (6, 9)],
  ["Seek comfort in patience and prayer.", "Allah is truly with those who are patient."],
  "QUR'AN 2:153", 20594245),
 ("65:7",   (20, 24), [(20, 24)],
  ["After hardship, Allah will", "bring about ease."],
  "QUR'AN 65:7", 10558729),
 ("21:87",  (14, 22), [(14, 18), (19, 22)],
  ["There is no god worthy of worship except You.", "Glory be to You! I have certainly done wrong."],
  "QUR'AN 21:87", 10731789),
 ("8:46",   (8, 12), [(8, 12)],
  ["Persevere! Surely Allah is", "with those who persevere."],
  "QUR'AN 8:46", 12008337),
 ("14:7",   (3, 5),  [(3, 5)],
  ["If you are grateful,", "I will certainly give you more."],
  "QUR'AN 14:7", 18955881),
]

errs, items = [], []
for key, (a, b), ar_lines_idx, en_lines, cite, pid in CARDS:
    words = ar_words(key)
    sl = words[a:b + 1]
    full_slice = " ".join(sl)
    if full_slice not in " ".join(words):
        errs.append(f"{key}: arabic slice not contiguous?!")
    ar_lines = [" ".join(words[x:y + 1]) for x, y in ar_lines_idx]
    if " ".join(ar_lines) != full_slice:
        errs.append(f"{key}: display lines != slice")
    if not en_ok(key, " ".join(en_lines)):
        errs.append(f"{key}: EN excerpt not verbatim: {' '.join(en_lines)}")
    photo = f"c_{pid}.jpg"
    if not os.path.exists(os.path.join(POOL, photo)):
        errs.append(f"{key}: photo missing {photo}")
    items.append({"key": key.replace(":", "_"), "photo": photo,
                  "ar": ar_lines, "en": en_lines, "cite": cite, "font": "amiri"})

if errs:
    print("VERIFY FAILURES:")
    for e in errs:
        print(" -", e)
    sys.exit(1)
print(f"{len(items)} cards verified verbatim ✓")

qc_fail = []
for it in items:
    rep, ok = G.render(it, POOL, os.path.join(OUT, f"ayah_{it['key']}.jpg"))
    print(f"  {it['key']:8s} {'OK ' if ok else 'QC?'} {rep if not ok else ''}")
    if not ok:
        qc_fail.append(it["key"])

# contact sheet
files = sorted(f for f in os.listdir(OUT) if f.startswith("ayah_"))
tw, th, gap = 300, 533, 6
cols = 4
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + gap) + gap, rows * (th + gap) + gap), (247, 245, 240))
for i, f in enumerate(files):
    im = Image.open(os.path.join(OUT, f)).convert("RGB")
    im.thumbnail((tw, th))
    x = gap + (i % cols) * (tw + gap)
    y = gap + (i // cols) * (th + gap)
    sheet.paste(im, (x, y))
sheet.save(os.path.join(OUT, "week2_ayah_sheet.jpg"), quality=82)
print("sheet:", os.path.join(OUT, "week2_ayah_sheet.jpg"))
if qc_fail:
    print("QC flagged:", qc_fail)
