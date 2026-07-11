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

# Continuation guide — current state (updated 2026-06-29; NEWEST session log: "FULL-STACK COMMERCE DAY (2026-07-09)" at the bottom)

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
- **SOCIAL (active work, 2026-07-05):** the "From One Root" 30-day campaign is
  the live front. Owner is approving the premium hero frames (board in session
  scratchpad `premium/MONTH_premium_v2.jpg`). On approval the week starts the
  next Monday at **2 posts/day**, shown to owner before scheduling. See the
  "From One Root — premium relaunch" section at the very bottom for full state.
  DO NEXT: bake the premium grade + gold Amiri into the reel renderer, build
  Week 1 (qalb + nūr), QC, show owner, schedule via `/api/social/enqueue`.

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
a growth spike; cross-link from captions/Notes. **URL: `ketabi.substack.com`**
(publication "Ketabi Studio", launched 07-05). Cross-link plan: the IG bio's
single link stays the WAITLIST (priority); Substack posts already funnel to the
waitlist in their sign-off; mention "full essay on our Substack" in occasional
captions. Consider a link-in-bio (Beacons/Linktree) later to hold waitlist +
Substack + shop together (needs owner setup).

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

---

# From One Root — premium relaunch (current state, 2026-07-05)

> This is the live social front. A new session should read this + the five docs
> in `content-tools/` (content-calendar.md, voice-style.md, QC-CHECKLIST.md,
> root-series-book.md, insight-bank.md) and it will know exactly where we ended.

## The series
"**From One Root**" (renamed from "The Root Series" on 07-05 after an originality
scan: the *facts* are public-domain scripture/linguistics — zero plagiarism risk —
but the name "The Root Series" collided with *The Root* media + *The ROOT Brands*
wellness, hurting discoverability. Owner may switch to the even-more-ownable
"**Three Letters**"; swap the wordmark everywhere if so). One Arabic/Qur'anic root
per post: reveal the shared root of several words, land on an emotional payoff.

## What's LIVE
- **ر ح م raḥma launch reel** posted 07-05 to IG (`instagram.com/reel/DabSmVvEw7B`),
  FB, and Threads (mirror worked). Its window/curtain background is **RETIRED**
  (never-repeat grid rule). Caption in `scratchpad/lux/reel/caption_rahim.txt`.
- Old `social_queue` was **cleared** (replace-mode enqueue). Queue currently holds
  only the launched reel.

## Strategy locked from REAL stats (via `GET /api/social/ig/stats`)
Followers ~1,584 (warming from a 2-yr dormancy). Best-ever reel = 2,033 views /
121 likes / 10 shares; best-ever carousel = 12 reach. So: **reels lead reach**,
carousels are a saves+grid play. The all-time hit was *relatable/relational*
("someone on your mind may be making dua for you" → people sent it to that
person). Account has **0 comments ever** → add reply-bait + seed first comment.
Rules that fall out: every root lands **fact → feeling → "send this to someone,"**
and every root ties to a **life moment + keepsake** (birth, marriage, grief,
home) — the moat an etymology page can't copy. Funnel: reel → bio link →
Substack subscribe (own the email) → waitlist → product; ~3 of 4 posts pure
value, every 4th soft product.

## The plan
`content-tools/content-calendar.md` = the full **30-day calendar (Jul 6–Aug 4)**:
12 roots (qalb, nūr, ṣabr, salām, jann[reframed], wadūd, ṣadaqah, shukr, khalq,
kitāb, īmān, dhikr), each = 1 reel + 1 carousel, weekly Substack essay ALSO
posted as a **Threads text-thread** (the format that over-performed). Owner set
cadence to **2 posts/day**, week starts the Monday after she approves the frames.
jann is reframed to jannah/janīn/junna (owner OK'd jinn if it's better; drop
majnūn either way; accuracy pass decides).

## PREMIUM visual system (owner approved "all 3 directions", 07-05)
- **Signature = GOLD Amiri** (not cream) with soft glow — biggest premium lift.
- Rotates 3 directions unified by the grade: (A) cinematic light, (B) jewel
  still life, (C) gold/textile minimal. Deep jewel grade recipe (documented in
  content-calendar.md): faded blacks `a*0.88+6`, warm `R*1.06 B*0.90`, desat
  0.80, contrast 1.06, bloom 0.12, strong vignette (edges→~0.25), grain ~7.
  Cream Amiri only on bright/gold bases (e.g. gold silk salām).
- **Skinless AND faceless** — owner flagged bare arms/hands as inappropriate,
  not just faces. Also: no fruit/dates/food, no six-point star (verify carved
  screens + lantern cutwork per frame), never repeat a background.
- **Locked background per root** (Pexels free-license id, or own asset) listed in
  content-calendar.md. Board renders: `scratchpad/premium/MONTH_premium_v2.jpg`.
  Source new stills with `scratchpad/pexels_fetch.py` (Pexels key inside);
  re-fetch `large2x`/`original` of the chosen id at render.

## Renderer state (IMPORTANT for the next build step)
The insight-reel renderer is `scratchpad/lux/reel/gen_insight_reel.py` (PIL/numpy,
browser-free, ~30s/reel, auto-uploads to `/api/social/video`). It already has the
**text-layer clipping fix** (Amiri descenders were being cut — size the layer to
the real glyph bbox) but the **premium grade + gold Amiri are only in the ad-hoc
board scripts so far** (`scratchpad/premium/*.py`). NEXT: fold `prem_grade()` +
gold glow text into gen_insight_reel.py, **commit it to `content-tools/`**, then
render Week 1 (qalb + nūr) as motion, QC per QC-CHECKLIST.md, show owner, schedule.

