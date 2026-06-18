#!/usr/bin/env python3
"""Generate lib/keepsakeDuas.json — the single source of truth for the keepsake
dua pages, shared by the print pipeline (Python) and the site (TS imports JSON).

The Arabic is sliced BY WORD INDEX from an authoritative Qur'an dataset on
GitHub (Tanzil uthmani via risan/quran-json) — never hand-typed — so it is
correct by construction. The slice points were verified against the project's
already-trusted 17:24. Re-run after changing any verse:

    python3 worker/build_keepsake_duas.py
"""
import json
import urllib.request
from pathlib import Path

RAW = "https://raw.githubusercontent.com/risan/quran-json/main/dist/chapters/{}.json"


def chapter(ch):
    with urllib.request.urlopen(RAW.format(ch), timeout=60) as r:
        d = json.load(r)
    return {v["id"]: v["text"] for v in d["verses"]}


def dua_words(ch, n, start, end):
    """The dua portion of verse ch:n = words[start:end] (end exclusive)."""
    return " ".join(chapter(ch)[n].split()[start:end])


# Verse + word-slice (verified against indexed output) + English/translit/label.
PARENTS = {
    "arabic": dua_words(17, 24, 7, 12),
    "translit": "Rabbi-rḥamhumā kamā rabbayānī ṣaghīrā",
    "english": "My Lord, have mercy upon them as they raised me when I was small.",
    "ref": "Qur'an 17:24",
}
SPOUSE = {
    "arabic": dua_words(25, 74, 2, 13),
    "translit": ("Rabbanā hab lanā min azwājinā wa dhurriyyātinā qurrata "
                 "aʿyunin wa-jʿalnā lil-muttaqīna imāmā"),
    "english": ("Our Lord, grant us from our spouses and children comfort to "
                "our eyes, and make us a model for the righteous."),
    "ref": "Qur'an 25:74",
}
BABY = {
    "arabic": dua_words(3, 38, 5, 15),
    "translit": "Rabbi hab lī min ladunka dhurriyyatan ṭayyibah, innaka samīʿu d-duʿāʾ",
    "english": ("My Lord, grant me from Yourself good offspring. Indeed, You "
                "hear all prayers."),
    "ref": "Qur'an 3:38",
}
FAMILY = {
    "arabic": dua_words(2, 201, 3, 14),
    "translit": ("Rabbanā ātinā fi d-dunyā ḥasanah, wa fi l-ākhirati ḥasanah, "
                 "wa qinā ʿadhāba n-nār"),
    "english": ("Our Lord, give us good in this world and good in the "
                "Hereafter, and protect us from the punishment of the Fire."),
    "ref": "Qur'an 2:201",
}


def withlabel(base, label):
    return {**base, "label": label}


DUAS = {
    "about-mama": withlabel(PARENTS, "A dua for the ones who raised me"),
    "about-baba": withlabel(PARENTS, "A dua for the ones who raised me"),
    "about-grandma": withlabel(PARENTS, "A dua for the ones who raised us"),
    "about-grandpa": withlabel(PARENTS, "A dua for the ones who raised us"),
    "about-spouse": withlabel(SPOUSE, "A dua for our life together"),
    "about-baby": withlabel(BABY, "A dua for this little one"),
    "our-ramadan": withlabel(FAMILY, "A dua for our family"),
}

if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    payload = json.dumps(DUAS, ensure_ascii=False, indent=2) + "\n"
    # Two committed copies so each runtime reads a LOCAL file:
    #   lib/keepsakeDuas.json            -> imported by the Next.js app (TS)
    #   worker/pipeline/keepsake_duas.json -> read by the print pipeline
    for out in (root / "lib" / "keepsakeDuas.json",
                root / "worker" / "pipeline" / "keepsake_duas.json"):
        out.write_text(payload, encoding="utf-8")
        print(f"wrote {out}")
    for k, v in DUAS.items():
        print(f"  {k}: {v['ref']}  {v['arabic']}")
