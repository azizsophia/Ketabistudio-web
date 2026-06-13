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
  LULU_CLIENT_SECRET, LULU_ENV (sandbox|production), ASSETS_DIR=/data/modesty
  - Email (optional but required before public launch): RESEND_API_KEY,
    EMAIL_FROM ("Ketabi Studio <orders@ketabistudio.com>"). If unset,
    emails no-op safely.
- ASSETS_DIR must contain the Modesty PSDs (Cover.psd + Modesty_XX_colored.psd)
  and the fonts/ directory. Download once at boot from the book-assets bucket
  (psd pack zip) or bake into the image.
- Start: `python worker.py`

Sandbox first. Production keys only after the physical proof passes inspection.

## Story text rendering (her-beautiful-hijab)

The personalized book draws text onto text-free art bases stored in
`book-assets/bases/`. Text is composited at generation time, NOT baked
into the art. Two files own this:

- `pipeline/modesty_pipeline.py`
  - `STORY` (dict, pages 1–25): the UPDATED story copy. `(Child's Name)`
    is the substitution token. `\r` = hard line break. Page 25 is the
    closing "From that day on… modesty… carrying a piece of heaven" text.
  - `ACCENTS` (dict): the 1–2 bold accent words/phrases per page. Keep it
    restrained — these render in the bold accent font.
  - `ACCENT_COLORS` (dict): the DELIBERATE distinct accent color per page
    (RGB). Each page is a different hue chosen to suit that page's art.
    To recolor a page's accent, edit this one number. (An older
    `sample_accent_color()` auto-picker still exists but is unused — the
    fixed map gives reliable variety since most pages share a warm palette
    that the sampler kept collapsing to orange.)
  - `BODY_TEXT` = dark navy (#403d4f), body color for every page.
  - `ACCENT_FONT` = "Bjola" (bold round). Body font = Crocodile Feet.
  - `render_text_on_image()`: per-run fonts+colors, char-stream word-wrap
    to the bbox, punctuation hugs its word. Design = the original book's
    look: navy body + bold colored accents sitting directly on the art,
    NO panel/box. A faint feathered WHITE glow follows the letters (low
    opacity, gaussian-blurred) purely so navy text stays legible where it
    crosses a darker part of an illustration — it is invisible on light
    areas. Tune via the `glow` block (stroke width / opacity / blur).
- `pipeline/text_layout.json`: per-page text bbox + font size +
  justification. Move a page's text by editing its `bbox`. If a page's
  text overlaps a busy/dark zone, prefer nudging the bbox to a calm area
  over increasing the glow.
- `pipeline/generate_from_bases.py` `generate_page_from_base()`: ties it
  together — substitutes the name, looks up the per-page accent color,
  builds accent runs (`build_accent_runs`, bold font for accents), renders.

Page mapping: physical 32pp = 3 front matter + page_01..page_25 (story,
physical pages 4–28) + 4 back matter. Story page 25 = physical page 28.

When changing accent words/colors, regenerate a test order and eyeball
the full PDF — the bases share palettes, so verify colors actually differ
and that text is legible on each page's specific background.
