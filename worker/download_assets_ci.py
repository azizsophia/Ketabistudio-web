#!/usr/bin/env python3
"""Robust Google Drive large-file downloader (handles the virus-scan
interstitial that breaks naive downloads). Verified against the Modesty pack."""
import re
import sys

import requests

FID = sys.argv[1]
OUT = sys.argv[2]

s = requests.Session()
r = s.get(f"https://drive.google.com/uc?export=download&id={FID}",
          stream=True, timeout=120)

if "text/html" in r.headers.get("content-type", ""):
    html = r.text
    action = re.search(
        r'action="(https://drive\.usercontent\.google\.com/download)"', html)
    fields = dict(re.findall(r'name="([^"]+)" value="([^"]*)"', html))
    if not action or not fields:
        sys.exit("could not parse Drive interstitial; is the file public?")
    r = s.get(action.group(1), params=fields, stream=True, timeout=120)

ct = r.headers.get("content-type", "")
if "text/html" in ct:
    sys.exit(f"Drive returned HTML again ({ct}); link not public?")

total = 0
with open(OUT, "wb") as f:
    for chunk in r.iter_content(1024 * 1024 * 8):
        f.write(chunk)
        total += len(chunk)
        if total % (512 * 1024 * 1024) < 8 * 1024 * 1024:
            print(f"  {total/1e9:.1f} GB...", flush=True)
print(f"downloaded {total/1e9:.2f} GB to {OUT}")
with open(OUT, "rb") as f:
    magic = f.read(2)
if magic != b"PK":
    sys.exit("downloaded file is not a zip!")
print("zip magic verified (PK)")
