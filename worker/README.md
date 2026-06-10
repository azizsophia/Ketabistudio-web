# Ketabi Order Worker

Polls Supabase for orders, generates books with the validated pipeline,
runs 4 automated QC gates, and holds every order for owner approval
before anything reaches Lulu.

## Status flow
pending → generating → qc_passed → validated → awaiting_approval
→ approved → submitted → printing → shipped | failed | rejected

## QC gates (all must pass)
1. Guards — name validation + placeholder scan
2. Spec — 32 pages, 8.75" trim, 17.39×8.75 cover, blank-page scan (all pages)
3. Reference — pages 7/11/20 pixel-diffed vs certified renders for the exact
   skin/hair/style combo (threshold mean 8/255; certified baseline 0.004)
4. Lulu validator — interior + cover must return zero errors

Then the human gate: `orders/{id}/digest.jpg` (cover, name crops, QC pages)
is written to the orders bucket; approve via the website API:
`/api/approve?order={id}&token={approval_token}&action=approve|reject`

## Deploy (Render/Railway)
- Python 3.11+, system dep: poppler-utils (pdftoppm)
- Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, LULU_CLIENT_KEY,
  LULU_CLIENT_SECRET, LULU_ENV=sandbox, ASSETS_DIR=/data/modesty
- ASSETS_DIR must contain the Modesty PSDs (Cover.psd + Modesty_XX_colored.psd)
  and the fonts/ directory. Download once at boot from the book-assets bucket
  (psd pack zip) or bake into the image.
- Start: `python worker.py`

Sandbox first. Production keys only after the physical proof passes inspection.
