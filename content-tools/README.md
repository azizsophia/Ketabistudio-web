# content-tools

Generators for the Ketabi Studio social content — the **curated checkerboard
grid**: dark filmic reminder (or reel) ↔ cream card, faceless imagery, one warm
palette. Not part of the Next.js build (plain Python, run locally). Need PIL,
numpy, playwright, imageio-ffmpeg. Fonts live in `../worker/fonts`.

- `gen_static.py <bg.jpg> "<line\\nline>" <out.jpg> ["<sub>"]` — dark filmic
  reminder still (1080×1350). Film grade + radial band scrim for legibility +
  held KETABI STUDIO footer.
- `gen_cream_card.py "<line\\nline>" <out.jpg> ["<sub>"]` — cream typographic
  card (the LIGHT grid tile). Gold frame, Playfair, domain footer.
- `gen_reel_pil.py` — **the reliable reel renderer** (browser-free). Renders the
  silent 1080x1920 reel entirely in PIL/numpy (film-graded faceless bg, ken-burns,
  3 beat-lines on a radial band scrim, held KETABI STUDIO end card) then ffmpeg,
  ~30s/reel, and uploads each to /api/social/video on finish (writes reel_manifest.txt).
  Edit its VARIANTS list. USE THIS, not the Playwright `batch_reels.py` — long
  browser renders get killed by container restarts and are ~7min/reel when the
  box is throttled. Run: `python3 gen_reel_pil.py [reel_name ...]` (no args = all,
  skips any .mp4 that already exists so it resumes safely).
- `batch_reels.py` — (legacy, browser-based; prefer gen_reel_pil.py) edit the `VARIANTS` list (name, background, 3 beat-lines,
  end sub), renders each to an <4.5 MB silent 1080×1920 mp4 via Playwright +
  ffmpeg. Same aesthetic as the stills so feed + reels are one grid.

## Grid rule (keep it curated)
Strict alternation: every post flips dark↔light. With a 3-wide grid that is
always a checkerboard. Each day = **1 reel (dark tile) + 1 cream card (light
tile)**. Never repeat a background. Faceless only — no identifiable people.

## Ship it
1. Host: reels → `POST /api/social/video` (Bearer CRON_SECRET); stills →
   `POST /api/photobook/photo`. Both return a public URL. Keep reels < 4.5 MB.
2. Queue: `POST /api/social/enqueue` (Bearer CRON_SECRET) with
   `{replace, posts:[{image_url, caption, platforms, scheduled_for}]}`. A reel
   is just an `image_url` ending in `.mp4`.
3. The daily cron (`/api/cron/social`, 16:00 UTC) ships everything due that day.

**Always QC every post/reel/card by eye before queuing** (contact sheet →
look at it) — standing owner rule.
