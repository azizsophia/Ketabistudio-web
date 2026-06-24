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
bases were deleted from the bucket. **Long-straight is disabled in the
UI and rejected by the API until the bases are re-rendered** — restore
checklist: (1) run the CI for `cover`, `1-3`, `4-6`, `7-9`, `10-11`
(note: ALL 48 cover bases were deleted so covers re-render clean,
text-free), (2) regenerate the 48 web heroes in `public/images/` from
the new clean bases (no blanking needed) plus the 12 missing
`preview-p02-*-long-straight.jpg` files, (3) run a long-straight test
order end-to-end and approve-check it in /admin, (4) flip
`available: true` in `components/OrderSection.tsx` and remove
long-straight from `BLOCKED_STYLES` in `app/api/orders/route.ts`.

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
