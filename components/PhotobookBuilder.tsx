"use client";

import { useState, type ReactNode } from "react";
import styles from "./PhotobookBuilder.module.css";
import type { PhotobookTemplate } from "@/lib/photobook";
import { HARDCOVER_PRICE_DISPLAY } from "@/lib/pricing";
import KeepsakeLivePreview from "./KeepsakeLivePreview";

/* DPI guard thresholds, caught UPFRONT at upload (never after ordering).
   Many pages print full-bleed (8.75in = 2625px @ 300 DPI), so we hold photos
   to a sharper bar than the framed window alone would need:
     short side < 2000  -> BLOCK (will print blurry)
     2000–2625          -> allow, but "could be sharper"
     >= 2625            -> looks great (full 300 DPI even full-bleed)
   Unknown/unreadable dimensions (e.g. HEIC) -> BLOCK (we can't verify). */
const DPI_MIN = 2000;
const DPI_GOOD = 2625;

/* Countries the Lulu print network ships to (kept in sync with the API). */
const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BH", name: "Bahrain" },
  { code: "BE", name: "Belgium" },
  { code: "CA", name: "Canada" },
  { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "JO", name: "Jordan" },
  { code: "KW", name: "Kuwait" },
  { code: "MY", name: "Malaysia" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TR", name: "Turkey" },
  { code: "AE", name: "United Arab Emirates" },
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

  /* names + cover photo */
  const [recipient, setRecipient] = useState("");
  const [author, setAuthor] = useState("");
  const [coverPhoto, setCoverPhoto] = useState<Photo | null>(null);

  /* spreads */
  const [captions, setCaptions] = useState<string[]>([
    ...template.defaultCaptions,
  ]);
  const [photos, setPhotos] = useState<(Photo | null)[]>(
    template.defaultCaptions.map(() => null)
  );

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

  function dpiMessage(p: Photo | null) {
    if (!p || p.uploading) return null;
    if (p.quality === "block") {
      return (
        <p className={styles.dpiBlock}>
          This photo will print blurry — please use one at least {DPI_MIN}px on
          the short side (ideally {DPI_GOOD}px+).
        </p>
      );
    }
    if (p.quality === "warn") {
      return (
        <p className={styles.dpiWarn}>
          This will print, but it could be sharper — a photo {DPI_GOOD}px+ on the
          short side will look crisper.
        </p>
      );
    }
    if (p.quality === "ok") {
      return <p className={styles.dpiOk}>Looks great — this will print beautifully.</p>;
    }
    // unknown dimensions (e.g. HEIC) — block, but stay friendly
    return (
      <p className={styles.dpiBlock}>
        We couldn&apos;t read this photo&apos;s size — please upload a JPG or PNG
        so we can make sure it prints sharply.
      </p>
    );
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

  /* ── derived validity (used to DISABLE continue, so it's impossible to reach
        checkout with a blocked/missing photo) ── */
  const namesValid =
    !!recipient.trim() && !!author.trim() && usable(coverPhoto);
  const spreadsValid =
    captions.every((c) => !!c.trim()) && photos.every((p) => usable(p));

  /* ── step nav ── */
  function continueNames() {
    if (!recipient.trim()) return setError(`${template.recipientLabel} is required.`);
    if (!author.trim()) return setError(`${template.authorLabel} is required.`);
    if (!usable(coverPhoto)) return setError("Please add a cover photo that meets the resolution guide.");
    setError("");
    setStep("spreads");
  }

  function continueSpreads() {
    for (let i = 0; i < captions.length; i++) {
      if (!captions[i].trim()) return setError(`Page ${i + 1} needs a caption.`);
      if (!usable(photos[i])) return setError(`Page ${i + 1} needs a photo that meets the resolution guide.`);
    }
    setError("");
    setStep("shipping");
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

    setSubmitting(true);
    try {
      const r = await fetch("/api/photobook/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.slug,
          recipient_name: recipient.trim(),
          author_name: author.trim(),
          cover_photo_url: coverPhoto!.url,
          pages: captions.map((c, i) => ({
            caption: c.trim(),
            photo_url: photos[i]!.url,
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

  /* ── render: an uploader widget ── */
  function Uploader({
    photo,
    onFile,
    label,
  }: {
    photo: Photo | null;
    onFile: (f: File) => void;
    label: string;
  }) {
    return (
      <>
        <div className={styles.uploader}>
          {photo && photo.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="" className={styles.thumb} />
          ) : (
            <div className={styles.thumbEmpty}>
              {photo?.uploading ? "Uploading…" : "No photo"}
            </div>
          )}
          <div className={styles.uploadBody}>
            <label className={styles.fileBtn}>
              {photo && photo.url ? "Change photo" : label}
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
            {dpiMessage(photo)}
          </div>
        </div>
      </>
    );
  }

  /* Live preview — reflects names, captions and uploaded photos in real time,
     in the exact print layout. Persists across steps (same tree position). */
  const preview = (
    <KeepsakeLivePreview
      template={template}
      recipient={recipient}
      author={author}
      coverPhotoUrl={coverPhoto?.url || null}
      pages={captions.map((c, i) => ({ caption: c, url: photos[i]?.url || null }))}
    />
  );

  const shell = (content: ReactNode) => (
    <div className={styles.shell}>
      <aside className={styles.previewPane}>
        <p className={styles.previewLabel}>Live preview</p>
        {preview}
      </aside>
      <div className={styles.formPane}>{content}</div>
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
            placeholder="Whose book this is"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />

          <p className={styles.label}>Cover photo</p>
          <Uploader photo={coverPhoto} onFile={onCoverFile} label="Add cover photo" />

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
          <p className={styles.stepLabel}>Step 2 of 3</p>
          <h2 className={styles.heading}>Your twenty pages</h2>
          <p className={styles.sub}>
            Each page pairs one of your photos with a line — we&apos;ve filled in
            beautiful words for you, edit any to make it yours. It&apos;s an
            editorial layout: some photos fill the whole page, others sit framed,
            for rhythm. Use a wide, high-quality photo for the{" "}
            <em>full-page</em> spots.
          </p>

          {captions.map((cap, i) => {
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
                maxLength={160}
                onChange={(e) =>
                  setCaptions((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
              />
              <div style={{ height: 10 }} />
              <Uploader
                photo={photos[i]}
                onFile={(f) => onSpreadFile(i, f)}
                label="Add photo"
              />
            </div>
            );
          })}

          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.btnRow}>
            <button className="btn btn-outline" onClick={() => setStep("names")}>
              ← Back
            </button>
            <button
              className={`btn btn-primary ${styles.nextBtn}`}
              onClick={continueSpreads}
              disabled={!spreadsValid}
            >
              Continue
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
          A hardcover keepsake, printed to order and shipped worldwide directly
          to you{isInternational ? ". International shipping rates apply" : ""}.
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
            Checked by hand before it ships — guaranteed right.
          </p>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.btnRow}>
          <button className="btn btn-outline" onClick={() => setStep("spreads")}>
            ← Back
          </button>
          <button
            className={`btn btn-primary ${styles.nextBtn}`}
            onClick={placeOrder}
            disabled={submitting}
          >
            {submitting ? "Starting checkout…" : "Continue to payment"}
          </button>
        </div>
      </div>
    </section>
  );
}
