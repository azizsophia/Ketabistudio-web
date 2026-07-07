#!/usr/bin/env python3
# Screenshot the live Ketabi site (with the preview cookie so the coming-soon
# gate is bypassed) so recommendations are grounded in the real thing.
import os
from playwright.sync_api import sync_playwright

OUT = "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad/site_shots"
os.makedirs(OUT, exist_ok=True)
BASE = "https://www.ketabistudio.com"
PAGES = [
    ("home", "/"),
    ("shop", "/shop"),
    ("storybooks", "/shop/storybooks"),
    ("keepsakes", "/shop/keepsakes"),
    ("book_hijab", "/books/her-beautiful-hijab"),
    ("cards", "/cards"),
    ("digital_cards", "/digital-cards"),
]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
    pg = ctx.new_page()
    # set the preview cookie via the query param, then navigate around
    pg.goto(f"{BASE}/?preview=ketabi-preview-2026", wait_until="networkidle")
    for name, path in PAGES:
        try:
            pg.goto(f"{BASE}{path}", wait_until="networkidle", timeout=45000)
            pg.wait_for_timeout(1200)
            pg.screenshot(path=os.path.join(OUT, f"{name}.png"), full_page=True)
            print("shot", name)
        except Exception as e:
            print("FAIL", name, str(e)[:120])
    b.close()
print("done ->", OUT)
