"use client";

import { useState } from "react";
import BookPreview from "./BookPreview";
import DuasPreview from "./DuasPreview";
import styles from "./OrderSection.module.css";
import {
  SOFTCOVER_PRICE_DISPLAY,
  HARDCOVER_PRICE_DISPLAY,
} from "@/lib/pricing";

const MAX_NAME = 14;

const DUAS_CHARACTERS = [
  { key: "girl", label: "Girl" },
  { key: "boy", label: "Boy" },
] as const;
const DUAS_LOOKS = [
  { key: "afro", label: "Deep skin, curly hair" },
  { key: "indian", label: "Medium skin, straight hair" },
  { key: "white", label: "Light skin, blonde hair" },
] as const;

const SKINS = [
  { key: "light", label: "Light skin", swatch: "#f3d5bd" },
  { key: "medium", label: "Medium skin", swatch: "#d9a877" },
  { key: "dark", label: "Deep skin", swatch: "#9c6b44" },
] as const;

const HAIRS = [
  { key: "black", label: "Black hair", swatch: "#2b2326" },
  { key: "brown", label: "Brown hair", swatch: "#6b4630" },
  { key: "blonde", label: "Blonde hair", swatch: "#c79a4e" },
  { key: "red", label: "Red hair", swatch: "#b85c34" },
] as const;

/* All four hairstyles available: long-straight bases re-rendered and
   pixel-verified 2026-06-11 (every base confirmed to contain the
   character before upload). */
const HAIR_STYLES = [
  { key: "long-straight", label: "Long & straight", available: true },
  { key: "long-curly", label: "Long & curly", available: true },
  { key: "short-straight", label: "Short & straight", available: true },
  { key: "short-curly", label: "Short & curly", available: true },
] as const;

/* Countries the Lulu print network ships to (common subset). US first. */
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

type Props = {
  slug: string;
  personalized: boolean;
};

type Step = "customize" | "shipping" | "done";

