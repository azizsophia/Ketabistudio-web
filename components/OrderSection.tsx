"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./OrderSection.module.css";

const MAX_NAME = 14;

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

const HAIR_STYLES = [
  { key: "long-straight", label: "Long & straight" },
  { key: "long-curly", label: "Long & curly" },
  { key: "short-straight", label: "Short & straight" },
  { key: "short-curly", label: "Short & curly" },
] as const;

type Props = {
  slug: string;
  personalized: boolean;
};

type Step = "customize" | "shipping" | "confirm" | "done";

export default function OrderSection({ slug, personalized }: Props) {
  /* personalization */
  const [name, setName] = useState("");
  const [skin, setSkin] = useState<string>("medium");
  const [hair, setHair] = useState<string>("black");
  const [hairStyle, setHairStyle] = useState<string>("long-straight");

  /* shipping */
  const [email, setEmail] = useState("");
  const [shipName, setShipName] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");

  /* flow */
  const [step, setStep] = useState<Step>(personalized ? "customize" : "shipping");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");

  const shown = (name.trim() || "Amira").slice(0, MAX_NAME);

  async function placeOrder() {
    setError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!shipName.trim() || !street1.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setError("Please complete all shipping fields.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_slug: slug,
          child_name: personalized ? name.trim() || "Amira" : null,
          skin: personalized ? skin : null,
          hair: personalized ? hair : null,
          hair_style: personalized ? hairStyle : null,
          email: email.trim(),
          shipping: {
            name: shipName.trim(),
            street1: street1.trim(),
            street2: street2.trim(),
            city: city.trim(),
            state_code: state.trim(),
            postcode: zip.trim(),
            phone: phone.trim(),
          },
        }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setOrderId(data.orderId);
        setStep("done");
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── step: customize (personalized books) ── */
  if (step === "customize" && personalized) {
    return (
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className={styles.stepLabel}>Step 1 of 2</p>
          <h2 className={styles.heading}>Make her the star</h2>
          <p className={styles.sub}>
            Her name, her skin, her hair: watch the cover come to life.
          </p>

          <div className={styles.personalizerGrid}>
            <div className={styles.controls}>
              <label className={styles.label} htmlFor="kid-name">Her name</label>
              <input
                id="kid-name"
                className={styles.input}
                type="text"
                placeholder="Amira"
                maxLength={MAX_NAME}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />

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
                    className={`${styles.pill} ${hairStyle === s.key ? styles.pillActive : ""}`}
                    aria-pressed={hairStyle === s.key}
                    onClick={() => setHairStyle(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.previewCol}>
              <div className={styles.bookMock}>
                <Image
                  src={`/images/hero-${skin}-${hair}-${hairStyle}.jpg`}
                  alt="" width={800} height={800}
                  className={styles.bookImg}
                />
                <div className={styles.overlay}>
                  <span className={styles.bookName} style={{
                    fontSize: shown.length > 9
                      ? "clamp(1.1rem, 3.2vw, 1.8rem)"
                      : "clamp(1.4rem, 4.2vw, 2.4rem)",
                  }}>
                    {shown}
                  </span>
                  <span className={styles.bookSub}>and Her Beautiful Hijab</span>
                </div>
              </div>
            </div>
          </div>

          <button
            className={`btn btn-primary ${styles.nextBtn}`}
            onClick={() => setStep("shipping")}
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
            US shipping only at launch. Your book will be printed and shipped directly to you.
          </p>

          <div className={styles.formGrid}>
            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input id="email" className={styles.input} type="email"
                placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="ship-name">Full name</label>
              <input id="ship-name" className={styles.input} type="text"
                placeholder="Amira's family"
                value={shipName} onChange={(e) => setShipName(e.target.value)} />
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="street1">Address line 1</label>
              <input id="street1" className={styles.input} type="text"
                placeholder="123 Maple St"
                value={street1} onChange={(e) => setStreet1(e.target.value)} />
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="street2">Address line 2 (optional)</label>
              <input id="street2" className={styles.input} type="text"
                placeholder="Apt 4B"
                value={street2} onChange={(e) => setStreet2(e.target.value)} />
            </div>

            <div className={styles.fieldHalf}>
              <label className={styles.label} htmlFor="city">City</label>
              <input id="city" className={styles.input} type="text"
                placeholder="Starkville"
                value={city} onChange={(e) => setCity(e.target.value)} />
            </div>

            <div className={styles.fieldQuarter}>
              <label className={styles.label} htmlFor="state">State</label>
              <input id="state" className={styles.input} type="text"
                placeholder="MS" maxLength={2}
                value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
            </div>

            <div className={styles.fieldQuarter}>
              <label className={styles.label} htmlFor="zip">ZIP</label>
              <input id="zip" className={styles.input} type="text"
                placeholder="39759"
                value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="phone">Phone (optional)</label>
              <input id="phone" className={styles.input} type="tel"
                placeholder="(601) 555-0100"
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
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
              {submitting ? "Placing order..." : "Place order"}
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
            Your book is being generated now. We will review it personally before it goes to print, to make sure every page looks perfect. You will receive an email at <strong>{email}</strong> when it ships.
          </p>
          <p className={styles.orderId}>Order {orderId.slice(0, 8)}...</p>
        </div>
      </section>
    );
  }

  return null;
}
