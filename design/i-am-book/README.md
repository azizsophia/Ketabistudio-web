# Ketabi Studio — “I Am [Child]” personalized book

A 32-page square children’s book where the child is the hero of every page. Personalized with the child’s **name** (English + Arabic), **gender** (pronouns), and **photos**.

## Files
- **book-template.html** — the full book, fully styled, with `{{TOKENS}}` to replace per order. Open in a browser to preview (it currently shows the raw tokens; fill them to see a real copy). Includes `@media print` rules so each page exports as one full-bleed page.
- **content.json** — the data model: variables, pronoun maps, photo slots, page map, and all 12 affirmations. Drive your renderer from this.

## How personalization works
Replace these tokens everywhere they appear (in `book-template.html`, or render from `content.json`):

| Token | Example | Notes |
|---|---|---|
| `{{CHILD_NAME}}` | Muadh | Latin name |
| `{{CHILD_NAME_ARABIC}}` | مُعاذ | Arabic name |
| `{{Subject}}` / `{{subject}}` | He / he | from gender |
| `{{object}}` | him | from gender |
| `{{possessive}}` | his | from gender |
| `{{PHOTO_COVER}}`, `{{PHOTO_1}}`…`{{PHOTO_12}}` | image URL | customer photos |

**Gender → pronouns** (one input drives all four tokens):
- boy → He / he / him / his
- girl → She / she / her / her

A simple string replace per order is enough. Example (Node):
```js
const data = require('./content.json');
const p = data.pronouns[order.gender];            // boy | girl
const map = {
  CHILD_NAME: order.name, CHILD_NAME_ARABIC: order.nameAr,
  Subject: p.Subject, subject: p.subject, object: p.object, possessive: p.possessive,
  PHOTO_COVER: order.photos.cover, ...order.photoMap   // PHOTO_1..12
};
let html = fs.readFileSync('book-template.html','utf8')
  .replace(/{{\s*([A-Za-z_0-9]+)\s*}}/g, (_, k) => map[k] ?? '');
```

## Print specs (Lulu — Square 8.5 × 8.5 in)
- **Trim:** 8.5 × 8.5 in
- **Bleed:** +0.125 in on every edge → **file 8.75 × 8.75 in**
- **Safe margin:** keep all text/important art **0.5 in inside the trim** (a 7.5 × 7.5 in safe box)
- **Resolution:** 300 PPI → **2625 × 2625 px** per page; supply customer photos at ~2625 px square
- **Color:** sRGB, **fonts embedded**
- **Interior:** single-page PDF, **32 pages** in reading order (Lulu’s paperback minimum is 32). First printed page is a right-hand page.
- **Cover:** a **separate one-piece PDF** (back + spine + front). Lulu gives the exact spine width from the final page count and paper stock — generate the cover wrap after the interior is locked.

### Producing the print PDF
The template is built so **each `.sheet` = one physical page**. Print to PDF (or use a headless-Chrome/Puppeteer `page.pdf()` at 8.75 in × 8.75 in, `printBackground: true`, margins 0). The included `@media print` block sets page size, removes screen chrome, and forces one sheet per page. Verify bleed by checking that full-bleed backgrounds and photos reach all four edges.

## Fonts
Loaded from Google Fonts in the template: **Fraunces** (display/serif), **Baloo Bhaijaan 2** (Arabic), **Plus Jakarta Sans** (UI/labels). For print, self-host and embed these (all three are open-source / SIL OFL) so the PDF is portable.

## Page map (32 interior pages)
1 Bismillah · 2 Title · 3 Belongs-to · 4 Dedication · 5–28 the twelve character spreads (photo page + words page) · 29 Closing · 30 Du‘a · 31 A note for grown-ups · 32 Colophon.

## Arabic
The twelve character words and the du‘a are in `content.json`, voweled (with harakat). Please keep the harakat when rendering; have a native reviewer do a final proof before the first print run.