export default function OrderSection({ slug, personalized }: Props) {
  const isDuas = slug === "my-beautiful-duas";

  /* personalization */
  const [name, setName] = useState("");
  const [skin, setSkin] = useState<string>("medium");
  const [hair, setHair] = useState<string>("black");
  const [hairStyle, setHairStyle] = useState<string>("long-curly");
  const [character, setCharacter] = useState<string>("girl");
  const [wearsHijab, setWearsHijab] = useState<boolean>(true);
  const [look, setLook] = useState<string>("indian");
  const [coverType, setCoverType] = useState<"softcover" | "hardcover">("softcover");
  const [nameError, setNameError] = useState("");

  /* shipping */
  const [email, setEmail] = useState("");
  const [shipName, setShipName] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("US");

  /* flow */
  const [step, setStep] = useState<Step>(personalized ? "customize" : "shipping");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");

  const stateRequired = STATE_REQUIRED.has(country);
  const isInternational = country !== "US";
  /* hijab is a sub-option of girl; the art pack key is boy | girl | hijab */
  const effectiveChar = character === "boy" ? "boy" : wearsHijab ? "hijab" : "girl";

  function continueToShipping() {
    if (!name.trim()) {
      setNameError("Please type her name first, so we can make her the star.");
      return;
    }
    setNameError("");
    setStep("shipping");
  }

  async function placeOrder() {
    setError("");
    if (personalized && !name.trim()) {
      setError("Her name is required.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!shipName.trim() || !street1.trim() || !city.trim() || !zip.trim()) {
      setError("Please complete all shipping fields.");
      return;
    }
    if (stateRequired && !state.trim()) {
      setError("Please enter your state or province.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_slug: slug,
          child_name: personalized ? name.trim() : null,
          skin: personalized && !isDuas ? skin : null,
          hair: personalized && !isDuas ? hair : null,
          hair_style: personalized && !isDuas ? hairStyle : null,
          character: isDuas ? effectiveChar : null,
          look: isDuas ? look : null,
          cover_type: personalized ? coverType : "softcover",
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
        /* Order created (awaiting_payment). Start Stripe checkout and
           hand off to the hosted payment page. */
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

  /* ── step: customize (My Beautiful Duas — pick by picture) ── */
  if (step === "customize" && isDuas) {
    return (
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className={styles.stepLabel}>Step 1 of 2</p>
          <h2 className={styles.heading}>Make them the star</h2>
          <p className={styles.sub}>
            Choose your child, type their name, and watch their very own dua
            book come together.
          </p>

          <div className={styles.personalizerGrid}>
            <div className={styles.controls}>
              <label className={styles.label} htmlFor="kid-name">Their name</label>
              <input
                id="kid-name"
                className={styles.input}
                type="text"
                placeholder="Type their name"
                maxLength={MAX_NAME}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setNameError("");
                }}
                autoComplete="off"
              />
              {nameError && <p className={styles.error}>{nameError}</p>}

              <p className={styles.label} id="char-label">Your child</p>
              <div className={styles.stylePills} role="group" aria-labelledby="char-label">
                {DUAS_CHARACTERS.map((ch) => (
                  <button
                    key={ch.key} type="button"
                    className={`${styles.pill} ${character === ch.key ? styles.pillActive : ""}`}
                    aria-pressed={character === ch.key}
                    onClick={() => setCharacter(ch.key)}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>

              {character === "girl" && (
                <>
                  <p className={styles.label} id="hijab-label">Hijab</p>
                  <div className={styles.stylePills} role="group" aria-labelledby="hijab-label">
                    <button
                      type="button"
                      className={`${styles.pill} ${wearsHijab ? styles.pillActive : ""}`}
                      aria-pressed={wearsHijab}
                      onClick={() => setWearsHijab(true)}
                    >
                      With hijab
                    </button>
                    <button
                      type="button"
                      className={`${styles.pill} ${!wearsHijab ? styles.pillActive : ""}`}
                      aria-pressed={!wearsHijab}
                      onClick={() => setWearsHijab(false)}
                    >
                      Without hijab
                    </button>
                  </div>
                </>
              )}

              <p className={styles.label} id="look-label">Their look</p>
              <div className={styles.lookGrid} role="group" aria-labelledby="look-label">
                {DUAS_LOOKS.map((lk) => (
                  <button
                    key={lk.key} type="button"
                    className={`${styles.lookOption} ${look === lk.key ? styles.lookActive : ""}`}
                    aria-label={lk.label}
                    aria-pressed={look === lk.key}
                    onClick={() => setLook(lk.key)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/images/duas/${effectiveChar}-${lk.key}.jpg`} alt={lk.label} />
                  </button>
                ))}
              </div>

              <CoverChoice coverType={coverType} setCoverType={setCoverType} />
            </div>

            <div className={styles.previewCol}>
              <p className={styles.label}>Your cover</p>
              <DuasPreview name={name} character={effectiveChar} look={look} />
              <p className={styles.previewHint}>This is the cover we print — it updates as you choose.</p>
            </div>
          </div>

          <button
            className={`btn btn-primary ${styles.nextBtn}`}
            onClick={continueToShipping}
          >
            Continue to shipping
          </button>
        </div>
      </section>
    );
  }

  /* ── step: customize (personalized books) ── */
  if (step === "customize" && personalized) {
    return (
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className={styles.stepLabel}>Step 1 of 2</p>
          <h2 className={styles.heading}>Make her the star</h2>
          <p className={styles.sub}>
            Type her name and watch it appear on the cover, then turn the
            page to see it woven into the story itself.
          </p>

          <div className={styles.personalizerGrid}>
            <div className={styles.controls}>
              <label className={styles.label} htmlFor="kid-name">Her name</label>
              <input
                id="kid-name"
                className={styles.input}
                type="text"
                placeholder="Type her name"
                maxLength={MAX_NAME}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setNameError("");
                }}
                autoComplete="off"
              />
              {nameError && <p className={styles.error}>{nameError}</p>}

              <p className={styles.label} id="skin-label">Her skin</p>
              <div className={styles.swatches} role="group" aria-labelledby="skin-label">
                {SKINS.map((s) => (
                  <button
                    key={s.key} type="button"
                    className={`${styles.swatch} ${skin === s.key ? styles.swatchActive : ""}`}
                    style={{ background: s.swatch }}
                    aria-label={s.label}
                    aria-pressed={skin === s.key}
                    onClick={() => setSkin(s.key)}
                  />
                ))}
              </div>

              <p className={styles.label} id="hair-label">Her hair</p>
              <div className={styles.swatches} role="group" aria-labelledby="hair-label">
                {HAIRS.map((h) => (
                  <button
                    key={h.key} type="button"
                    className={`${styles.swatch} ${hair === h.key ? styles.swatchActive : ""}`}
                    style={{ background: h.swatch }}
                    aria-label={h.label}
                    aria-pressed={hair === h.key}
                    onClick={() => setHair(h.key)}
                  />
                ))}
              </div>

              <p className={styles.label} id="style-label">Her hairstyle</p>
              <div className={styles.stylePills} role="group" aria-labelledby="style-label">
                {HAIR_STYLES.map((s) => (
                  <button
                    key={s.key} type="button"
                    className={`${styles.pill} ${hairStyle === s.key ? styles.pillActive : ""} ${!s.available ? styles.pillDisabled : ""}`}
                    aria-pressed={hairStyle === s.key}
                    disabled={!s.available}
                    onClick={() => s.available && setHairStyle(s.key)}
                  >
                    {s.label}{!s.available ? " · soon" : ""}
                  </button>
                ))}
              </div>

              <CoverChoice coverType={coverType} setCoverType={setCoverType} />
            </div>

            <div className={styles.previewCol}>
              <BookPreview
                name={name}
                skin={skin}
                hair={hair}
                hairStyle={hairStyle}
              />
            </div>
          </div>

          <button
            className={`btn btn-primary ${styles.nextBtn}`}
            onClick={continueToShipping}
          >
            Continue to shipping
          </button>
        </div>
      </section>
    );
  }

  /* ── step: shipping ── */
  if (step === "shipping") {
    return (
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className={styles.stepLabel}>
            {personalized ? "Step 2 of 2" : "Shipping details"}
          </p>
          <h2 className={styles.heading}>Where should we send it?</h2>
          <p className={styles.sub}>
            We ship worldwide. Your book is printed and shipped directly to
            you{isInternational ? ". International shipping rates apply" : ""}.
          </p>

          <div className={styles.formGrid}>
            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input id="email" className={styles.input} type="email"
                placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="country">Country</label>
              <select
                id="country"
                className={styles.input}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="ship-name">Full name</label>
              <input id="ship-name" className={styles.input} type="text"
                placeholder="Recipient's full name"
                value={shipName} onChange={(e) => setShipName(e.target.value)} />
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="street1">Address line 1</label>
              <input id="street1" className={styles.input} type="text"
                placeholder="Street address"
                value={street1} onChange={(e) => setStreet1(e.target.value)} />
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="street2">Address line 2 (optional)</label>
              <input id="street2" className={styles.input} type="text"
                placeholder="Apartment, suite, etc."
                value={street2} onChange={(e) => setStreet2(e.target.value)} />
            </div>

            <div className={styles.fieldHalf}>
              <label className={styles.label} htmlFor="city">City</label>
              <input id="city" className={styles.input} type="text"
                placeholder="City"
                value={city} onChange={(e) => setCity(e.target.value)} />
            </div>

            <div className={styles.fieldQuarter}>
              <label className={styles.label} htmlFor="state">
                {country === "US" ? "State" : country === "CA" ? "Province" : "State/Region"}
                {!stateRequired && " (optional)"}
              </label>
              <input id="state" className={styles.input} type="text"
                placeholder={country === "US" ? "State" : ""}
                maxLength={country === "US" || country === "CA" ? 2 : 30}
                value={state}
                onChange={(e) => setState(
                  country === "US" || country === "CA"
                    ? e.target.value.toUpperCase()
                    : e.target.value
                )} />
            </div>

            <div className={styles.fieldQuarter}>
              <label className={styles.label} htmlFor="zip">
                {country === "US" ? "ZIP" : "Postcode"}
              </label>
              <input id="zip" className={styles.input} type="text"
                placeholder={country === "US" ? "ZIP code" : ""}
                value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="phone">
                Phone {isInternational ? "(required for customs)" : "(optional)"}
              </label>
              <input id="phone" className={styles.input} type="tel"
                placeholder=""
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className={styles.priceSummary}>
            <div className={styles.priceRow}>
              <span>
                Book
                {personalized
                  ? coverType === "hardcover"
                    ? " (Hardcover)"
                    : " (Softcover)"
                  : ""}
              </span>
              <span>
                {personalized && coverType === "hardcover"
                  ? HARDCOVER_PRICE_DISPLAY
                  : SOFTCOVER_PRICE_DISPLAY}
              </span>
            </div>
            <div className={styles.priceRow}>
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className={`${styles.priceRow} ${styles.priceTotal}`}>
              <span>Total</span>
              <span>
                {(personalized && coverType === "hardcover"
                  ? HARDCOVER_PRICE_DISPLAY
                  : SOFTCOVER_PRICE_DISPLAY) + " + shipping"}
              </span>
            </div>
            <p className={styles.priceNote}>
              {isInternational
                ? "Live shipping rate for your country, shown at checkout."
                : "Live shipping rate shown at checkout."}{" "}
              Checked by hand before it ships — guaranteed right.
            </p>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.btnRow}>
            {personalized && (
              <button
                className={`btn btn-outline ${styles.backBtn}`}
                onClick={() => setStep("customize")}
              >
                ← Back
              </button>
            )}
            <button
              className={`btn btn-primary ${styles.nextBtn}`}
              onClick={placeOrder}
              disabled={submitting}
            >
              {submitting ? "Starting checkout..." : "Continue to payment"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ── step: done ── */
  if (step === "done") {
    return (
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.doneBox}`}>
          <div className={styles.checkmark}>✓</div>
          <h2 className={styles.heading}>Order received</h2>
          <p className={styles.sub}>
            {personalized && name.trim()
              ? `${name.trim()}'s book is being made now. `
              : "Your book is being prepared now. "}
            We review every single book personally before it goes to print,
            so each page is exactly right. You will receive an email at{" "}
            <strong>{email}</strong> when it ships.
          </p>
          <p className={styles.orderId}>Order {orderId.slice(0, 8)}</p>
        </div>
      </section>
    );
  }

  return null;
}

/* ── Cover choice (personalized books only) — softcover default, hardcover
   upsell. On-brand cream/forest/gold via the shared option styles. ── */
function CoverChoice({
  coverType,
  setCoverType,
}: {
  coverType: "softcover" | "hardcover";
  setCoverType: (v: "softcover" | "hardcover") => void;
}) {
  const options: {
    key: "softcover" | "hardcover";
    label: string;
    price: string;
  }[] = [
    { key: "softcover", label: "Softcover", price: SOFTCOVER_PRICE_DISPLAY },
    { key: "hardcover", label: "Hardcover", price: HARDCOVER_PRICE_DISPLAY },
  ];
  return (
    <>
      <p className={styles.label} id="cover-label">
        Cover
      </p>
      <div
        className={styles.coverGrid}
        role="group"
        aria-labelledby="cover-label"
      >
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`${styles.coverOption} ${
              coverType === o.key ? styles.coverActive : ""
            }`}
            aria-pressed={coverType === o.key}
            onClick={() => setCoverType(o.key)}
          >
            <span className={styles.coverName}>{o.label}</span>
            <span className={styles.coverPrice}>{o.price}</span>
          </button>
        ))}
      </div>
    </>
  );
}
