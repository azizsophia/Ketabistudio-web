# Ketabi Studio — Widgets · Developer Handoff

Visual reference: **`Ketabi Widgets.dc.html`** (open in any browser — `support.js` is bundled). App icon: `assets/ketabi-icon.png`.

The HTML is a *design reference*, not shippable widget code. Rebuild each widget natively:
iOS → **WidgetKit / SwiftUI**, Android → **Jetpack Glance** (or RemoteViews).

---

## 1. Brand tokens

**Fonts** (Google Fonts):
- Display / body serif — **Cormorant Garamond** (400, 500, 600, + italic). Used for numerals, prayer names, transliterations, tracked-caps labels.
- Arabic — **Amiri** (400/700). Always `dir="rtl"`. Give it generous line-height (≈1.5) so vowel marks never clip.
- Editorial serif alt — **Newsreader** (1b only). Geometric serif alt — **Spectral** (1c only).
- Micro UI labels — **Hanken Grotesk** (badges only; not in the widgets themselves).

**Colour palette**

| Role | Hex |
|---|---|
| Emerald (icon green) surface | `#2C5044` → `#163329` (radial) |
| Emerald card | `#244A3D` → `#173529` |
| Cream paper surface | `#F2ECDB` → `#E6DDC7` |
| Cream card | `#FAF6EA` |
| Midnight surface | `#0E211A` → `#05100B` |
| Midnight card | `#122A21` → `#0A1A13` |
| Ink green (text on cream) | `#26362B` |
| Cream text (on dark) | `#F2ECDB` |
| Gold / brass accent | `#C9B17F` · `#D8B25E` · `#E6C98A` · `#B39760` |
| Gold hairline | `rgba(179,151,96,.28–.40)` |
| Muted sage | `#8FA596` · `#9DB0A0` |

**Radii / shadow**: outer wallpaper 44–48px · widget card 30–34px · small widget 28px · large drop shadow `0 24–46px 50–90px -26px rgba(0,0,0,.4–.6)`. The gold **1px inset hairline frame** (on Name-of-Allah + Verse cards) is the signature nod to the "mercy, in its mother tongue" mark.

---

## 2. Widget catalogue

Directions (pick per taste — all share the tokens above):
- **2a Cream · Paper** — daytime
- **2b Emerald · Signature** — brand hero
- **2c Midnight · Quiet hours** — lock screen / night
- **3a–3f Signature** — original concepts (below)
- 1a/1b/1c — earlier pre-brand exploration, kept for reference

**Standard content widgets**: Next Prayer, Daily Verse, Daily Dhikr, 99 Names, Hijri Date, Tasbīḥ.

**Signature widgets** (visual-only — wire to live data):
| id | Widget | Best size | Data needed |
|---|---|---|---|
| 3a | Adhkar Rings (concentric) | Large | morning/evening/night adhkar counts + totals |
| 3a-B | Adhkar Day Arc (segmented) | Large | same as 3a |
| 3b | Sun Path | Large / Medium-wide | 5 prayer times, current time |
| 3c | Tasbīḥ Ring (33 beads) | Medium / Large | current count, target (33/99) |
| 3d | Consistency grid | Medium / Large | 7-day × 3-slot completion matrix, streak |
| 3e | Last Third of the Night | Large | night start, Fajr, last-third boundary |
| 3f | Qibla | Large | bearing (deg), distance to Makkah |

---

## 3. Sizes (iOS + Android)

| Size | iOS `WidgetFamily` | Android target | Aspect used in design |
|---|---|---|---|
| Small | `.systemSmall` | 2×2 cells | 1:1 square |
| Medium | `.systemMedium` | 4×2 cells | ~2:1 wide |
| Large | `.systemLarge` | 4×4 cells | ~1:1 tall |

Design widths in the reference: small ≈ 168px, medium ≈ 356px, large ≈ 356px. Use these as ratios, not fixed points — WidgetKit/Glance size to the device. Keep the ≥44px min tap target rule; type never below ~11px on small.

---

## 4. Tap → shop (marketing link)

Every widget is a single tap target opening **https://ketabistudio.com**. The visible gold `ketabistudio.com` wordmark is branding only.

- **iOS**: `.widgetURL(URL(string: "https://ketabistudio.com"))` on the widget root (small); `Link(...)` per-region on medium/large if you want deep regions. Consider a UTM, e.g. `?utm_source=ios_widget&utm_medium=<widgetname>`.
- **Android (Glance)**: `actionStartActivity` / `actionRunCallback` with an `Intent(ACTION_VIEW, Uri.parse("https://ketabistudio.com"))`, or route through the Capacitor app and `Browser.open`.
- **Capacitor**: if you'd rather open in-app, catch the URL in the native widget and hand off to the WebView, or use App Links / Universal Links to `ketabistudio.com`.

---

## 5. Ring / arc math (for native re-implementation)

All rings use SVG `stroke-dasharray`. Native equivalent (SwiftUI `Circle().trim(from:to:)` or Android `drawArc`):

- Full circumference `C = 2πr`.
- Progress `p` (0–1): draw fraction `p` of `C`, starting at 12 o'clock (rotate −90°), round line caps.
- **3a concentric**: three radii (72 / 54 / 36 in a 184 box), stroke 15, one per adhkar set (gold `#D8B25E`, emerald `#43A67F`, teal `#63B0C4`), each on a faint track of the same hue.
- **3a-B segmented**: one radius, three arcs of 120° each with a ~7° gap; each arc fills independently.
- **3c tasbīḥ**: gold progress arc + a dark dashed overlay (`dash ≈ C/33`) to carve the ring into 33 beads.
- **3e last third**: thin gold progress ring + centred crescent glyph.
- **3f qibla**: static compass ring + a needle rotated to the Qibla bearing; recompute bearing from device heading + Makkah coords (21.4225°N, 39.8262°E).

---

## 6. Dynamic fields (bind these)

Prayer times, next-prayer name + countdown, Hijri date, verse of the day (Arabic + translation + reference), dhikr counts, adhkar completion, tasbīḥ count, streak matrix, Qibla bearing/distance. Everything else (labels, palette, wordmark) is static.

All Quran text in the reference is verified: **94:6**, **2:152**, **2:155** (Arabic + translation + reference). Names: **Ar-Raḥmān** (1/99), **An-Nūr**.

> Live in-widget tapping (e.g. Tasbīḥ "add a bead") needs **iOS 17+ App Intents** / Android interactive widgets. Otherwise a tap opens the app or the site.
