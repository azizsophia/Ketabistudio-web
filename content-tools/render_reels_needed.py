#!/usr/bin/env python3
# Render only the reels the alternating IG schedule needs (odd-day roots),
# skipping any already rendered. journal CTA on every other reel.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_dict_reel as REEL

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(D, "etsy"))
from journal_data import DAYS

KEYS = [d["translit"].lower().split("·")[0].strip().replace("al-", "").replace("'", "").split()[0] for d in DAYS]
ORDER = KEYS[2:] + KEYS[:2]
NEED = [ORDER[d] for d in range(30) if d % 2 == 1]   # 15 odd-day roots

outdir = os.path.join(D, "_reels_light"); os.makedirs(outdir, exist_ok=True)
for i, key in enumerate(NEED):
    out = os.path.join(outdir, f"reel_{key}.mp4")
    if os.path.exists(out):
        print("skip (have)", key, flush=True); continue
    try:
        REEL.build(key, out, journal=(i % 2 == 0))
        print("rendered", key, flush=True)
    except Exception as e:
        print("FAIL", key, str(e)[:100], flush=True)
print("DONE reels-needed", flush=True)
