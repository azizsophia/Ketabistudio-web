"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./PhotobookBuilder.module.css";
import type { PhotobookTemplate } from "@/lib/photobook";
import { CAPTION_MAX } from "@/lib/photobook";
import { HARDCOVER_PRICE_DISPLAY } from "@/lib/pricing";
import KeepsakeLivePreview from "./KeepsakeLivePreview";
import FlipBook from "./FlipBook";
import PhotoCropper from "./PhotoCropper";
import { type Crop } from "@/lib/photoCrop";

// Frame shapes the photos print into (see photobook_pipeline.py): full-bleed
// hero & cover are square; framed gallery pages are 4:5 portrait (1400x1750).
const HERO_ASPECT = 1, HERO_MIN_PX = 1500;
const GAL_ASPECT = 1400 / 1750, GAL_MIN_PX = 1100;

/* DPI guard thresholds, caught UPFRONT at upload (never after ordering).
   Many pages print full-bleed (8.75in = 2625px @ 300 DPI), so we hold photos
   to a sharper bar than the framed window alone would need:
     short side < 2000  -> BLOCK (will print blurry)
     2000–2625          -> allow, but "could be sharper"
     >= 2625            -> looks great (full 300 DPI even full-bleed)
   Unknown/unreadable dimensions (e.g. HEIC) -> BLOCK (we can't verify). */
const DPI_MIN = 2000;
const DPI_GOOD = 2625;

/* The 20 photo pages are filled in sets of this many, so the step never feels
   like one overwhelming scroll. 5 -> four tidy sets of five. */
const PAGES_PER_CHUNK = 5;

/* Countries the Lulu print network ships to (kept in sync with the API). */
const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "CA", name: "Canada" },
  { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "MY", name: "Malaysia" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NO", name: "Norway" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TR", name: "Turkey" },
  { code: "GB", name: "United Kingdom" },
] as const;

const STATE_REQUIRED = new Set(["US", "CA", "AU"]);

type Photo = {
  url: string;
  width: number | null;
  height: number | null;
  /** "block" | "warn" | "ok" | "unknown" */
  quality: "block" | "warn" | "ok" | "unknown";
  uploading?: boolean;
};

type Step = "names" | "spreads" | "shipping";

function classify(w: number | null, h: number | null): Photo["quality"] {
  if (!w || !h) return "unknown";
  const m = Math.min(w, h);
  if (m < DPI_MIN) return "block";
  if (m < DPI_GOOD) return "warn";
  return "ok";
}

