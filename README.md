# Ketabi Studio — ketabistudio.com

Print-on-demand Islamic children's books with personalization. A customer
picks a book, optionally personalizes it (child's name + character look),
and places an order. The system generates print-ready PDFs, runs quality
control, validates with the printer, and holds every order for **manual
admin approval** before anything is printed.

**Owner:** Khaled (Ketabi Studio). Phone-first workflows throughout.

---

## Architecture

```
Customer (ketabistudio-web.vercel.app)
   │  POST /api/orders            ← Next.js 15 site, deployed on Vercel
   ▼
Supabase (project hkhitigwbzafzwwlhijg)
   ├─ Postgres: orders, order_events tables
   └─ Storage:  book-assets bucket (art bases, premade PDFs)
                orders bucket (generated PDFs + digest per order)
   ▲
   │  polls every 30s for status='pending' and status='approved'
   ▼
Worker (Render.com background worker, Python, worker/ directory)
   ├─ generates personalized PDFs from art bases (no PSDs at runtime)
   ├─ QC: page count, page size, blank scan, reference fingerprints
   ├─ validates interior+cover with Lulu (normalization check)
   ├─ sets status='awaiting_approval'
   └─ after admin approves → submits print job to Lulu
   ▼
Lulu (print + worldwide shipping)
```

### Order lifecycle (status column)

```
pending → generating → qc_passed → validated → awaiting_approval
                                                    │
                              admin taps Approve ───┤── admin taps Reject
                                                    ▼            ▼
                                               approved      rejected
                                                    ▼
                                               submitted (Lulu print job)
any step can fail → status='failed' (failure detail in qc_report.failure)
```

**Every order — personalized or fixed — stops at `awaiting_approval`.
Nothing prints without a human tapping Approve in /admin.**

---

## The three books

| Slug | Type | Source |
|---|---|---|
| `her-beautiful-hijab` | Personalized (name + 48 looks) | Generated from art bases |
| `juha-and-the-enormous-pumpkin` | Fixed | Premade PDFs in book-assets: `juha/` |
| `maryam-is-kind-to-her-parents` | Fixed | Premade PDFs in book-assets: `maryam/` |

Personalization axes for the hijab book: skin (light/medium/dark) ×
hair (black/brown/blonde/red) × style (long-straight/long-curly/
short-straight/short-curly) = 48 looks. The child's name (≤14 chars)
is rendered on the cover, title page, dedication, bookplate, and inside
the story text on many pages.

The only author credit anywhere on the book is **"by Ketabi Studio"**.

---

## Repository map

```
app/
  page.tsx                 Home (shelf marketing page)
  books/[slug]/page.tsx    Book detail + order flow
  admin/page.tsx           Admin dashboard (order review/approve)
  api/orders/route.ts      Customer order creation (validation + insert)
  api/admin/orders/        List orders (x-admin-key header auth)
  api/admin/pdf/           Signed URLs for interior/cover/digest
  api/admin/action/        Approve / reject
components/
  OrderSection.tsx         Personalizer + shipping + confirmation
  BookPreview.tsx          Live page-turn preview (cover, p12, p23)
lib/books.ts               Book catalog (titles, copy, image paths)
public/images/
  hero-{skin}-{hair}-{style}.jpg   48 clean cover fronts for live preview
  preview-p12-{skin}.jpg, preview-p23-{skin}.jpg   story-page previews
  book-amira.jpg           Marketing cover ("Child's Name" title)
public/fonts/              bjola.otf, crocodile-feet.otf (print fonts as webfonts)
worker/
  worker.py                Render worker entrypoint (poll loop)
  render_bases_ci.py       CI script: renders art bases from PSDs
  text_layout.json         Per-page text bbox/font from the original PSDs
  fonts/                   Bjola, Crocodile Feet, Amiri
  pipeline/
    modesty_pipeline.py    PSD pipeline: variants, text, cover, QC helpers
    generate_from_bases.py PSD-free production path (bases → book)
    lulu_client.py         Lulu API client (auth, validation, print jobs)
    title_page.py, matter_pages.py   Front/back matter generation
.github/workflows/render-bases.yml   Manual CI to (re)render art bases
```

---

## Environment variables

| Where | Variable | Purpose |
|---|---|---|
| Vercel | `SUPABASE_URL` | `https://hkhitigwbzafzwwlhijg.supabase.co` |
| Vercel | `SUPABASE_SERVICE_KEY` | Supabase service-role JWT |
| Vercel | `ADMIN_KEY` | Password for /admin (sent as `x-admin-key`) |
| Render | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | same |
| Render | `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET` | Lulu API credentials |
| Render | `LULU_ENV` | `sandbox` or `production` |
| Render | `POLL_SECONDS` | poll interval (default 30) |
| GitHub secrets | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | used by render-bases CI |

Secrets live only in those dashboards — never commit them.
The Render worker needs the **Standard (2GB)** instance; the 512MB tier
OOMs during image recoloring.

---

## Art bases (how personalization works without PSDs)

The source PSDs (25 story pages + cover, with layered character
variants) are too heavy to open per-order. Instead, a one-time CI job
(`render-bases.yml`, manual trigger) opens each PSD, toggles the
character layers per look, hides ALL text layers, and uploads flat
JPEG "bases" to Supabase `book-assets/bases/`:

```
cover__{skin}-{hair}-{style}.jpg      48 variants
page01..page11__{skin}-{hair}-{style}.jpg   48 variants each (full character)
page12..page25__{skin}.jpg            3 variants each (hijab covers hair)
page17.jpg                            1 (side character only)
```

At order time the worker fetches the right bases and adds only text
(story text with the child's name, cover title, matter pages) using
the same fonts/coordinates as the PSDs (`text_layout.json`).

### Re-rendering bases

GitHub → Actions → "Render Art Bases" → Run workflow → enter a range
(`1-3`, `4-6`, `7-9`, `10-11`, `12-25`, or `cover`). The job downloads
the PSD pack from Google Drive (gdown id in the workflow), renders,
and uploads. **It skips bases that already exist in the bucket**, so to
force a re-render you must first delete the stale objects from
`book-assets/bases/`.

---

## Quality control (worker)

1. **Spec**: interior page count (32), page size 8.75"×8.75", cover wrap
   size, blank-page scan.
2. **Reference fingerprints**: pages 11 and 20 are compared against
   stored perceptual fingerprints; a wrong/garbled page fails QC
   (match distance must be far below the wrong-page distance).
3. **Character presence guard**: the cover generator verifies the
   girl's green book is present on the cover base and aborts if not
   (protects against bad bases — see incident log below).
4. **Placeholder guard**: any surviving `(Child's Name)`-style token
   anywhere in rendered text raises and blocks the order.
5. **Lulu validation**: interior and cover are submitted to Lulu's
   validation endpoint; both must come back NORMALIZED.
6. A **digest JPEG** (cover + sample pages contact sheet) is uploaded
   per order for one-glance review in /admin.

---

## Admin (/admin)

Password-gated (ADMIN_KEY). Orders grouped by status; for
`awaiting_approval` orders you see the QC report, the digest image,
and buttons to open the actual interior/cover PDFs (signed URLs,
1-hour expiry). Approve moves the order to `approved` (worker then
submits to Lulu); Reject moves to `rejected`. Designed phone-first.

## Common operations

**Re-run a failed/stale order** — set it back to pending:
```
PATCH {SUPABASE_URL}/rest/v1/orders?id=eq.{ORDER_ID}
  {"status":"pending","interior_path":null,"cover_path":null,"qc_report":null}
```
(with service-role auth headers). The worker picks it up within 30s.

**Check worker health**: Render dashboard → ketabi-order-worker → Logs.

**Payment**: not yet integrated. Current plan at launch volume: approve
the order in /admin, send the customer a Stripe Payment Link manually,
submit to print after payment. Automated Stripe Checkout is the next
build step.

---

## Changelog

### 2026-06-24 — Removed Hifz and Rugs product lines

Both were dropped as product directions. Fully removed from the codebase:
- **Hifz** (Quran-memorization subscription): `app/hifz/*`, `app/api/hifz/*`,
  `lib/hifz/*`, `lib/quran.ts`, the Supabase auth client (`lib/supabase/*`,
  `app/auth/*` — only the hifz login used it), the `HIFZ_*` price constants in
  `lib/pricing.ts`, and the subscription branch of the Stripe webhook
  (`app/api/stripe-webhook/route.ts` is now book/card one-time orders only).
- **Rugs** (Hopscotch Rug): `app/rugs/*`, `components/RugStudio.*`,
  `components/HopscotchRug.tsx`, and the now-unused Fredoka font in `layout.tsx`.

Neither was linked from navigation, so storefront IA is unchanged. The "Reflect"
world on the homepage still points at the **mobile app** (`/app`), and all
Quran/film brand copy is untouched (it refers to the app + short films, not the
removed web subscription). Build + typecheck clean after removal.

### 2026-06-24 — Storybook pricing ($24.99, softcover-only)

The two non-personalized storybooks (**Juha and the Enormous Pumpkin**,
**Maryam is Kind to Her Parents**) now have their own price, separate from the
$34.99 personalized tier. Added a slug-aware `bookPriceCents(coverType, slug)`
plus `bookPriceDisplay(slug)` and a `SOFTCOVER_PRICE_OVERRIDES` map in
`lib/pricing.ts`; checkout and the book detail page pass the slug.

- **$24.99 softcover** (gated behind `TEST_DOLLAR_PRICING`; $1 in test).
  Live cost is $15.47 delivered US ($9.03 print + $0.75 fulfillment + $5.69
  MAIL — matched exactly by a real Lulu test print), so profit ≈ $8.50 US /
  ~$16 intl.
- **Softcover-only — confirmed against Lulu specs.** These titles are flattened
  pre-made cover PDFs sized for the perfect-bound wrap (Lulu requires
  **1252×630pt** at 32pp). A casewrap hardcover needs a different, larger cover
  (**1368×738pt**, confirmed live) that doesn't exist for them, so hardcover is
  intentionally not offered (they remain absent from `HARDCOVER_SLUGS`, and the
  worker force-downgrades any stray hardcover value).

### 2026-06-24 — Hijab book copy polish; Lulu shipping audit (Gulf gated)

**Beautiful Hijab book** copy cleaned: removed the two em dashes (page 18 story
line restructured; storefront blurb) since em dashes read as AI-written, and
standardised "du'a" → "dua" on page 24 (`worker/pipeline/modesty_pipeline.py`,
`lib/books.ts`). Story + matter pages confirmed otherwise dash-clean.

**Live Lulu cost audit (production keys).** Print cost for the 8.5×8.5in 32pp
title is **$9.03 softcover / $17.85 hardcover** worldwide. Profit per book:
softcover ≈ **$19 US / $26 intl**, hardcover ≈ **$25 US / $32 intl** (US ships
free/baked-in; intl passes Lulu shipping through + $1.50). Healthy 50–60%
margins on a zero-inventory POD product.

**Gulf shipping gap fixed.** Lulu only offers EXPRESS (~$56) to **AE, KW, QA,
OM, JO** and **no service** to **BH** — the storefront offered all of them while
the worker only quotes cheap MAIL, so those orders would fail or lose ~$15–40.
Removed those 6 from all three Lulu book flows (storybooks, photo-book
keepsakes, I-Am) in both the API `VALID_COUNTRIES` guards and the builder
dropdowns. **Saudi (SA) kept** — it ships fine on MAIL (~$17). Greeting cards
are unaffected (they print via Prodigi/Cloudprinter, not Lulu).

### 2026-06-24 — Keepsake photo-books audit; duas parked; I-Am storefront covers

Pre-launch QA pass on the **keepsake photo-books** (`lib/photobook.ts`,
`worker/pipeline/photobook_pipeline.py`) plus two storefront/gating changes.

**Keepsakes — production-readiness audit (all 7 titles).** 8.5×8.5in,
24-page hardcover casewrap, every interior page a customer photo.
- **Lulu hardcover POD confirmed** (sandbox): `0850X0850.FC.PRE.CW.080CW444.MXX`
  accepts 24pp → wrap **19.0×10.25in** (5700×3075px @300). The worker pulls
  these live per order; `gate_spec` + `gate_lulu` validate every job.
- **Cover casewrap rebuilt** so the front photo runs **right to the spine**
  (no cream gap) with the customer's framing preserved (no scaling); turn-ins
  filled by edge-stretch. Added a slim **deep-accent spine** carrying the title
  top-to-bottom (US/UK convention) with **KETABI STUDIO** centred at the foot
  (anchored, on the title's axis).
- **Back-cover seal fixed** — was hardcoded "sealed with the dua for parents"
  on all 7; now a per-template `SEALS` map matched to each book's actual dua
  (spouses / righteous children / your family / those who raised us). Verb made
  plural-safe ("Mama & Baba").
- **Copy cleanup** — removed em dashes from all customer-facing keepsake copy
  (storefront blurbs, spouse dedication, printed back-cover line); standardised
  "duʿā" → "dua" in the default captions.
- **Verified:** all 7 render 24pp at 8.75×8.75in/300dpi with the correct dua
  (17:24, 25:74, 3:38, 2:201), correct spine title + seal, and audited captions.

**Duas book parked.** `my-beautiful-duas` art is under review, so it is fully
**hidden** via a reversible `hidden` flag in `lib/books.ts`: excluded from
every listing (`VISIBLE_BOOKS`), its detail route 404s, and it cannot be
ordered. Earlier interior polish (readable treasure grid, anchored dua pages,
continuous twilight spine, cover-halo fix) is preserved in
`worker/pipeline/duas_pipeline.py`.

**I-Am storefront mini-covers** updated from the old arch mock to the cinematic
cover (full-bleed photo + bottom title plate) on `/shop/storybooks` and the
homepage feature, matching the live builder.

**Greeting card pricing decided (live values, still gated by test mode).**
Cards move from one flat "delivered" price to a **flat $12.99 card + flat $4.99
shipping, same worldwide** (`lib/pricing.ts`, checkout route, `CardMaker`).
- One card price and one shipping price everywhere → no confusing two-price
  display. International still earns the fatter margin automatically because
  Prodigi (~$7 delivered) is far cheaper to fulfil than US Cloudprinter
  (~$11.62) — the gap comes from print cost, not a higher shipping charge.
- Per-order profit off live printer quotes + Stripe fees: **US ≈ $5.5**,
  **international ≈ $10 typical** (~$3.4 worst case, Malaysia). Every route
  profits.
- Considered $9.99 intl shipping (≈ $15 intl profit) but rejected as too steep
  for a greeting card / cart-abandonment risk; $4.99 worldwide still ~2× the US
  margin internationally.
- All gated behind `TEST_DOLLAR_PRICING`: while `true`, card = $1 and shipping
  = $0, so test orders total exactly $1. Flip the flag to go live at the above.

`TEST_DOLLAR_PRICING` and `COMING_SOON` remain `true` (everything is $1 and the
site is gated) until launch.

---

### 2026-06-23 — "I Am [Child]" book: cinematic cover + interior polish

Pre-launch QA pass on the personalized **I-Am** book (HTML-rendered via
`worker/pipeline/iam_book.py`; templates in `iam-templates/`). Trim unchanged
at 8.5×8.5in, 32pp. Files touched:
`iam-templates/{book-template,cover-hardcover,cover-paperback}.html`,
`components/IamBookBuilder.tsx` + `.module.css`, `worker/pipeline/iam_book.py`.

- **New front cover — cinematic full-bleed.** Replaced the photo-band + cream
  title-plate cover with a full-bleed design: the customer photo fills the
  whole face, a soft teal scrim rises from the foot, and the title (gold star,
  italic "I am", name, gold hairline, Arabic) sits over it inside the safe
  area. `object-fit:cover` means any photo shape fills cleanly with **no white
  edges and no manual cropping needed**; the customer's crop still overrides
  (WYSIWYG). The scrim guarantees the title stays legible on light photos.
  **Hardcover and paperback front faces are now identical.**
- **WYSIWYG kept in sync** across three surfaces: the inline builder preview
  (`IamBookBuilder`), the "exactly as it prints" modal (renders
  `book-template.html` via `/api/iam/template`), and the Lulu print covers.
  The cover cropper frame is now **square** (`COVER_ASPECT = 1`).
- **Interior refinements.** The 12 trait spreads now anchor the "I am
  &lt;Trait&gt;" block to a fixed top so the large trait word sits at the **same
  height on every spread** (was vertically centred, so 2- vs 3-line sentences
  made it jump). Body sentences use `text-wrap:balance` for even line breaks.
- **Spine text — Lulu-aware.** Lulu advises against spine text below ~0.25in.
  `render_cover` now drops the spine text when the spine is under 0.22in. For
  32pp this means the **paperback** (0.139in spine) prints a clean spine while
  the **hardcover** (0.25in spine, ~0.078in clearance) keeps "I am [Name] /
  Ketabi". Thicker future books keep it on both.
- **Geometry confirmed against Lulu** `/cover-dimensions/` (sandbox = prod for
  geometry): paperback **17.389×8.75in, spine 0.139in**; hardcover
  **19.0×10.25in, spine 0.25in, wrap 0.875in**. Our render matches exactly;
  the worker pulls these live per order and `gate_spec` + `gate_lulu` validate
  every job.

Note: the I-Am book offers **both** bindings (softcover + hardcover casewrap),
unlike the three books table above. `TEST_DOLLAR_PRICING` and `COMING_SOON`
(see `lib/pricing.ts`, `lib/flags.ts`) remain `true` — books are $1 and the
public site is gated to `/coming-soon` until launch.

---

## Incident log / known issues

**2026-06-11 — long-straight variants rendered without the girl.**
`_set_skin_variant` matched hairstyle layers by exact string equality;
the "Long straight" layer name in the PSDs didn't match exactly, so all
12 long-straight looks (every skin × hair) rendered cover AND pages
1-11 with the character hidden — silently. Fixes shipped: (a) normalized
layer-name matching (case/whitespace/hyphen-insensitive), (b) a
`VariantError` raised loudly when any skin/hair/style fails to match,
(c) cover character-presence guard in the worker, (d) the 144 broken
bases were deleted from the bucket.
**UPDATE 2026-07-01: long-straight is LIVE again.** The restore was
completed — web heroes/peeks/previews for all long-straight looks are in
`public/images/`, `OrderSection.tsx` has `available: true`, and the API
accepts the style (there is no `BLOCKED_STYLES` anymore). Remaining
diligence before relying on it: confirm the re-rendered
`bases/cover__*-long-straight` + `page01..11__*-long-straight` objects
exist in the Supabase `book-assets` bucket (assets on disk don't prove
the bucket was refreshed), or run one $1 long-straight test order
end-to-end — the cover character-presence guard + color-signature gate
will catch missing/wrong bases at QC.

**Cover bases contain baked-in PSD text** (title "(Child's Name)",
"Embracing Modesty", author/illustrator credits): the original base
render hid only top-level type layers; Cover.psd nests its text in
groups. The worker blanks those regions at order time
(`generate_from_bases.generate_cover_from_base`), and
`render_bases_ci.py` now hides nested type layers too, so freshly
rendered bases are clean at the source. The blanking is kept as
defense-in-depth.

**Crocodile Feet font is a DEMO license** — it lacks `:;—–…` glyphs
(pipeline substitutes safe equivalents). Licensing should be revisited
before scale.

**Domain**: ketabistudio.com still points at the old Capacitor
marketing site; this app lives at ketabistudio-web.vercel.app until
the domain is switched in Vercel.

---

# Continuation guide — current state (updated 2026-06-29)

> Read this first if you're a new session picking up the project. It captures
> everything beyond the original 3-book system: the full product set, the
> subsystems built since, the **gotchas that cost real debugging time**, and
> copy-paste **operational recipes**. The sections above are still accurate for
> the hijab/juha/maryam books; this section is the live state of everything else.

## Where we left off (DO THIS NEXT)

- **Three physical test copies are ordered and in production** (~a few weeks to
  arrive): a **keepsake** (`about-baba`), a **greeting card**, and the **I Am
  book** (`i-am`, child "Muadh", order `42c17b3a-b646-4831-b48d-85d2710e93f5`).
- **Pricing is still in TEST mode.** `TEST_DOLLAR_PRICING = true` in
  `lib/pricing.ts` (everything is $1). **Do NOT flip to live until the physical
  copies arrive and the owner confirms print quality in hand** (color, casewrap
  binding, and cover sharpness — the I-Am cover photo is only ~150–180 DPI). When
  the owner says go: set `TEST_DOLLAR_PRICING = false`, verify live prices
  ($49.99 hardcover, $6.99 voice card, etc.), commit, merge to `main`.
- `COMING_SOON` (`lib/flags.ts`) is still `true` — public site gated to
  `/coming-soon`; preview cookie `ketabi_preview=ketabi-preview-2026` bypasses it.

## The four product lines

| Line | Slug/route | Printer | Notes |
|---|---|---|---|
| Children's books | `/books/[slug]` | Lulu | hijab (personalized), juha, maryam, **I Am [Child]** |
| Keepsakes | `about-*` (e.g. `about-baba`) | Lulu hardcover casewrap | 24pp 8.5×8.5 photo book, `worker/pipeline/photobook_pipeline.py` (PIL) |
| Physical greeting cards | `/cards` | Cloudprinter/Prodigi | folded photo cards |
| Digital cards | `/c/[token]` | — (web) | animated shareable card, optional **voice note** add-on |

## Pricing & flags — `lib/pricing.ts`, `lib/flags.ts`

- `TEST_DOLLAR_PRICING` (line ~8) — `true` ⇒ every price is $1 (test orders).
- `HARDCOVER_PRICE_CENTS` = $49.99 live; `VOICE_ADDON_CENTS` = TEST ? 100 : 300
  (+$3 → digital card $6.99 with voice).
- `COMING_SOON` in `lib/flags.ts` gates the whole site.

## Digital cards subsystem

- **Catalog/helpers:** `lib/digitalCard.ts` (`SCHEME_OG`, `OCCASION_PHRASE`,
  `cardHeadline`).
- **Builder UI:** `components/cards/DigitalCardMaker.tsx` (scheme, message,
  schedule, voice recorder). **Voice recorder:** `components/cards/VoiceRecorder.tsx`
  records to **MP3 in-browser** via `@breezystack/lamejs` (`lamejs.Mp3Encoder`,
  AudioContext + ScriptProcessorNode PCM capture, lazy-loaded) so it plays
  everywhere.
- **Viewer:** `app/c/[token]/page.tsx` (async params; `generateMetadata` →
  occasion-aware title, `robots noindex`, OG + Twitter). `app/c/[token]/opengraph-image.tsx`
  = next/og `ImageResponse`, runtime nodejs, 1200×630, scheme gradient.
- **APIs:** `app/api/digital-cards/{order,checkout,opened}/route.ts` +
  `app/api/stripe-webhook/route.ts`. Order route validates `scheduled_at`
  (**30-day max** — Resend caps `scheduled_at` at 30 days) and `voice_url`
  prefix. Checkout adds the voice line item when `has_voice`. Webhook:
  `senderFrom()` personalized From-name, occasion subject, `reply_to`, buyer
  receipt, idempotent paid-state transition.
- **Open-notify:** `app/api/digital-cards/opened/route.ts` marks `opened_at`
  once and emails the buyer. (Bug fixed: a 204 response must have **no body** —
  return `NextResponse.json({ok:true})` 200, not 204-with-body.)
- **DB:** `supabase/migrations/20260625_digital_card_orders.sql` — columns
  `scheduled_at, opened_at, voice_url, has_voice, customer_email` (all live).
- **Scheduling timezone:** `zonedToUtcIso` verified across DST; Eid cards hidden
  until within 30 days of the date.

## Keepsakes — `worker/pipeline/photobook_pipeline.py` (PIL render)

- Lulu casewrap hardcover, 24pp, 8.5×8.5, POD `0850X0850.FC.PRE.CW.080CW444.MXX`.
- Cover render: `_front_cover` draws title on a transparent layer with a
  gaussian-blur soft shadow over a deepened bottom scrim
  (`_bottom_scrim(frac, max_alpha, ease)`). `title_page` vertically centers the
  title block (`k_y = max(560, (TRIM-block_h)//2)`, TRIM=2550, FULLBLEED=2625).
- Email label fix (`worker/emailer.py` `_book_label`): about-mama/baba/grandma/
  grandpa return `"Everything I Love About {recipient}"` (no redundant
  "for {recipient}"); custom-title keepsakes keep "for {recipient}".

## "I Am [Child]" book — templates + the cover saga

- **Templates (single source of truth, in `iam-templates/`):**
  - `cover-hardcover.html` — casewrap wrap+spine+panel cover (the printed cover).
  - `cover-paperback.html` — paperback bleed cover.
  - `book-template.html` — 32-page interior **AND** the front/back cover sheets
    used by the **website preview** (the worker strips the cover sheets and
    prints interior only; the cover prints from `cover-*.html`).
  - `content.json` — the 12 trait spreads (Kind/Lateef … Mindful/Taqiyy).
- **Rendering:** `worker/pipeline/iam_book.py` → `render_cover` / `render_interior`
  via Playwright Chromium `page.pdf()` (print media, 1in = 96px). `_crop_style`
  maps the customer crop `{x,y,w,h}` (visible source rect, fractions) to fill the
  cover. Hardcover geometry pulled live from Lulu: **19.0×10.25in, wrap 0.875in,
  spine 0.25in**, front panel 8.5×8.5.
- **Website preview:** `components/IamBookPreview.tsx` renders `book-template.html`
  in an iframe (`lib/iamPreview.ts buildPreviewHtml`). Cover sheet in
  `book-template.html` **must be kept visually identical** to `cover-hardcover.html`
  or the site and the print diverge (this bit us — see gotchas).
- **Rose colourway** swaps palette hexes (`#2f5d57/#21443f/#24493f/#bcd0c9`) via
  string replace in BOTH `iam_book._colorway` and `iamPreview` ROSE map. Any color
  that must swap has to be written as one of those hexes (use 8-digit `#21443fXX`
  for alpha so the `#21443f` substring still matches).
- **Cover design (final, after much iteration):** full-bleed photo, **no keyline
  box**, **no title text-shadow**, a soft eased foot scrim
  (`height:56%`, `#21443fDB→…→#21443f00`) that carries title legibility, **no star**
  flourish. Title = `I am` (gold) / Name (cream) / rule / Arabic name (gold).

## ⚠️ Gotchas that cost real time (read before touching the I-Am cover)

1. **`cqw` units in `text-shadow` rasterize into opaque PLATES on the print
   worker's Chromium** (a different build than local). Locally they render as a
   soft shadow, so it passes review then prints as dark boxes behind each title
   line. **Never put a `cqw`-based text-shadow on the cover title.** Legibility
   comes from the scrim (a gradient `<div>`, renders identically everywhere).
   Removed in commit `8aec051`.
2. **Lulu's order-page thumbnail (and email digest) are small, heavily-compressed
   JPEGs.** They **band smooth gradients** (JPEG contouring) into a faint
   horizontal "shadow line" across the scrim — this is NOT in the print file.
   Verify by scanning the gradient in the real PDF (it steps ~2 luma levels at a
   time, smooth) or rendering at 240 DPI. Flat/graphic covers (the other books)
   don't band; gradient-over-photo does. If a customer is bothered, adding faint
   grain to the scrim would dither away the banding (not yet implemented).
3. **`digest.jpg` was served from cache** → owner reviewed a stale preview after a
   re-render and thought the fix hadn't landed. Fixed: worker uploads the digest
   with `Cache-Control: no-cache` (`storage_upload(..., cache_control=...)`,
   commit `3ee251f`). Print PDFs keep default TTL.
4. **Render worker is a Docker service** (`render.yaml`, `worker/Dockerfile`,
   copies `iam-templates` + `public/images` into the image). A template change
   only takes effect after Render **rebuilds the image (~10–15 min** — it installs
   Chromium). Resetting an order too soon re-renders with the OLD image. Always
   confirm Render shows the new commit **Live** before resetting.
5. **Customer photos carry EXIF orientation** (iPhone orient 6 = rotate 90°). The
   browser/cover render applies it; PIL does not by default — use
   `ImageOps.exif_transpose` when reasoning about crops, and reason in the
   *displayed* orientation (crop `{x,y,w,h}` fractions are in displayed space).
6. **Casewrap content within ~0.5in of the trim is at risk** (wrap folds around
   the board). For full-bleed photos, faces should sit inside the safe margin; a
   subject filling the frame edge-to-edge can't be saved by cropping.

## Operational recipes (copy-paste)

**Reset an order to re-render** (after a template/worker fix). Subquery form —
`order by/limit` directly in `where` is a syntax error:
```sql
update public.orders
set status='pending', cover_path=null, interior_path=null, qc_report=null
where id = (select id from public.orders
            where book_slug='i-am' and status not in ('submitted','printing','shipped')
            order by created_at desc limit 1)
returning id, child_name, status;
```

**Swap the cover photo + set a crop on an existing I-Am order** (no rebuild). The
I-Am order stores everything under the `photo_data` JSON column
(`{cover_photo_url, cover_crop:{x,y,w,h}, photos:[...]}`); `options` holds
`{name_arabic, gender, colorway, dedication}`:
```sql
update public.orders
set photo_data = jsonb_set(
      jsonb_set(photo_data::jsonb, '{cover_photo_url}', '"<PUBLIC_URL>"'::jsonb, true),
      '{cover_crop}', '{"x":0.035,"y":0,"w":0.689,"h":1}'::jsonb, true),
    status='pending', cover_path=null, interior_path=null, qc_report=null
where id='<ORDER_ID>'
returning id, status, photo_data->>'cover_photo_url';
```

**Upload a photo into the bucket** (so it can be a cover). `POST /api/photobook/photo`
is **public** (no auth) and returns a public `card-assets/photobook/<uuid>` URL.
The worker only accepts photos already in that bucket, so new photos MUST go
through here (or the builder's picker):
```bash
curl -X POST https://www.ketabistudio.com/api/photobook/photo \
  -F "file=@photo.jpg;type=image/jpeg"   # → {"url":"...","width":..,"height":..}
```
Print needs ~300 DPI; warn below ~150 (min dim / 8.5in). Screenshots are usually
too low-res.

**Verify a cover the way it actually prints** (reproduce the worker's exact path —
local Chromium differs, so always render through `page.pdf()` print media at the
casewrap dims, then raster with `fitz`/pymupdf). Chromium binary at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; replicate `iam_book.render_cover`
(`--in:96px`, set `--spine`/`--wrap`, add the `@media print` CSS, fill tokens,
`page.pdf(width=19in, height=10.25in)`). Front trim face = x 9.625→18.125in,
y 0.875→9.375in. See session scratch scripts for the harness.

## Recent commits on `main` (this session)

```
8aec051  I Am cover: remove title text-shadow (plated on worker Chromium)
3ee251f  Worker: serve approval digest no-cache (no stale preview)
b0465fe  I Am cover: remove the star flourish
f5a154b  I Am cover: drop glow halo, sync website preview to printed cover
d181f1a  I Am cover: soften + lower foot scrim
a45bed9  I Am cover: remove keyline frame (clean full-bleed front)
```
Dev branch: **`claude/ketabi-qa-audit-u05rrp`** (cover work merged to `main`).
Note: commits show "Unverified" on GitHub (no GPG signing in the dev
environment) — committer identity is correct; nothing to fix.

## Admin / supportability notes

- `app/admin/page.tsx`: `QcBlock` only shows `qc_report.failure` for
  `PROBLEM_STATUSES = {failed, payment_failed, rejected}` — the worker stores a
  traceback in `qc_report.failure` on a transient submit error and never clears
  it, so without this guard shipped orders show stale tracebacks.
- Supabase MCP is often **gated** ("requires approval") and there's no service
  key in the dev env — hand SQL to the owner to run, or hit deployed public API
  routes. Storage writes go through `/api/photobook/photo` (above).
- **Customer-facing email copy must not expose fulfilment mechanics.** The
  card-shipped email (`worker/emailer.py send_card_shipped`) once said "blind
  and white-label, with no Ketabi or printer branding" — removed. Keep the
  drop-ship/white-label wording to internal code comments only.

# Social media growth engine (auto-poster) — added 2026-07-04

Automated organic posting to grow the waitlist. **Instagram + Facebook are
LIVE and posting daily, fully hands-off.** Pinterest is partial (boards only),
TikTok is built but pending review. All content funnels to the waitlist
(coming-soon page) via "link in bio".

## LIVE: Instagram + Facebook auto-poster

- **Daily cron** `app/api/cron/social/route.ts` — `vercel.json` schedules
  `0 16 * * *` (16:00 UTC). Pulls the next due, pre-reviewed post from
  `social_queue`, runs the QC gate, publishes to IG + the FB Page together,
  and refreshes the Meta token on every run.
- **QC gate** `lib/socialQc.ts` — always runs deterministic checks: caption
  length ≤2200, ≤30 hashtags, **no Star of David / six-pointed star**, Arabic
  integrity (rejects mojibake / broken shaping), reachable https image.
  Optional Claude proofread of **MSA Arabic + English + Islamic accuracy** if
  `ANTHROPIC_API_KEY` is set — it is NOT (owner declined the cost; captions are
  kept English-first so it isn't needed). Nothing posts unless the row is
  `qc_reviewed=true` AND the gate passes.
- **Enqueue endpoint** `app/api/social/enqueue/route.ts` — POST, auth
  `Authorization: Bearer $CRON_SECRET` (or `x-admin-key`). Body
  `{posts:[{image_url, caption, platforms?, scheduled_for?}]}`. This is how a
  session adds content WITHOUT hand-written SQL. Rows land `qc_reviewed=true`.
- **Image hosting** — post images must be at a public URL for Meta. Upload via
  `POST /api/photobook/photo` (multipart field `file`) → `{url}` (public
  Supabase `card-assets` URL). Feed that url to the enqueue endpoint.
- **Supabase tables** (source of truth; owner ran the seed SQL once):
  - `social_config` (single row `id=1`): `meta_user_token`, `meta_page_token`,
    `meta_page_id`, `meta_ig_id`, `meta_app_id`, `meta_app_secret`. The cron
    reads and rewrites the refreshed tokens here.
  - `social_queue`: `id, image_url, caption, platforms, scheduled_for,
    status(queued|published|blocked|failed), qc_reviewed, qc(jsonb),
    ig_media_id, ig_permalink, fb_post_id, error, published_at`.
- **`CRON_SECRET = ketabi-cron-2027`** (Vercel env). Authorizes both the cron
  (Vercel auto-sends it as the Authorization header) and the enqueue endpoint.
  Must have NO whitespace (a trailing space once failed the Vercel build).

### Meta connection facts
- App **"Ketabi Studio Poster", App ID `1341497080739424`** — the owner made
  ~3 duplicate same-named apps; THIS is the wired one. Its secret is in
  `social_config.meta_app_secret`. Uses **classic Facebook Login** (the other
  duplicate `3599700743516513` had "Login for Business" and its dialog errored).
- Assets: FB Page **"Ketabi Studio" `1238819849308549`**, IG business
  **`17841467093722066` @ketabistudio (~1580 followers)**, inside business
  portfolio **"Ketabi" `1644502502789145`**.
- **The Page lives in a business portfolio**, so `me/accounts` returns empty
  without `business_management`. Reach it via `me/businesses` →
  `{biz}/owned_pages{...,instagram_business_account}`.
- **Reconnect / refresh** (token lasts ~60 days; cron extends it; if it lapses
  re-auth): OAuth dialog
  `https://www.facebook.com/v21.0/dialog/oauth?client_id=1341497080739424&redirect_uri=https%3A%2F%2Fwww.ketabistudio.com%2Fpinterest%2Fcallback&response_type=code&scope=instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,pages_manage_metadata,pages_manage_engagement,read_insights,business_management`
  → owner approves (must tick the Ketabi Page + IG) → lands on
  `/pinterest/callback` with the `?code` → exchange (`oauth/access_token`),
  extend to long-lived, derive page token, write both into `social_config`.
- **Capabilities**: post to IG + FB ✓, read/hide comments ✓, insights ✓, set FB
  Page About/description/cover ✓ (via `pages_manage_metadata`; New Pages
  Experience has a read-back lag but writes stick). **DMs = needs Meta review
  (not done).** **Profile pictures (FB + IG) and the IG bio are NOT settable via
  any Meta API — manual only.**

### The shared OAuth callback
`app/pinterest/callback/page.tsx` — a public "You're connected ✓" page that
surfaces `?code`. Allowlisted in middleware. Reused by Pinterest, Meta, AND
TikTok (the "pinterest" name is historical; it's the generic connect page). It
is a Server Component — do NOT add event handlers to it (an `onFocus` once
crashed it with a server-side exception).

## Content: what to make + the voice (HARD RULES)

- **Audience**: the established Muslim mom (gifts for her kids, her own mama,
  her sisters at Eid) with young-mum appeal. IG was repositioned from a
  da'wah / Islamic-knowledge-reels account into a premium Muslim-mom aesthetic
  brand (owner archived the old reels). Knowledge reels were dropped because
  they need 100% fact accuracy — too risky.
- **Aesthetic = filmic Islamic-creator reminder page** (NOT flat beige quote
  cards — the owner rejected those as generic). The look: dreamy, cinematic
  photography under a consistent **warm film grade** (lifted/faded blacks, warm
  tint, slight desaturation, soft bloom, film grain), one short **poetic italic**
  line (Playfair Italic), Allah pronouns (His/Him) capitalised, and **almost no
  branding on the image** — just a faint letter-spaced "KETABI STUDIO" wordmark
  + gold rule; the brand + soft CTA ("link in bio") live in the CAPTION. Product
  posts get the SAME warm grade so they sit in the grid as part of the mood.
  1080×1350 for feed stills. Film-grade recipe: `a*0.90+16`, R×1.05 B×0.93, 15%
  desat, GaussianBlur(14) blend 0.13, grain ±8 (PIL+numpy, `scratchpad/lux/
  genstatic.py`).
- **NO identifiable people in the imagery — this is the hard rule.** A stock
  photo of a mother/family reads as *some individual's personal account*, so
  nobody reposts it and it doesn't build the brand (owner's call: "they won't
  repost it thinking it's a person's actual account"). The shareable unit is
  either **the words** (heartfelt reminder over a faceless background — window
  light, fabric, a hand, an open Qur'an, prayer beads, dried florals) or **the
  product** (the actual books/keepsakes/cards). Faceless backgrounds live in
  `scratchpad/lux/` (light.jpg, morning.jpg, hand.jpg, …). Both feed stills and
  reels share ONE look so the grid is cohesive.
- **Text legibility over photos is ADAPTIVE** (owner flagged washed-out text on
  pale photos, like her keepsakes). Measure the mean luma of the text band
  (bottom ~third); set scrim `amax = clamp(1 - 58/band, 0.42, 0.90)` so every
  photo darkens to ~luma 58 behind the words, plus a blurred black shadow layer
  under the cream text. Never ship a line you can't read.
- **Keep the wording genuinely Islamic, not trendy-influencer.** Owner rejected
  "romanticize your deen" as trivialising worship — avoid it and the
  softlife/slowliving framing/hashtags. Lean on real Islamic language (turn to
  Allah, akhlaq, bismillah, amanah, tasbih, adhkar) kept warm and human.
- **No readable random-book text in the imagery.** A photo showing a random
  (non-Quran) book's printed words is distracting — use the Qur'an or a scene
  with no visible text. (Owner flagged a coffee+book flatlay; swapped it.)
- **Reels are SILENT and fully auto-posted.** The owner deliberately avoids
  audio ("slippery slope"), which removes the only thing the IG API couldn't do
  (attach trending/licensed audio). So reels are now generated + posted by the
  pipeline just like stills: a filmic faceless background, a heartfelt Islamic
  line revealed in beats (Playfair italic on a soft radial band scrim so the
  light type stays legible over bright areas), Ken-burns drift, and a gentle
  KETABI STUDIO end card that fades in slow and is HELD to the finish (an early
  version flashed the wordmark too fast/high — don't). 1080×1920, 15s, 25fps.
  **Render with `content-tools/gen_reel_pil.py`** (browser-free PIL/numpy +
  ffmpeg, ~30s/reel, auto-uploads each finished mp4 and logs the URL to
  reel_manifest.txt). The old Playwright pipeline (reel.html + cap.py /
  batch_reels.py) is legacy: container restarts kill long browser renders and
  a throttled box runs ~7min/reel. Encode stays **under 4.5 MB**
  (`-crf 25 -maxrate 2200k`) to fit Vercel's serverless upload limit.
- **I (Claude) QC every single post, carousel, and reel before it ships** —
  standing owner instruction. Build a frame/contact sheet, read it back, and
  confirm legibility + the faceless rule + the held end card + correct copy with
  my own eyes. Never queue something I haven't looked at rendered.
- **Voice**: NO em dashes. Natural and human, not AI-polished. Premium, not
  discount-y — keep "20% off" OUT of the bio and most posts; mention the
  founding offer sparingly. Every caption ends at the waitlist ("link in bio").
  "Sealed with a dua" is the signature line — use it once, not on everything.
- **Islamic accuracy (non-negotiable)**: never a false claim. No hadith or
  Qur'an unless verbatim and verified. No rulings. Keep captions ENGLISH-FIRST
  (zero fact risk); only add Arabic after careful verification and only
  well-known short phrases. Never any Star of David / six-pointed star.

### Threads mirroring (built 2026-07-04, awaiting owner's one-time connect)
Every published post can mirror to Threads (same media, caption with the
hashtag block stripped + 500-char cap + plain `ketabistudio.com` footer —
see `lib/threads.ts`). Credentials live in a PRIVATE Supabase storage bucket
(`social-config/threads.json`), not a table column, because DDL isn't
available without the SQL editor; the cron refreshes the 60-day token weekly.
The mirror is best-effort: a Threads failure never fails/retries a post that
already went out on IG/FB. To activate, the owner must (one-time):
1. developers.facebook.com → Create App → use case **"Access the Threads API"**
   (Threads apps are separate from the Facebook Login app).
2. In the Threads app settings: add redirect callback URL
   `https://www.ketabistudio.com/api/social/threads/connect`, copy the
   **Threads App ID + secret**.
3. App roles → add her Threads account (@ketabistudio) as a **Threads Tester**,
   then accept the invite in the Threads app (Settings → Account → Website
   permissions) — required while the app is in dev mode.
4. Vercel env vars: `THREADS_APP_ID`, `THREADS_APP_SECRET` (no whitespace!).
5. Visit `https://www.ketabistudio.com/api/social/threads/connect` once and
   authorize. The page confirms "Threads connected ✓" and mirroring is live.

### Poster capabilities (2026-07-04)
The daily cron now publishes **images, reels (IG Reels + FB video), AND
carousels** — post type is inferred from the media URL so no schema columns
were needed:
- `image_url` ends in `.mp4` → **reel** (IG REELS container with status polling
  → media_publish; FB `/videos` via file_url).
- `image_url` has multiple whitespace-separated URLs → **carousel** (IG child
  containers → CAROUSEL parent; FB posts the first image).
- otherwise → single image.
Each run ships **every post due that day** (images/carousels first, reels last
so a platform time-cap only ever strands a reel, which then retries), so
enqueuing 1 reel + 1 static for the same day gives the **1 reel + 1 post/day**
cadence the owner asked for.

- **Reel/video hosting**: `POST /api/social/video` (Bearer CRON_SECRET, multipart
  field `file`) stores the mp4 to Supabase `card-assets/reels/…mp4` and returns
  the public URL. Keep reels **under 4.5 MB** (Vercel body limit) — the encode
  recipe above already does.
- QC media checks (`media-https`, `media-reachable`) cover video too; HEAD with
  a ranged-GET fallback.

### Curated grid (2026-07-04)
Owner wants a **very curated grid**, not just good individual posts. The system
is a **checkerboard**: dark filmic reminder/reel ↔ cream card, faceless, one
warm palette, never repeat a background (see `content-tools/`). With a 3-wide
grid, strict dark↔light alternation is always a checkerboard. Each day =
**1 reel (dark) + 1 cream card (light)**.

The owner deleted the 3 pre-checkerboard posts by hand (IG has no API delete),
so the grid is curated from tile one. **Tile one = the ر ح م insight carousel**
(posted 07-04, IG `instagram.com/p/DaYf_z0lAOY`).

### Posting schedule + reliable trigger (2026-07-05)
Two slots daily: **10:00 UTC (5am Central, dark reel)** and **19:00 UTC (2pm
Central, cream card / carousel)**. Times are set for Central DAYLIGHT time —
shift the crons +1h when US clocks fall back in November so the owner's 5am
stays 5am. Vercel crons exist (vercel.json) **but the free-tier cron fires
late/unreliably** (missed the 07-05 morning slot). The REAL trigger is a
**GitHub Action** `.github/workflows/social-poster.yml`: pings the poster at
both slots + a catch-up run an hour after each, auth via repo secret
`CRON_SECRET` (added by owner, test run green). Safe because the endpoint only
publishes rows whose scheduled_for is due, so overlapping runs never
double-post. Manual fire any time:
`curl -H "Authorization: Bearer $CRON_SECRET" https://www.ketabistudio.com/api/cron/social`

### Content strategy (updated 2026-07-05, owner-approved)
- **The growth engine is VERIFIED INSIGHT content** (the "wait, really?"
  carousels), not generic quotes. Bank of 13 fact-checked items + a DO-NOT-POST
  list: `content-tools/insight-bank.md`. Carousel 01 = ر ح م (live), Carousel
  02 = qalb (queued 07-08 anchor, `content-tools/gencarousel_qalb.py`). Next
  up: ج ن ن "everything hidden", Al-Wadūd.
- **Gender: insight content stays UNIVERSAL** (whole ummah reposts it);
  mama-framing only on parenting/product posts. Neutral tagline on visuals:
  "for hearts that remember Him". (Owner flagged this 07-05.)
- **Voice: `content-tools/voice-style.md` — READ IT BEFORE WRITING ANYTHING.**
  One person's voice, always. No em dashes anywhere (including chat replies to
  the owner). QC every visual by eye (RTL direction! PIL+raqm lays Arabic
  right-to-left already, do NOT pre-reverse), grep copy for em dashes, verify
  every claim (quote hadith verbatim + grading; sunnah.com is proxy-blocked
  from this environment, cross-verify via mirrors like hadithunlocked.com).

### Queue state (as of 2026-07-05)
Queued through **07-21**, one dark reel 10:00 + one light card 19:00 daily;
07-08 19:00 is the qalb carousel (light slot). Live so far: ر ح م carousel,
"Raising little believers" card, "Allah is nearer" reel. **Refill before
07-22** using `content-tools/gen_reel_pil.py` (browser-free, ~30s/reel,
auto-uploads + writes reel_manifest.txt) + `gen_cream_card.py`, then enqueue
pairs via /api/social/enqueue (reels at T10:00:00Z, cards at T19:00:00Z).
Keep the checkerboard; QC contact sheets first.

## Substack (live 2026-07-05)
Owner created the publication and hand-published **post 1: "Mercy, in its
mother tongue"** (`content-tools/substack/post1-rahma.md` + banner recipe in
the session scratchpad). Substack has **NO publishing API** — flow is: Claude
writes + verifies + generates the cream banner (1456×816, Arabic root in Amiri;
remember PIL renders RTL natively), owner pastes into Substack (first image in
the body becomes the cover) and uses Substack's own scheduler. Repurpose each
insight carousel into an essay (~500-700 words, structure in voice-style.md,
sources cited INSIDE the post). Strategy: nurture + slow discovery channel, not
a growth spike; cross-link it from IG bio + captions. Ask the owner for the
publication URL (not yet recorded here).

## Pinterest (boards only — pins blocked)
- @ketabi_studio connected. OAuth app id `1587172`. **8 keyword boards created
  via API** (Islamic Gifts for Kids, Muslim Family Keepsakes, Eid Cards & Gifts,
  Nikah & Muslim Weddings, Muslim Baby Gifts, Ramadan Ideas, Islamic Books for
  Kids, Muslim Daily Habits & Dhikr).
- **Pins CANNOT post via API on Trial access** (error 29 "may not create Pins
  in production" — needs Standard access / audit). 9 finished pins + a copy
  sheet were delivered to the owner to post manually or via Tailwind.

## TikTok (@shop.ketabi — built, pending review)
- App **"Ketabi Studio Poster"**, **Production client key `awjkfi0rki35d0j4`**,
  client secret `QtvqCmNKDsT9Fj0MNJRtKLfkpl6zIBqJ`. Products: Login Kit +
  Content Posting API (Direct Post on). Scopes: `user.info.basic`,
  `video.upload`, `video.publish`. Redirect `/pinterest/callback`. Domain
  verified via `public/tiktokhDMTIexJvX7PvUvnZ68GBIej21DWawFv.txt`.
- **Blocked**: Production OAuth returns a "client_key" error because the app is
  an unaudited Draft. Testing needs the **Sandbox** tab (separate keys + add
  shop.ketabi as a target user), which the owner found too fiddly on mobile.
  Owner **submitted for review** with the walkthrough demo video
  (`scratchpad/ttdemo/ketabi-tiktok-demo.mp4`) + the scope explanation text. If
  TikTok bounces it wanting a real sandbox demo, do the sandbox flow (easier on
  desktop), record a real capture, resubmit. No auto-posting until approved.
- Auth URL: `https://www.tiktok.com/v2/auth/authorize/?client_key=<key>&scope=user.info.basic,video.upload,video.publish&response_type=code&redirect_uri=https://www.ketabistudio.com/pinterest/callback&state=ketabi-tt`.
  Token exchange: `https://open.tiktokapis.com/v2/oauth/token/`. **TikTok API
  cannot attach trending audio** (owner doesn't use it, so fine for them).
- Owner keeps a separate ~70k main TikTok/YouTube for education content +
  occasional ads; shop.ketabi is the product account for us to run.

## Other 2026-07-04 changes
- **Coming-soon redesigned** (`app/coming-soon/`): product-first, above-fold
  waitlist, "Founding list + 20% off", app framed for **ADULTS** (dhikr/adhkar,
  not children — that was a correction). Distinct Muslim-family Pexels renders
  for `public/images/coming-soon/{keepsake-baba,keepsake-mama,iam}.jpg`.
  Waitlist button centred; "little hearts" removed from the app blurb.
- **Waitlist verified collecting** — `POST /api/waitlist` → Supabase `waitlist`
  table. Apex `ketabistudio.com` 307-redirects to `www` and preserves the POST.
- **Viral loop CTA** strengthened on `components/cards/DigitalCardViewer.tsx` —
  accent pill "Make your own with Ketabi", UTM-tagged.
- **Gating** — `middleware.ts` ALLOW = `/coming-soon, /privacy-policy, /terms,
  /cards/print, /c, /admin, /pinterest/callback`. `/terms` un-gated for the
  TikTok/Meta apps' required Terms URL. TikTok verification `.txt` is served
  because dotted paths skip the gate.
