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
- `batch_reels.py` — edit the `VARIANTS` list (name, background, 3 beat-lines,
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