## Endpoints (all Bearer `CRON_SECRET` = `ketabi-cron-2027`)
- `POST /api/social/enqueue` `{posts:[{image_url,caption,platforms,scheduled_for}],replace?}`
  — replace:true wipes queued rows first. Refuses empty posts.
  - **CAROUSEL image_url = SPACE-separated list of image URLs** (the poster's
    mediaUrls() splits on `/\s+/`; isReel keys off a `.mp4` url; single url = photo).
    Images must be JPEG (IG rejects PNG) and each publicly reachable. Host slide
    JPEGs via `POST /api/cards/photo` (open, returns a public card-assets URL) —
    it only stores files, cannot affect the card product. 07-06: fixed
    lib/socialQc.ts (media-https/reachable checked the joined string, not each
    url) + confirmed space-separated is canonical. On QC block the row is set
    status='blocked' (inert, won't retry) — re-enqueue a fresh row to retry.
- `GET /api/cron/social` — ships all due posts (images/carousels first, reels
  last; IG+FB, best-effort Threads mirror). Triggered by GitHub Action
  `.github/workflows/social-poster.yml` (free Vercel cron is unreliable).
- `POST /api/social/video` — uploads an mp4 to Supabase card-assets, returns URL.
- `GET /api/social/ig/stats` — real reach/saves/shares/views per post.
- `POST /api/social/threads/delete` `{post_id}` — deletes a Threads post. NOTE:
  the current Threads token lacks the **`threads_delete`** scope, so this returns
  "Application does not have permission" (code 10). To enable auto-delete, owner
  must re-generate the Threads token WITH threads_delete added (User Token
  Generator / OAuth scope). Until then, delete stray Threads posts by hand.
  Threads carousels now post fully (publishThreads builds child containers).
- Comment reply systems LIVE both platforms: `/api/social/threads/replies` and
  `/api/social/ig/comments` (GET open comments, POST approved replies — "read, I
  draft, you approve, I post"). Threads creds in private storage bucket.

## Owner workflow rules (non-negotiable)
Approve **frames** (not videos) → week starts Monday → schedule 2/day but **show
owner before it goes live** → **run the full QC-CHECKLIST on every asset** myself
(accuracy w/ primary sources + verbatim graded hadith; Arabic RTL/diacritics
zoomed; no overlaps incl. end-card-clears-payoff; premium skinless visuals;
voice: no em dashes, His/Him capitalized, send-to-someone CTA). Nothing live
until verified; flagship pieces shown first.

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

# Etsy digital products (2026-07-06)

> Goal: sell UNIQUE, non-saturated personalized Islamic digital downloads. Etsy
> API key (`5ls9u9croiqu7q6klowiru15`) **APPROVED 2026-07-06** (status flipped to
> "Personal Access", 5 QPS / 5K QPD). API integration is BUILT (see below); needs
> a prod deploy + 3 activation steps to go live.

## Etsy API — BUILT (`lib/etsy.ts` + `app/api/etsy/*`), needs activation
OAuth2 + PKCE, mirrors the Threads pattern: keystring/secret/tokens live in the
private `social-config/etsy.json` bucket (NEVER git). Access token auto-refreshes
(1h life, 90-day refresh). Routes: `POST /api/etsy/config` (store keystring+secret,
Bearer CRON_SECRET), `GET /api/etsy/authorize?key=CRON_SECRET` (owner opens →
Etsy consent), `GET /api/etsy/callback` (token swap, the URL to register),
`GET /api/etsy/status` (Bearer, health check → shop name). `lib/etsy.ts` helpers:
`createDraftListing`, `uploadListingImage`, `uploadListingFile`, `publishListing`,
`getShopId`, `etsyFetch`. **Digital listing = `type:"download"`, taxonomy_id
68887887 (Digital Prints — verify).**
ACTIVATION (in order): (1) merge to main / deploy to prod (callback is hardcoded
to www.ketabistudio.com). (2) Owner registers `https://www.ketabistudio.com/api/etsy/callback`
as an app callback URL in Etsy app settings. (3) Claude POSTs /api/etsy/config
with keystring+secret (curl, Bearer CRON_SECRET=`ketabi-cron-2027`). (4) Owner
opens /api/etsy/authorize?key=ketabi-cron-2027 and approves. (5) Claude verifies
via /api/etsy/status. Then listing creation is fully automatable.

### STATUS: LIVE + working (2026-07-06)
Connected to shop **KetabiStudio (shop_id 48938263)**, token auto-refreshing.
Full CRUD confirmed end-to-end. TWO GOTCHAS learned the hard way:
- **`x-api-key` MUST be `keystring:shared_secret`** (colon-separated), NOT the
  keystring alone — else every authed call fails with "Shared secret is required
  in x-api-key header" and getShopId silently returns null.
- **Legacy personalization fields are DEPRECATED** on the listing PATCH
  (`is_personalizable`, `personalization_is_required`, `personalization_char_count_max`).
  Setting "required" now needs Etsy's dedicated personalization endpoints
  (developers.etsy.com/documentation/tutorials/personalization-mig) — not yet
  built. Owner can toggle "Required" by hand in the listing editor.
`POST /api/etsy/listing` (Bearer): CREATE mode (pass `listing`) or EDIT mode
(pass `listing_id` + `update_fields`/`images`/`file`). Assets inline base64
(keep payload <4.5MB — JPEG ~1600px, NOT PNG which blew to 38MB). Creates DRAFTS
by default; only publishes if `publish:true`. **Listings (check before creating — DON'T duplicate):**
- 4533437576 — name print (LIVE, 5 imgs, $13). Title now front-loads "Quran Name Meaning" (39-competitor gap).
- 4533400292 — dua deck (LIVE).
- 4533510568 — Qur'an teacher gift keepsake (DRAFT, $13, hadith Bukhari 5027).
- 4533497225 — Hajj Mabrūr keepsake (DRAFT, $13, hadith Bukhari 1773/Muslim 1349).
- 4533503399 — Muslim baby birth keepsake (DRAFT, $13, Qur'an 37:100 Ibrahim's du'a).
- 4533517158 — Family blessed-home print (DRAFT, $13, Qur'an 23:29 Nuh's du'a).
- 4533517194 — Islamic nursery child-protection print (DRAFT, $13, Sahih Muslim 2708).
- 4533521396 — Dua for Parents print (DRAFT, $13, Qur'an 17:24).
- 4533507807 — Muslim wedding "mawaddah wa rahmah" print (DRAFT, $13, Qur'an 30:21, mushaf spelling).
- 4533521470 — Get Well / Shifa print (DRAFT, $13, Sahih al-Bukhari 5656).
All 5 keepsake drafts: 3 imgs (framed mockup + ivory + dark) + how-it-works file,
personalization NOT yet enabled (Etsy deprecation → owner toggles by hand).
Content ALL verified by adversarial pass (hadith + ayat verbatim, translit fixed).
Keepsakes rendered by `content-tools/etsy/gen_keepsake.py` (verified hadith,
ivory+dark, personalized dedication line). Renders via `render_keepsake(entry,out,theme,sc)`.
**Personalization can't be set via API** (Etsy deprecated the legacy fields on
BOTH create and update) — owner toggles "Personalization: On + Required" by hand
in the editor for the 3 personalized listings. Title rule learned: "&" allowed
only ONCE per title. Etsy market-competition counts (supply, not demand): "quran
name meaning" 39, "hajj mabrur gift" 7, "quran teacher gift" 333 — all low.

## PRINT-FILE RULE (non-negotiable)
No "claude", "AI", "Anthropic", or any tool name in filenames OR PDF/PNG
metadata — owner's rule ("so people can't see"). All generators set PDF
title/author/producer/creator = "Ketabi Studio". Verify each deliverable:
`grep -ai "claude\|anthropic\|openai"` + check `fitz` metadata + confirm no
AI provenance in extractable text (compressed-stream byte-hits on "AI" are
fine; readable text must be clean).

## Product 1 — "A Name Written Into the Qur'an" (personalized name print) — BUILT
The wide-open, first-mover product. Wins NOT on meaning (parents often know it)
but on the **verified Qur'anic connection** (the cited ayah the name's root sits
in) + new-baby/Aqiqah gifting. Files in `content-tools/etsy/`:
- **`gen_name_print.py`** — premium ivory 4:5 renderer. Gold Amiri name sized to
  true glyph bbox (harakat never clip), measured vertically-centered stack,
  auto-wraps so nothing overflows the border. Root letters render in **Amiri**
  (Latin fonts show them as tofu boxes — the bug that was fixed). `render_name(entry,out,sc)`.
- **`name_data.py`** — verified name library (`NAMES` dict, `LAUNCH_SET`). Every
  entry source-checked vs quran.com by an adversarial verify pass (it caught
  Yusuf's citation — 12:3 doesn't hold the name — now reframed). **THREE honest
  tiers, NEVER blurred:**
  - `tier "in"` — name literally in the Qur'an (Maryam, Yusuf, prophets, Zayd) →
    tag "A Name Allah Placed in the Qur'an".
  - `tier "root"` — name's root appears in a cited ayah (Noor, Aisha, Huda…) →
    tag "A Name Written Into the Qur'an", "from the root ___". NEVER say the name
    itself is in the Qur'an.
  - `tier "meaning"` — Arabic name whose root is NOT in the Qur'an (e.g. Aws) →
    tag "The Meaning of a Name": root + meaning + verified heritage note, **no
    ayah, no Qur'anic claim ever**. This is how any Arabic name is accepted.
  Accuracy guardrail: never conflate "root appears in the Qur'an" with "name
  appears in the Qur'an." 24 names live; **grow the library on demand** (owner's
  call) — each new name source-checked before it ships.
- **`gen_name_deliverables.py`** — `make_howitworks_pdf()` (the small branded PDF
  Etsy auto-delivers on purchase; real custom file sent per order), `make_frame_mockup()`
  (matted frame on soft wall = listing hero), `make_print_files()` (per-order
  print-ready PDF at 5x7/8x10/A4 300dpi + framing PNG). Needs
  `from PIL import JpegImagePlugin; Image.init()` (JPEG codec).
- **`listing-guide-name-print.md`** — full Etsy copy (title/tags/description) +
  the 3-tier delivery model. **Pricing = an Etsy Variation "Print style":**
  "With verified ayah $14" / "Name & meaning $9". Personalization ON, made-to-
  order, 1-business-day processing. Buyer types any name → we render + send in 24h.

## Product research (2026-07-06, IN FLIGHT)
Owner (rightly) pushed back that nikah prints, khatm certificates, shahada
keepsakes, name-tracing sheets are **all already saturated** on Etsy — my first
pitches were intuition, not data. Running a **deep-research** workflow on real
Etsy saturation + genuinely underserved premium gaps + whether the name-ayah
concept is already common. NEXT: read that report, then pitch only concepts the
data supports (differentiation = own the premium/verified-depth top of a crowded
category, not chase "empty" niches that don't exist at Etsy's scale).

# Gumroad (2026-07-06) — second sales channel
Connected via a **personal access token** (owner generated it; used directly against
`api.gumroad.com/v2` — NO server code, nothing to deploy). Token is NOT in git;
if it leaks, regenerate in Gumroad app settings. Account: ketabistudio.gumroad.com.
- **Product create/edit/delete WORKS via API** (`POST/PUT/DELETE /v2/products`).
- **File upload flow** (the API tells you if you guess wrong): `POST /v2/files/presign`
  {filename, file_size, content_type} → PUT each part to the returned S3 `presigned_url`
  (capture ETag) → `POST /v2/files/complete` {upload_id, key, parts:[{part_number,etag}]}
  → attach with `PUT /v2/products/:id` `files[][url]=<complete's file_url>`.
- **Cover image CANNOT be set via v2 API** (preview_url/cover_url/asset_previews all
  silently ignored) — owner drags the cover in via the Gumroad UI.
- **Custom fields (personalization) CAN be set via API** — dedicated resource, NOT a
  product param: `POST /v2/products/:id/custom_fields` {name, required} ·
  `GET` same path · `DELETE /v2/products/:id/custom_fields/:NAME` (by field NAME,
  url-encoded, not id). `custom_receipt` IS a plain product param on PUT.
- **Personalized flow on Gumroad:** required custom field collects the name at
  checkout → value appears on the sale (`GET /v2/sales`) → render + email the
  real file within 24h; the instant download is the how-it-works welcome note.
- **Fit note:** Gumroad = instant download, so ONLY fixed products (dua deck), NOT the
  made-to-order personalized prints.
- **Products created (all UNPUBLISHED, pending owner cover-upload + publish):**
  - Dua deck — id `kyS7fZV9SquPoD7HiZnekg==`, `/l/pjekt`, $14, 3 files.
  - Names Written Into the Qur'an (24-name collection PDF+zip) — `MLWYiEIeUP8gKUm5kxmeEw==`, `/l/iimpcu`, $14.
  - Ayat for the Lock Screen (8 verified du'a/ayah wallpapers) — `lpkBCxnNjTKdBVfvqSrfew==`, `/l/odbbf`, $6.
  - Personalized name print — `QR2k-3a5T4dMqJEQSRqcMw==`, `/l/hztxdz`, $14,
    REQUIRED name custom field set via API, made-to-order receipt set, how-it-works
    PDF attached. Owner: cover + publish only.
  All fixed (non-personalized); wallpapers/names repurpose the verified renderers.
  Light editorial covers rendered v3 (contained cards, unified soft shadow, bottom
  breathing room — owner uploads each in the Gumroad UI). custom_receipt set on ALL products via API.

## Etsy Deck 1 — "For the Hard Moments" dua deck (PUBLISHED, likely saturated)
`content-tools/etsy/deck_data.py` (`DECK1` = 14 verified duas) +
`content-tools/gen_dua_card.py` (ivory+dark renderer, auto-fit long duas) +
`listing-guide-dua-deck.md`. Owner published it but flagged adhkar/dua decks as
saturated — deprioritized in favor of personalized. Deck 2 (adhkar) parked; see
`ACCURACY_FLAGS` in deck_data.py (drop the da'if 7x-reward claim if ever built).

# LAUNCH STATE (2026-07-07) — everything is LIVE

## The storefront (10 products, 2 platforms)
**Etsy (KetabiStudio, shop_id 48938263):** name print 4533437576 · dua deck
4533400292 · **From One Root journal 4533628130 ($19, 16.9MB PDF attached via
direct API, byte-verified)** · plus the 8 keepsake listings (teacher/hajj/birth/
home/protect/parents/wedding/getwell — see IDs above; palette designs, $13).
**Gumroad (5, all published, ROOTS20 = 20% off code live on all):** dua deck
/l/pjekt · names collection /l/iimpcu · lock-screen wallpapers /l/odbbf ·
personalized name print /l/hztxdz (REQUIRED name field) · journal /l/bzwxm $19.

## The journal (flagship, both platforms)
`content-tools/etsy/{journal_data.py, gen_journal.py, build_journal.py}` →
64-page US-Letter PDF. 30 verified roots (two adversarial passes; hubb/"seed"
REJECTED as fake etymology; day-9 "three times", day-15 "restrain" fixes).
Writing pages use measured auto-fit + render-time asserts + pixel guard-band
scan (ALL 30 overflowed before — never eyeball layout, MEASURE). Title page has
© notice. "Lexicon" wording varied per page (owner: sounds biblical).
Never claim bare "first of its kind": Quran Trace's "Quran Roots" journal is
adjacent (root-based vocab journal). Safe framing: "I have never seen anything
like it" / "the first 30-day one-root-a-day devotional with verified etymology".

## Launch marketing shipped (2026-07-07)
- Threads text post (owner-posted) + launch REEL on IG/FB/Threads.
  IG: instagram.com/reel/DaeKGVZjBv7 (sabr hook → journal reveal; bg = Pexels
  14503515 rain-window, now USED/retired; hires at scratchpad/premium/hires_sabr.jpg).
- Reel CTA = "comment ROOT for the link" → reply via the comment system; canned
  reply text in session notes. TikTok bulletin copy delivered to owner.
- Reel renderer lesson: MEASURE every caption line (PlayfairIt 74px, max 960px
  wide) before render; three lines clipped at first pass.

## HARD-WON GOTCHAS (do not relearn)
- **Gumroad wipes a product's FILES whenever the owner edits it in the UI**
  (cover drag, etc.). After ANY UI edit: re-check files on all products and
  re-attach via presign flow. Happened 5+ times.
- Gumroad v2 API: CAN set bio (PUT /v2/user {bio}), custom_receipt, offer codes
  (POST /products/:id/offer_codes {name,amount_off,offer_type:percent}), custom
  fields (dedicated endpoint; DELETE by NAME). CANNOT set covers or publish.
- Poster platform aliases: social_queue.platforms must be `ig,fb` (aliases
  instagram/facebook now normalized in cron/social — they used to silently
  match NOTHING and the post shipped Threads-only, which is how the launch reel
  initially missed IG/FB).
- Out-of-band publishing: `GET /api/social/token` + `GET /api/etsy/token`
  (Bearer CRON_SECRET) return live creds so big uploads / long video processing
  run from tooling, not serverless. IG reel flow: POST /{ig}/media
  media_type=REELS → poll status_code=FINISHED → /media_publish.

## SALES PLAYBOOK (current levers)
Owner-side: Etsy sale 15-20% 2wks + Etsy Ads $2-3/day (journal+name print) +
share to personal groups (early velocity → Etsy algo) + reply to ROOT comments
fast. Claude-side: comment-reply drafts, more reels from journal roots (every
root = an ad), Substack essay per week ends with journal CTA, watch
/api/etsy/orders (needs one re-auth for transactions_r — STILL PENDING) and
Gumroad /v2/sales for personalized orders to render+deliver.

---

# LIVING DICTIONARY REBRAND + SOCIAL ENGINE (2026-07-07, evening)

Owner felt the beige/gold/Playfair look (and the dark filmic social posts) read
as "AI / same as everyone" (esp. vs niyatapp.com, an adjacent Islamic app). New
content identity = **"A Living Dictionary"**: ink on warm paper, editorial serif
(Cormorant italic for the shareable line, Lora for defs), oxblood/terracotta
accent, NO photo-quote formula. The SITE palette (forest/cream/gold in
`app/globals.css`) is KEPT per owner ("I kind of like what I have"); only a
luxury-font swap is pending + shown-first.

## Renderers (content-tools/)
- `gen_dictionary_card.py` — the daily Threads card. 1080x1350, root letters
  (RTL, verified from `journal_data`), per-letter translit (ayn/hamza = clear
  apostrophe, option B), numbered real definitions + heartfelt line (both
  HAND-WRITTEN in the `CONTENT` dict — do NOT auto-extract from story, that
  shipped nonsense once), footer tagline "the language of the Qur'an, one root at
  a time" + source citation. `build_all()` renders all 30.
- `gen_dict_carousel.py` — IG/FB 4-slide carousel (hook / meaning / line / CTA),
  same identity. CTA slide can pitch the journal.
- `gen_dict_reel.py` — LIGHT reel (kinetic typography on paper), replaces the old
  DARK `gen_root_reel.py` (that dark style is retired — off-brand now). Scenes:
  root -> meaning -> line -> journal CTA. ~11s, cross-faded, subtle zoom.
- `gen_varied_mockup.py` — Etsy listing heroes with a bold readable headline +
  benefits callout (thumbnail-legible). LIVE on all 9 listings.
- Reel COVERS: `gen_reel_cover.py` (30, gold Amiri, unique bg each).

## What is LIVE / SCHEDULED
- **Etsy:** 11 titles rewritten (front-loaded buyer phrases, Aug-2025 SEO) +
  9 captioned varied mockups pushed live as rank-1 heroes.
- **Threads schedule:** 30 dictionary cards, 1/day at **22:00 UTC (5pm CDT)**,
  Jul 7 (fitra) -> Aug 5. Order front-loads wide-resonating roots; **rahma +
  qalb LAST** (owner felt overdone). platforms=`th` only.
- **IG/FB:** moving to 2/day — carousel 13:00 UTC (8am CDT) + reel 19:00 UTC
  (2pm CDT). First carousel (sabr) went out 07-07. Reels render in batches
  (video ~2min each). Old dark qalb reel to be PULLED.
- **Substack:** 30 paste-ready Notes (`substack_notes_month.md`).

## Poster changes (app/api/cron/social) — all merged (PR #90/#91/#92)
- Threads gated on `platforms.includes("th")` so ig,fb stays OFF Threads.
- IG reel `cover_url` = 2nd (image) URL space-separated in `image_url`.
- 4 cron windows (10/13/19/22 UTC) in vercel.json + GH action.
- `/api/social/photo` gated image host (also reuse live `/api/cards/photo`).
- HEIC decode in worker (pillow-heif); storybook price-display fix.

## Journal promotion (in progress)
Carousel/reel CTA slides pitch the journal ("one of thirty roots, full journal on
Etsy"); ~1-in-5 sell ratio; weekly journal spotlight planned.

## PENDING when owner usage resets (owner asked, deferred honestly)
1. Journal LANDING PAGE on own site + **Stripe checkout** (Substack voice, link
   Substack). 2. Journal section on `/coming-soon`, pretty. 3. **SEO** (titles,
   meta, OG, keywords). 4. **Luxury font** on live site (show-first). 5. Root-TREE
   branches back on cards (needs the derived-word verification agent — it hit the
   session limit; do NOT ship unverified Arabic). 6. Batch remaining reels +
   carousels for the 2/day IG.

## HONEST verdict logged — "Muslim intentional travel guide/journal" idea
Owner asked (07-07). NOT blue-ocean: Muslim city guides (HalalTrip etc.) +
travel journals (one of Etsy's most saturated categories) both exist; "aesthetic
Muslim travel journal" lane has players. Bigger issues for Ketabi: departs from
the verified-language moat, heavy/again-stale accuracy burden (brand promise is
"every source cited"), and splits focus mid-launch. Advice: not next; sell the
journal first; a "bridge" product should EXTEND the language edge. Offer standing:
run the adversarial refute-search (like the journal "first of its kind" check)
before any build.

# FULL-STACK COMMERCE DAY (2026-07-09) — journal final, physical books on Etsy, cards pivot, coil pipeline

## Journal "From One Root" — FINAL edition (digital 68pp + coil print 70pp)
- **Writing pages** (`content-tools/etsy/gen_journal.py render_writing_page`):
  top-anchored under the day header, **8.6mm wide-rule pitch (68px @200dpi)** —
  owner tested 7.4mm college rule and found it too tight to write on. Lines are
  solved as a page TOTAL then distributed across prompts (no per-prompt floor
  loss). Overflow asserted. Audit script pattern lives in the session scratchpad
  (`audit_journal.py`): pitch uniformity, margins, rule extents, all measured.
- **worked_day page REMOVED** (owner: repeated the how-to; same call as the
  scholarly-insight page). Digital build (`build_journal_v2.py`) = **68 pages**.
- **Coil print edition** (`content-tools/etsy/build_journal_print.py`) = **70
  pages**: front matter is 5 pages (title, how-to, glossary, tracker, "This
  journal belongs to") so every day is a facing spread (story LEFT, writing
  RIGHT); ends sources a/b, certificate, 2 Notes pages. Content scaled 94% and
  shifted off the binding edge so coil punches never hit the gold border.
- **Certificate wording** (owner-approved): "Carried, one root at a time, by …"
  / closing "May the words you have carried now carry you."
- Etsy digital file replaced on ALL THREE listings with the wide-rule 68pp PDF;
  descriptions corrected (68 pages, no "worked example" claim).

## Etsy journal listings (all live, $12.99, video + hero on each)
- Core `4533628130` + **Sibling A** `4535255995` (Quran study/Arabic-learning
  keywords) + **Sibling B** `4535258927` (new Muslim / revert gift keywords).
  Siblings are legit differentiated listings (distinct titles/tags), not dupes.
- Listing video `build_journal_video.py` (9s page slideshow, real pages only);
  square hero `build_journal_hero.py` (cover + fanned inside pages + accurate
  badge). Etsy quirk: a new image uploaded with rank 1 does NOT displace the old
  rank 1 — re-POST every listing_image_id with explicit ranks to reorder.

## Physical books on Etsy — Maryam/Juha pilot (DRAFTS, automation LIVE)
- Draft listings: **Maryam `4535335357`**, **Juha `4535351858`** — $29.99, free
  US shipping (existing "Free" profile `243316412479`; creating profiles needs
  `shops_w` which the Etsy token does NOT have), `readiness_state_id`
  `1402406915841` (reused from an old draft — required for physical listings).
  Owner set 1–2wk processing in Etsy UI. Publish = owner's call.
- **Order watcher** `app/api/cron/etsy-orders`: reads paid+unshipped receipts,
  maps LISTING_TO_SLUG, inserts into `orders` at **status=pending** (same entry
  point as a paid Stripe order → worker generates → awaiting_approval → owner
  approves). Idempotent on `options.etsy_receipt`. Etsy hides buyer email/phone:
  uses `ETSY_NOTIFY_EMAIL` (default gmail) + `ETSY_FALLBACK_PHONE`.
- **⚠️ HOBBY CRON GOTCHA (cost ~1h of "stuck deploys")**: Vercel Hobby crons run
  at most ONCE PER DAY. A `*/6` schedule in vercel.json made Vercel silently
  reject EVERY deploy (build succeeds locally, GitHub hook fires, site never
  updates). Fix: daily cron (15:30 UTC) + the social cron calls etsy-orders at
  the end of each of its 4 daily runs (best-effort fetch, non-fatal).
- Etsy scopes: `listings_r/w shops_r transactions_r` — can READ orders; CANNOT
  push tracking (`transactions_w`) or create shipping profiles (`shops_w`).
  One re-auth adds them later.

## Journal COIL edition in the fulfillment pipeline — Lulu-VALIDATED
- Worker (`worker/worker.py`): `JOURNAL_SLUG="from-one-root-journal"`,
  **`COIL_POD="0850X1100.FC.STD.CO.060UW444.MXX"`** (8.5x11 FC standard coil,
  60# uncoated white — right paper for handwriting, matte cover).
  **CONFIRMED by Lulu's own validators: interior + cover both NORMALIZED**, and
  real cost calc: **print $10.88 + MAIL ship $5.69 = $17.32** (owner's addr).
- Interior ships in the repo: `worker/assets/journal/Journal_interior.pdf`
  (70pp, 8.75x11.25in bleed, 300dpi, q68 JPEG via img2pdf) + cover art PNGs.
- **Cover is assembled AT RUN TIME** (`generate_journal`) to Lulu's
  `/cover-dimensions/` answer — for this POD Lulu wants a ONE-PIECE
  17.25x11.25in sheet (1242x810pt): back left half, front right half. Never
  hardcode coil cover dims.
- `qc.gate_spec` grew `trim_in=(w,h)` + `cover_mode="lulu"` (plausibility only;
  Lulu's validate gate is authoritative). Defaults unchanged for all old books.
- `generate_journal` writes **`qc_report.reference.lulu_cost` for ALL levels**
  (MAIL/GROUND/EXPEDITED/EXPRESS) so the owner picks speed with real prices;
  `submit_approved` honors `options.shipping_level` (whitelisted, else MAIL).

## Owner test-order tooling (payment bypass)
- `POST /api/admin/test-order` (Bearer CRON_SECRET) `{book_slug}` → inserts a
  pipeline order at status=pending (NO Stripe; Lulu bills on approve). Shipping
  auto-copied from the owner's most recent complete order. Slug whitelist.
- Same route: `{action:"cancel"|"reset", orderId}` (reject / reprocess), and
  `GET ?id=` or `?slug=` for status + qc_report readback.
- Journal test order `29dfccd5-…0688` validated end-to-end; reset to reprocess
  with the wide-rule interior after the Render rebuild.

## Digital cards — physical RETIRED, $2 flat, audited
- Physical greeting cards retired (owner's test card arrived scuffed; dark
  matte + paper mailer = baked-in failure). Shop tile removed, footer repointed,
  `/cards` route → redirect `/digital-cards`. Card Studio page deleted.
- **$2.00 flat, voice note INCLUDED** (`VOICE_ADDON_CENTS=0`; checkout skips
  zero line items). Signature "— Name" on cards kept deliberately (real
  signature dash, exempt from the no-em-dash rule).
- **Photo upload fix**: iPhone photos (large/HEIC) blew Vercel's 4.5MB body
  limit → 413 before the route ran → generic "Network error". Builder now
  shrinks + re-encodes to JPEG in-browser (canvas, max 1800px). NOTE: keepsake
  builder still uploads originals — needs a direct-to-storage path before
  keepsakes scale (print needs high-res).
- **Colors**: every card now offers the full 14-tone `ALL_COLORS` accent palette
  (card's own default first) + a proper "Card colour" picker; the 4 scheme
  swatches were relabeled "Background". (Bug: nikah showed rose in gallery but
  accent had NO picker at all.)
- `POST /api/digital-cards/test-send` (Bearer CRON_SECRET) `{token, to}` — send
  the real recipient email for a card WITHOUT payment (flips that order paid so
  the viewer renders). Owner-tested to her inbox.

## Shipping-time honesty (site copy)
- `lib/books.ts PRINT_SPEC` grew `leadTime/delivery/deliveryFriendly`; book page
  spec list + price-row note + checkout copy now state: ships in 1–3 business
  days; US 5–10 days, intl 10–21; "about 2 weeks US". Keepsakes builder: 2–3wk
  US / 3–5wk intl (hardcover is slower). Mirrors the Shipping policy page.
- ALL customer-facing em dashes removed site-wide (pages, card UI, emails,
  mailto subjects). Remaining em dashes are code comments only.

## Ops notes
- Journal print files for manual Lulu upload were also delivered to the owner
  (interior compressed <30MB for chat; the WORKER asset is the q68 authority).
- Etsy scam pattern logged: "is this available / do you accept payment through
  Etsy" emails to the shop gmail minutes after publishing = bot scrape of the
  site's mailto links. Rule: never move payment/conversation off Etsy.
- Owner email is plaintext mailto across the site (owner chose to keep it).

# SOCIAL RESET (2026-07-10) — new signature ayah style, old automation retired

- **148 queued posts cancelled** (owner call: old carousel/root strategy dead —
  carousels reached 3-10 people; reels 109-326). Poster infra kept, queue empty.
- **New signature: photographic ayah wallpapers** (`content-tools/
  gen_ayah_wallpaper.py`): real Pexels photography, deep global fade + grain,
  whisper-scale Arabic (Amiri; Aref Ruqaa for short display verses), tiny
  italic Clear Quran translation, tracked citation, KETABI mark. Text is
  AUTO-PLACED into the calmest darkest band (measured); adaptive ink mode for
  pale zones. QC gates assert centering/margins/legibility per render.
- **PHOTO POLICY (owner-set, in renderer header + PHOTO_MANIFEST)**: modesty
  always; NO people (only exceptions: prayer-mat object, or unrecognizable
  salah silhouette); nature/animals/skies/REAL mosques only; NO tombs or
  monuments (Taj Mahal = mausoleum, rejected); real photography only, no AI
  imagery; never repeat a background. Every photo logged in PHOTO_MANIFEST.
- **Verses must be verified against quran.com before render** (Arabic letter
  by letter + Khattab translation verbatim; excerpting cited by ayah).
- Caption format (owner-picked): verse + translation + citation, then
  `pc: ketabistudio.com`, then ~5 hashtags. Threads: same minus hashtags.
- First test post (20:114 dark sea) got a like + repost within minutes.
- Approved library so far: sea/20:114, horizon/26:62, lantern/2:186,
  mushaf/17:82, crescent/11:88, sunset-minarets/2:186, dusk-dome/3:173.
- Planned cadence when owner green-lights the batch: 2 reels/day IG+FB,
  4 Threads/day; grid checkerboard maintained via alternating cover tones.

# AUTOPILOT WEEK (2026-07-10) — Threads + Reels fully scheduled

- **Threads week 1 LIVE**: 28 posts queued (4/day, Fri Jul 10 - Thu Jul 16;
  6:30a/12p/5:30p/9p Central), `platforms=th`. Every verse machine-verified:
  Arabic SLICED from quran.com uthmani text (never typed), English excerpts
  containment-checked against Clear Quran (rid 131). 28 unique hand-checked
  photos (batch record: `content-tools/threads_batch_2026-07-10.json`).
  Renderer grew a glyph-coverage guard (uthmani superscript letters fall back
  Ruqaa→Amiri; tofu can never ship). Owner's cron-job.org hits
  `/api/cron/social?key=CRON_SECRET` (works; "nothing due" verified + 6:30a
  al-Kahf post fired on schedule).
- **IG/FB Reels weeks 1+2 LIVE**: 42 silent reels queued (3/day at
  10a/2:30p/8p Central; wk1 Jul 10-16, wk2 Jul 17-23), `platforms=ig,fb`.
  `content-tools/gen_ayah_reel.py`: hook → verse → From One Root end card
  ("DIGITAL DOWNLOAD ON ETSY · linked in profile"), drop-shadowed type +
  scrim, cinematic grade, -stream_loop so short clips never freeze, ~3MB/-an
  encode (silent by design: owner call, "Muslims don't want music anyways").
  All 42 clips 4K, frame-checked for people (rejected: person releasing
  lantern, person in boat, jack-o'-lantern, wet-floor-sign mosque). No ocean
  clips (owner: vary the aesthetic). Batch records:
  `content-tools/reels_batch_2026-07-10.json` / `reels_batch_2026-07-17.json`.
- **First reel force-published** 7:19a Jul 10 via new `{promote}` action on
  `/api/social/enqueue` (reschedules one queued post by its media URL — no
  duplicate risk): instagram.com/reel/DanLY2GjP2R.
- `/api/social/video` hosts reel MP4s (multipart, Bearer CRON_SECRET, public
  card-assets URL ending .mp4 = poster's reel signal).
- `lib/threads.ts threadsText()` no longer appends the domain footer when the
  caption already credits ketabistudio.com (the pc: line) — no double link.

# INSTAGRAM DESIGN SYSTEM (2026-07-11) — "We The Urban, but ours" (IN DESIGN, not yet queued)

Owner wants an Instagram text-post account in the register of We The Urban
(Willie Greene's affirmation page: bold serif, textured backgrounds, daily
shareable one-liners) but Islamic, with our verified-source discipline. Goal:
own the lane no Islamic reminder page currently owns (native-internet voice +
scholar-grade citations + Arabic calligraphy as the unfair advantage). Design
explored in scratchpad, approved LOOK pending before building the generator.

## The type system (locked after several rounds with owner)
- **Loud bold serif fills the frame** — Liberation Serif Bold (Times family)
  caps, auto-fit to ~880px width, tight leading (~1.04). Owner rejected
  Playfair-in-caps as "too fashion magazine" and regular-weight as "not loud
  like wetheurban." Bold Times caps = the WTU weight, reads as announcements.
- **Italic serif for the soft/whisper lines** (Liberation Serif Italic).
- **Arabic is the hero, never overlaid on English** — owner rejected the
  Dana-Salah-style Arabic-over-English interlace ("needs work"). Aref Ruqaa
  (calligraphic) for hero words, Amiri Bold for dhikr walls / readability.
- **Backgrounds: woven-canvas texture + vignette** (numpy warp/weft sinusoids
  + grain + slubs + radial vignette + soft top light), NOT flat color. This
  was the key "more textured / 2027 best practice" fix.
- Constants: gold diamond divider, `K E T A B I   S T U D I O` tracked mark
  bottom-center every post, rotating linen colorways (cream/forest/terra/rose/
  olive/plum/sand/black-green) so a colorful feed still reads unmistakably ours.

## The 8 formats (Islamic versions of the WTU playbook)
1. **Dua carousel** (silent, multi-slide) — "May Allah heal what you never talk
   about." / *Ameen.* Caption: "send this to someone you love." Biggest
   share-driver: sending it IS the good deed.
2. **Series opener** — "IN CASE / NO ONE MADE DUA / FOR YOU TODAY" → swipe to
   dua slides. Reposting = making dua for someone.
3. **Anaphora** — "ALLAH HAS ALWAYS heard you / seen you / provided / BEEN
   ENOUGH" (final line flips to gold italic).
4. **Open letter** — "to the one carrying something heavy," (letters to the
   tired, the new Muslim, the one who missed Fajr).
5. **Seasonal blessing** — "Praying for a soft Muharram." + Jummah Mubarak,
   white days, Ramadan. A whole Islamic-calendar layer WTU cannot touch.
6. **Future-self** — "One day you will wish you had one more chance to be
   patient. This is that chance."
7. **Normalize** — "NORMALIZE saying Alhamdulillah before anyone asks how you
   really are."
8. **Type Ameen** — Arabic اللهم آمين hero + dua + outlined "type AMEEN below"
   pill. The most native engagement mechanic in the niche.
   Plus **Dhikr Wall**: a dhikr phrase (الحمد لله) tiled in Amiri down the page,
   the English closing line ("for it all.") as the last row. Repetition = dhikr,
   so form and meaning are one. Owner's favorite.

## HARD content guardrails (unchanged from all other channels)
- Tiled/remixed text is ALWAYS dhikr or our own words, NEVER a Quran verse.
  Revelation appears once only, quoted verbatim + cited on the placard layout
  (verses machine-verified against Clear Quran rid 131, same pipeline as
  Threads/Reels). No music/lyrics/artist refs. His/Him/He capitalized. No em
  dashes. No "universe/energy/manifest" language played straight.
- Research sourced: We The Urban is Willie Greene's affirmation page (1B+ IG
  impressions, book + 2026 calendar off the same posts). Islamic reminder-page
  landscape checked: @muslim (7M, news aggregator), @islamicdailyremindersss
  (134k), @muslimah_reminder (106k) — all pastel-graphic, none own the WTU
  editorial format. Lane is open.

## Scratchpad artifacts (design iterations, not in repo yet)
`ig_loud.py` (final loud+textured direction), `ig_formats.py` (all 8),
`ig_dhikr_wall.py` (dhikr walls), `ig_arabic_hero.py`, `font_compare.py`.
NEXT once look approved: fold into a generator like `gen_ayah_reel.py`, wire to
`/api/social/photo` + `/api/cron/social` (platforms=ig,fb), queue alongside
reels. Threads week 2 (28 posts, We-The-Urban voice, Jul 17-23) also written +
approved-pending, must queue before Thu Jul 16 (queue empties then).

# LAUNCH REDESIGN (2026-07-11) — "Made to be kept"

New brand line **Made to be kept** across the site; each product world given
equal weight; the live cover personalizer moved above the fold (the winning
product). Everything below is LIVE behind the coming-soon gate; prices remain
on `TEST_DOLLAR_PRICING` ($1) and the gate is untouched.

- **Home** (`components/HomeLanding.tsx` + `.module.css`): aura-gradient
  ground, glass panels, "Their name. Their story. Kept for life.", the real
  `<Personalizer/>` above the fold, four product-world ribbons (Books /
  From One Root journal → Etsy / Digital cards / Photo keepsakes), worldwide
  shipping announce + honest delivery note, mobile-first (360/768/1280).
- **Shop** (`app/shop/page.tsx`): hero "Made to be kept", journal tile added
  (Etsy instant download), "we ship worldwide".
- **Header** (`components/Header.tsx`): four-worlds nav + Shop CTA + real
  full-screen mobile menu. NB: no backdrop-filter/transform on `<header>` — it
  creates a containing block that collapses the fixed mobile sheet; the blur
  lives on an inner `.barWrap`.
- **Footer** (`components/Footer.tsx`): brand-only, three columns
  (Shop/Studio/Help), NO location or personal details, worldwide line.
- **Trust layer** (`components/TrustLayer.tsx`): studio promise + FAQ
  accordion (personalization, shipping, worldwide, sourcing, damage
  guarantee). Brand-only — no names, no place. On the home page.
- **Product pages** (`app/books/[slug]/page.tsx`): mobile **sticky buy bar**
  (`components/StickyBuyBar.tsx`) — price + one-tap Order/Personalize,
  appears after the hero, mobile only; label reflects personalized vs fixed
  (accuracy: only `her-beautiful-hijab` is personalized). Product JSON-LD
  (schema.org Product/Offer) for Google rich results. "We ship worldwide".
- **Keepsakes** (`app/shop/keepsakes/page.tsx` +
  `components/KeepsakePicker.tsx`): rebuilt as a **"Who is it for?"** picker
  (Mama/Baba/Grandma/Grandpa/Spouse/Baby/Ramadan); tap a person → only that
  keepsake unfolds. Page height 14,572px → 5,970px (~60% shorter).
- **Cards**: already a clean 3-step wizard (occasion / relationship groups);
  only needed the new global chrome.
- **Fonts**: unified to **one display serif (Playfair Display)** site-wide.
  Dropped Fraunces; `--font-display` aliased to `--font-playfair` in
  `globals.css` (on `body`, where the font className sets the var). Kept
  Cormorant (keepsake print match), Amiri + Baloo (Arabic), Jakarta (body).
- **Share/SEO**: `app/opengraph-image.png` + `twitter-image.png` (1200x630
  branded card); `app/robots.ts` (allow public, block admin/api/c/order);
  `app/sitemap.ts` (all public + product URLs); metadata refreshed to the
  new brand copy; twitter summary_large_image.
- **Subdomain**: `app.ketabistudio.com` host route in `middleware.ts` serves
  ONLY `/app` ungated (app-store links always load); other paths on that host
  stay gated. Needs the domain added in Vercel (owner action / connector).
- **PII scrub**: removed a hardcoded home address from the retired
  `app/api/cards/gelato-setup/route.ts` (generic placeholder now). Full sweep
  of app/components/lib is clean of personal info.

## Owner to-do (out of my hands)
- **Lulu packing slip**: the journal proof already ordered shows a TOFU
  SQUARE in the thank-you line — that's Lulu's packing-slip template, not the
  book (book interior is glyph-clean). Fix in Lulu → Account → print/packing
  slip settings: set a plain-Latin message (e.g. "Jazakallahu khair for your
  order"). Recipient address on the slip is REQUIRED (carrier/customs) and is
  the customer's, never the owner's — Lulu is white-label.
- **TikTok**: resubmit with Website `https://www.ketabistudio.com/coming-soon`,
  Terms `/terms`, Privacy `/privacy-policy` (all public 200s).
- **Vercel**: authorize the Vercel connector in claude.ai settings (or add
  `app.ketabistudio.com` in Domains) so the subdomain goes live.