export default function PhotobookBuilder({
  template,
}: {
  template: PhotobookTemplate;
}) {
  const [step, setStep] = useState<Step>("names");
  /* which set of 5 photo pages is showing (0-indexed) */
  const [chunk, setChunk] = useState(0);
  const spreadsTopRef = useRef<HTMLParagraphElement>(null);

  /* names + cover photo */
  const [recipient, setRecipient] = useState("");
  const [author, setAuthor] = useState("");
  const [coverPhoto, setCoverPhoto] = useState<Photo | null>(null);
  const [coverCrop, setCoverCrop] = useState<Crop | null>(null);
  /* printed-cover title — a choice between two vetted titles (custom-title
     keepsakes only); defaults to the classic poetic title */
  const [coverTitle, setCoverTitle] = useState(
    template.titleOptions?.[0] ?? template.title
  );

  /* spreads */
  const [captions, setCaptions] = useState<string[]>([
    ...template.defaultCaptions,
  ]);
  const [photos, setPhotos] = useState<(Photo | null)[]>(
    template.defaultCaptions.map(() => null)
  );
  const [pageCrops, setPageCrops] = useState<(Crop | null)[]>(
    template.defaultCaptions.map(() => null)
  );
  const [reuseFor, setReuseFor] = useState<number | null>(null);

  /* The keepsake is hardcover-only (24pp casewrap). */
  const coverType = "hardcover" as const;
  const [email, setEmail] = useState("");
  const [shipName, setShipName] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("US");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const stateRequired = STATE_REQUIRED.has(country);
  const isInternational = country !== "US";

  async function uploadPhoto(file: File): Promise<Photo> {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/photobook/photo", { method: "POST", body: form });
    const data = await r.json();
    if (!r.ok || !data.url) {
      throw new Error(data.error || "Upload failed");
    }
    return {
      url: data.url,
      width: data.width ?? null,
      height: data.height ?? null,
      quality: classify(data.width ?? null, data.height ?? null),
    };
  }

  async function onCoverFile(file: File) {
    setError("");
    setCoverCrop(null);
    setCoverPhoto({ url: "", width: null, height: null, quality: "unknown", uploading: true });
    try {
      const p = await uploadPhoto(file);
      setCoverPhoto(p);
    } catch (e) {
      setCoverPhoto(null);
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function onSpreadFile(i: number, file: File) {
    setError("");
    setPageCrops((prev) => prev.map((x, j) => (j === i ? null : x)));
    setPhotos((prev) => {
      const next = [...prev];
      next[i] = { url: "", width: null, height: null, quality: "unknown", uploading: true };
      return next;
    });
    try {
      const p = await uploadPhoto(file);
      setPhotos((prev) => {
        const next = [...prev];
        next[i] = p;
        return next;
      });
    } catch (e) {
      setPhotos((prev) => {
        const next = [...prev];
        next[i] = null;
        return next;
      });
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  /* Usable = uploaded, has a URL, and is NOT blocked. "unknown" (unreadable /
     HEIC) is treated as blocked, so the customer fixes quality themselves and
     the order never gets cancelled later for DPI. */
  function usable(p: Photo | null): boolean {
    return (
      !!p &&
      !p.uploading &&
      !!p.url &&
      (p.quality === "ok" || p.quality === "warn")
    );
  }

  /* distinct usable photos already added, offered for one-tap reuse */
  const usedPhotos = useMemo(() => {
    const seen = new Set<string>();
    const out: Photo[] = [];
    for (const p of [coverPhoto, ...photos]) {
      if (p?.url && !p.uploading && !seen.has(p.url)) { seen.add(p.url); out.push(p); }
    }
    return out;
  }, [coverPhoto, photos]);

  function assignReuse(src: Photo) {
    if (reuseFor === null) return;
    const i = reuseFor;
    setPhotos((prev) => prev.map((x, j) => (j === i ? { ...src, uploading: false } : x)));
    setPageCrops((prev) => prev.map((x, j) => (j === i ? null : x)));
    setReuseFor(null);
  }

  /* ── derived validity (used to DISABLE continue, so it's impossible to reach
        checkout with a blocked/missing photo) ── */
  const namesValid =
    !!recipient.trim() && !!author.trim() && usable(coverPhoto);

  const numChunks = Math.ceil(captions.length / PAGES_PER_CHUNK);
  const chunkStart = chunk * PAGES_PER_CHUNK;
  const chunkEnd = Math.min(chunkStart + PAGES_PER_CHUNK, captions.length);
  /* the set on screen is complete (gates the per-set Continue button) */
  const chunkValid = captions
    .slice(chunkStart, chunkEnd)
    .every((c, k) => !!c.trim() && usable(photos[chunkStart + k]));
  /* overall pages finished, for the progress bar */
  const pagesReady = photos.reduce(
    (n, p, i) => (captions[i]?.trim() && usable(p) ? n + 1 : n),
    0
  );

  /* ── step nav ── */
  function continueNames() {
    if (!recipient.trim()) return setError(`${template.recipientLabel} is required.`);
    if (!author.trim()) return setError(`${template.authorLabel} is required.`);
    if (!usable(coverPhoto)) return setError("Please add a cover photo that meets the resolution guide.");
    setError("");
    setChunk(0);
    setStep("spreads");
  }

  function scrollSpreadsTop() {
    spreadsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* Validate just the set currently on screen, then advance to the next set
     (or on to shipping once the last set is done). */
  function continueSpreads() {
    const start = chunk * PAGES_PER_CHUNK;
    const end = Math.min(start + PAGES_PER_CHUNK, captions.length);
    for (let i = start; i < end; i++) {
      if (!captions[i].trim()) return setError(`Page ${i + 1} needs a caption.`);
      if (!usable(photos[i])) return setError(`Page ${i + 1} needs a photo that meets the resolution guide.`);
    }
    setError("");
    if (end < captions.length) {
      setChunk(chunk + 1);
      scrollSpreadsTop();
    } else {
      setStep("shipping");
    }
  }

  function backSpreads() {
    setError("");
    if (chunk > 0) {
      setChunk(chunk - 1);
      scrollSpreadsTop();
    } else {
      setStep("names");
    }
  }

  async function placeOrder() {
    setError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Please enter a valid email address.");
    }
    if (!shipName.trim() || !street1.trim() || !city.trim() || !zip.trim()) {
      return setError("Please complete all shipping fields.");
    }
    if (stateRequired && !state.trim()) {
      return setError("Please enter your state or province.");
    }
    if (!phone.trim()) {
      return setError("A phone number is required for delivery.");
    }
    if (!agreed) {
      return setError("Please confirm you've reviewed your keepsake before we print it.");
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/photobook/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.slug,
          recipient_name: recipient.trim(),
          author_name: author.trim(),
          cover_title: coverTitle,
          cover_photo_url: coverPhoto!.url,
          cover_crop: coverCrop,
          pages: captions.map((c, i) => ({
            caption: c.trim(),
            photo_url: photos[i]!.url,
            crop: pageCrops[i] || null,
          })),
          cover_type: coverType,
          email: email.trim(),
          shipping: {
            name: shipName.trim(),
            street1: street1.trim(),
            street2: street2.trim(),
            city: city.trim(),
            state_code: state.trim(),
            postcode: zip.trim(),
            country_code: country,
            phone: phone.trim(),
          },
        }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        const c = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId }),
        });
        const cd = await c.json();
        if (c.ok && cd.url) {
          window.location.href = cd.url;
          return;
        }
        setError(cd.error || "Could not start checkout. Please try again.");
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* Live preview — reflects names, captions and uploaded photos in real time,
     in the exact print layout. Persists across steps (same tree position). */
  const preview = (
    <KeepsakeLivePreview
      template={template}
      recipient={recipient}
      author={author}
      coverTitle={coverTitle}
      coverPhotoUrl={coverPhoto?.url || null}
      coverCrop={coverCrop}
      pages={captions.map((c, i) => ({ caption: c, url: photos[i]?.url || null, crop: pageCrops[i] }))}
    />
  );

  /* Step 1 shows the FINISHED sample book (real rendered pages), not an empty
     live preview — the customer should see what they're making before being
     asked to type and upload anything (audit 2026-07-16). The live preview
     takes over from step 2, once their own content exists. */
  const sampleBook = (
    <FlipBook
      cover={`/images/keepsake/${template.slug}/cover.jpg`}
      title={template.title}
      pages={[
        { src: `/images/keepsake/${template.slug}/page02.jpg` },
        { src: `/images/keepsake/${template.slug}/page04.jpg` },
        { src: `/images/keepsake/${template.slug}/page06.jpg` },
        { src: `/images/keepsake/${template.slug}/page10.jpg` },
        { src: `/images/keepsake/${template.slug}/page23.jpg` },
      ]}
      stage="forest"
      eyebrow="Real pages from the book"
      caption="Your photos and your words go in this exact layout, sealed with a dua."
    />
  );

  const shell = (content: ReactNode) => (
    <div className={styles.shell}>
      <aside className={styles.previewPane}>
        <p className={styles.previewLabel}>
          {step === "names" ? "The book you're making" : "Live preview"}
        </p>
        {step === "names" ? sampleBook : preview}
      </aside>
      <div className={styles.formPane}>{content}</div>
      {reuseFor !== null && (
        <ReusePicker photos={usedPhotos} onPick={assignReuse} onClose={() => setReuseFor(null)} />
      )}
    </div>
  );

  /* ── step: names + cover photo ── */
  if (step === "names") {
    return shell(
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className={styles.stepLabel}>Step 1 of 3</p>
          <h1 className={styles.heading}>{template.title}</h1>
          <p className={styles.sub}>{template.blurb}</p>

          {template.titleOptions && template.titleOptions.length > 1 && (
            <>
              <span className={styles.label}>Cover title</span>
              <div className={styles.titleChoiceRow} role="radiogroup" aria-label="Cover title">
                {template.titleOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={coverTitle === t}
                    className={`${styles.titleChoice} ${
                      coverTitle === t ? styles.titleChoiceOn : ""
                    }`}
                    onClick={() => setCoverTitle(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className={styles.label} htmlFor="recipient">
            {template.recipientLabel}
          </label>
          <input
            id="recipient"
            className={styles.input}
            type="text"
            maxLength={30}
            placeholder={template.recipientPlaceholder}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />

          <label className={styles.label} htmlFor="author">
            {template.authorLabel}
          </label>
          <input
            id="author"
            className={styles.input}
            type="text"
            maxLength={30}
            placeholder="e.g. Yusuf"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <p className={styles.fieldHint}>
            Who the keepsake is from, appears as &ldquo;by &hellip;&rdquo; on the
            cover and dedication.
          </p>

          <p className={styles.label}>Cover photo</p>
          <Uploader photo={coverPhoto} onFile={onCoverFile} label="Add cover photo"
            crop={coverCrop} onCrop={setCoverCrop}
            frameAspect={HERO_ASPECT} minShortPx={HERO_MIN_PX} />

          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.btnRow}>
            <button
              className={`btn btn-primary ${styles.nextBtn}`}
              onClick={continueNames}
              disabled={!namesValid}
            >
              Continue to your pages
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ── step: the 20 photo pages ── */
  if (step === "spreads") {
    return shell(
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className={styles.stepLabel} ref={spreadsTopRef}>
            Step 2 of 3 · Set {chunk + 1} of {numChunks}
          </p>
          <h2 className={styles.heading}>Your twenty pages</h2>
          <p className={styles.sub}>
            Each page pairs one of your photos with a line, we&apos;ve filled in
            beautiful words for you, edit any to make it yours. We&apos;ll take it
            five pages at a time. Some photos fill the whole page, others sit
            framed, for rhythm. Use a wide, high-quality photo for the{" "}
            <em>full-page</em> spots.
          </p>

          <div className={styles.progress}>
            <div className={styles.progressHead}>
              <span>
                Pages {chunkStart + 1}–{chunkEnd}
              </span>
              <span>
                {pagesReady} of {captions.length} ready
              </span>
            </div>
            <div className={styles.progressTrack} aria-hidden="true">
              <span
                className={styles.progressFill}
                style={{ width: `${(pagesReady / captions.length) * 100}%` }}
              />
            </div>
          </div>

          {captions.slice(chunkStart, chunkEnd).map((cap, k) => {
            const i = chunkStart + k;
            const fullPage = (i + 1) % 3 === 1;
            return (
            <div className={styles.spread} key={i}>
              <p className={styles.spreadNum}>
                Page {i + 1}
                <span
                  className={`${styles.layoutTag} ${
                    fullPage ? styles.layoutFull : ""
                  }`}
                >
                  {fullPage ? "Full page" : "Framed"}
                </span>
              </p>
              <textarea
                className={styles.captionInput}
                value={cap}
                maxLength={CAPTION_MAX}
                onChange={(e) =>
                  setCaptions((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
              />
              <span
                className={`${styles.charCount} ${
                  cap.length >= CAPTION_MAX ? styles.charCountMax : ""
                }`}
              >
                {cap.length}/{CAPTION_MAX}
              </span>
              <div style={{ height: 10 }} />
              <Uploader
                photo={photos[i]}
                onFile={(f) => onSpreadFile(i, f)}
                label="Add photo"
                crop={pageCrops[i]}
                onCrop={(c) => setPageCrops((prev) => prev.map((x, j) => (j === i ? c : x)))}
                frameAspect={fullPage ? HERO_ASPECT : GAL_ASPECT}
                minShortPx={fullPage ? HERO_MIN_PX : GAL_MIN_PX}
                canReuse={usedPhotos.length > 0}
                onReuseRequest={() => setReuseFor(i)}
              />
            </div>
            );
          })}

          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.btnRow}>
            <button className="btn btn-outline" onClick={backSpreads}>
              {chunk > 0 ? "← Previous set" : "← Back"}
            </button>
            <button
              className={`btn btn-primary ${styles.nextBtn}`}
              onClick={continueSpreads}
              disabled={!chunkValid}
            >
              {chunk < numChunks - 1 ? "Next set" : "Continue"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ── step: shipping ── */
  return shell(
    <section className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.stepLabel}>Step 3 of 3</p>
        <h2 className={styles.heading}>Where should we send it?</h2>
        <p className={styles.sub}>
          A hardcover keepsake, made to order and shipped worldwide directly to
          you. Please allow about 2 to 3 weeks for delivery in the US, 3 to 5
          weeks international{isInternational ? ". International shipping rates apply" : ""}.
        </p>

        <div className={styles.duaNote}>
          <p className={styles.duaIntro}>Every keepsake ends with the dua for parents</p>
          <p className={styles.duaArabic}>{template.dua.arabic}</p>
          <p className={styles.duaTranslit}>{template.dua.translit}</p>
          <p className={styles.duaEnglish}>{template.dua.english}</p>
          <p className={styles.duaRef}>{template.dua.ref}</p>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input id="email" className={styles.input} type="email"
              placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="country">Country</label>
            <select id="country" className={styles.input} value={country}
              onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="ship-name">Full name</label>
            <input id="ship-name" className={styles.input} type="text"
              autoComplete="name" placeholder="Recipient's full name"
              value={shipName} onChange={(e) => setShipName(e.target.value)} />
          </div>

          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="street1">Address line 1</label>
            <input id="street1" className={styles.input} type="text"
              autoComplete="address-line1" placeholder="Street address"
              value={street1} onChange={(e) => setStreet1(e.target.value)} />
          </div>

          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="street2">Address line 2 (optional)</label>
            <input id="street2" className={styles.input} type="text"
              autoComplete="address-line2" placeholder="Apartment, suite, etc."
              value={street2} onChange={(e) => setStreet2(e.target.value)} />
          </div>

          <div>
            <label className={styles.label} htmlFor="city">City</label>
            <input id="city" className={styles.input} type="text"
              autoComplete="address-level2" placeholder="City"
              value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          <div>
            <label className={styles.label} htmlFor="state">
              {country === "US" ? "State" : country === "CA" ? "Province" : "State/Region"}
              {!stateRequired && " (optional)"}
            </label>
            <input id="state" className={styles.input} type="text"
              autoComplete="address-level1"
              maxLength={country === "US" || country === "CA" ? 2 : 30}
              value={state}
              onChange={(e) =>
                setState(
                  country === "US" || country === "CA"
                    ? e.target.value.toUpperCase()
                    : e.target.value
                )
              } />
          </div>

          <div>
            <label className={styles.label} htmlFor="zip">
              {country === "US" ? "ZIP" : "Postcode"}
            </label>
            <input id="zip" className={styles.input} type="text"
              autoComplete="postal-code"
              value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>

          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="phone">Phone (required for delivery)</label>
            <input id="phone" className={styles.input} type="tel"
              autoComplete="tel" placeholder="So the courier can reach you"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className={styles.priceSummary}>
          <div className={styles.priceRow}>
            <span>Hardcover keepsake</span>
            <span>{HARDCOVER_PRICE_DISPLAY}</span>
          </div>
          <div className={styles.priceRow}>
            <span>Shipping</span>
            <span>{isInternational ? "Calculated at checkout" : "Free (US)"}</span>
          </div>
          <div className={`${styles.priceRow} ${styles.priceTotal}`}>
            <span>Total</span>
            <span>
              {HARDCOVER_PRICE_DISPLAY + (isInternational ? " + shipping" : "")}
            </span>
          </div>
          <p className={styles.priceNote}>
            Printed to order and shipped with care.
          </p>
        </div>

        <label className={styles.confirm}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I&apos;ve reviewed my photos and captions in the live preview, and
            understand this keepsake is personalized and printed to order. See our{" "}
            <a href="/refund-policy" target="_blank" rel="noopener noreferrer">
              refund policy
            </a>
            .
          </span>
        </label>

        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.btnRow}>
          <button className="btn btn-outline" onClick={() => setStep("spreads")}>
            ← Back
          </button>
          <button
            className={`btn btn-primary ${styles.nextBtn}`}
            onClick={placeOrder}
            disabled={submitting || !agreed}
          >
            {submitting ? "Starting checkout…" : "Continue to payment"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ReusePicker({ photos, onPick, onClose }: {
  photos: Photo[]; onPick: (p: Photo) => void; onClose: () => void;
}) {
  return (
    <div className={styles.reuseBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.reusePanel} onClick={(e) => e.stopPropagation()}>
        <p className={styles.reuseTitle}>Reuse one of your photos</p>
        <div className={styles.reuseGrid}>
          {photos.map((p, idx) => (
            <button key={idx} type="button" className={styles.reuseThumb} onClick={() => onPick(p)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* DPI guidance + the uploader widget live at MODULE scope on purpose: defining
   them inside PhotobookBuilder gave them a new component identity on every
   render, which remounted the PhotoCropper each render. The cropper's image-load
   effect then re-published its crop → state update → re-render → remount, an
   infinite loop that re-fetched the photo hundreds of times and made the cover
   visibly flicker. Stable identity here breaks that loop. */
function dpiMessage(p: Photo | null) {
  if (!p || p.uploading) return null;
  if (p.quality === "block") {
    return (
      <p className={styles.dpiBlock}>
        This photo is too low-resolution to print sharply. Please upload a
        high-quality photo. We print at 300 DPI, so one straight from your
        phone or camera looks best (screenshots and saved web images usually
        won&apos;t print well).
      </p>
    );
  }
  if (p.quality === "warn") {
    return (
      <p className={styles.dpiWarn}>
        This will print, but for the sharpest keepsake upload a
        higher-quality photo (we print at 300 DPI).
      </p>
    );
  }
  if (p.quality === "ok") {
    return <p className={styles.dpiOk}>Looks great. This will print beautifully.</p>;
  }
  // unknown dimensions (e.g. HEIC) — block, but stay friendly
  return (
    <p className={styles.dpiBlock}>
      We couldn&apos;t check this photo&apos;s quality. Please upload a
      high-quality JPG or PNG (we print at 300 DPI) so it prints sharply.
    </p>
  );
}

function Uploader({
  photo, onFile, label, crop, onCrop, frameAspect, minShortPx,
  canReuse, onReuseRequest,
}: {
  photo: Photo | null;
  onFile: (f: File) => void;
  label: string;
  crop?: Crop | null;
  onCrop?: (c: Crop) => void;
  frameAspect: number;
  minShortPx: number;
  canReuse?: boolean;
  onReuseRequest?: () => void;
}) {
  const fileInput = (text: string) => (
    <label className={styles.fileBtn}>
      {text}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );

  if (photo && photo.url && !photo.uploading) {
    return (
      <div className={styles.uploader}>
        <div className={styles.cropHost}>
          <PhotoCropper
            src={photo.url}
            frameAspect={frameAspect}
            minShortPx={minShortPx}
            value={crop}
            onChange={(c) => onCrop?.(c)}
            showSafe
          />
        </div>
        <div className={styles.uploadBody}>
          {fileInput("Change photo")}
          {dpiMessage(photo)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.uploader}>
      <div className={styles.thumbEmpty}>
        {photo?.uploading ? "Uploading…" : "No photo"}
      </div>
      <div className={styles.uploadBody}>
        {fileInput(label)}
        {canReuse && onReuseRequest && (
          <button type="button" className={styles.reuseInline} onClick={onReuseRequest}>
            or reuse a photo you added
          </button>
        )}
        {dpiMessage(photo)}
      </div>
    </div>
  );
}
