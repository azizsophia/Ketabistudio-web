"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  OCCASIONS,
  RELATIONSHIPS,
  findCard,
  CARD_MESSAGE_MAX,
  type CardItem,
} from "@/lib/cards";
import { CARD_PRICE_DISPLAY } from "@/lib/pricing";
import styles from "./CardMaker.module.css";

/* The card studio, rebuilt simple: pick a card → personalise the message →
   deliver. One premium house style (the print renderer); no collection/colour
   pickers. The front preview is the real rendered design; the inside shows the
   message + dua as you type. */

const COUNTRIES = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" }, { code: "BH", name: "Bahrain" },
  { code: "BE", name: "Belgium" }, { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" }, { code: "FI", name: "Finland" },
  { code: "FR", name: "France" }, { code: "DE", name: "Germany" },
  { code: "IE", name: "Ireland" }, { code: "IT", name: "Italy" },
  { code: "JO", name: "Jordan" }, { code: "KW", name: "Kuwait" },
  { code: "MY", name: "Malaysia" }, { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" }, { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" }, { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" }, { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" }, { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" }, { code: "CH", name: "Switzerland" },
  { code: "TR", name: "Turkey" }, { code: "AE", name: "United Arab Emirates" },
] as const;

type Step = "choose" | "personalise" | "deliver";

export default function CardMaker() {
  const [step, setStep] = useState<Step>("choose");
  const [itemId, setItemId] = useState<string>("");
  const card: CardItem | null = useMemo(
    () => (itemId ? findCard(itemId) : null),
    [itemId]
  );

  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("US");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function pick(id: string) {
    setItemId(id);
    setMessage(findCard(id).msg); // start from the suggestion; fully editable
    setStep("personalise");
    setError("");
  }

  async function placeOrder() {
    setError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Please enter a valid email address.");
    }
    if (!name.trim() || !line1.trim() || !city.trim() || !postcode.trim()) {
      return setError("Please complete the delivery address.");
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/cards/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          message: message.trim(),
          sender: sender.trim(),
          email: email.trim(),
          shipping: {
            name: name.trim(),
            line1: line1.trim(),
            line2: line2.trim(),
            city: city.trim(),
            state: state.trim(),
            postcode: postcode.trim(),
            country_code: country,
          },
        }),
      });
      const data = await r.json();
      if (r.ok && data.ok && data.orderId) {
        const c = await fetch("/api/cards/checkout", {
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

  /* ── step: choose a card ── */
  if (step === "choose") {
    return (
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className={styles.stepLabel}>Step 1 of 3</p>
          <h1 className={styles.heading}>Choose a card</h1>
          <p className={styles.sub}>
            Each card carries a vetted Arabic word and a dua, printed on thick
            324gsm fine paper and posted directly to whoever you choose.
          </p>

          <h2 className={styles.groupTitle}>For an occasion</h2>
          <div className={styles.grid}>
            {OCCASIONS.map((c) => (
              <CardTile key={c.id} c={c} onPick={pick} />
            ))}
          </div>

          <h2 className={styles.groupTitle}>For someone you love</h2>
          <div className={styles.grid}>
            {RELATIONSHIPS.map((c) => (
              <CardTile key={c.id} c={c} onPick={pick} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  /* ── step: personalise ── */
  if (step === "personalise" && card) {
    return (
      <section className={styles.section}>
        <div className={styles.makerGrid}>
          <aside className={styles.previewPane}>
            <p className={styles.previewLabel}>Front</p>
            <div className={styles.frontPreview}>
              <Image
                src={`/images/cards/${card.id}.jpg`}
                alt={`${card.title} card`}
                width={760}
                height={1075}
                className={styles.frontImg}
              />
            </div>
            <p className={styles.previewLabel}>Inside</p>
            <div className={styles.insidePreview}>
              <p className={styles.insideMsg}>
                {message.trim() || "Your message will appear here…"}
              </p>
              <span className={styles.insideRule} aria-hidden="true" />
              <p className={styles.insideDua}>{card.dua}</p>
              {sender.trim() && (
                <p className={styles.insideSender}>{sender.trim()}</p>
              )}
            </div>
          </aside>

          <div className={styles.formPane}>
            <p className={styles.stepLabel}>Step 2 of 3</p>
            <h1 className={styles.heading}>{card.title}</h1>
            <p className={styles.sub}>
              We&apos;ve written a message for you — make it yours.
            </p>

            <label className={styles.label} htmlFor="msg">Your message (inside)</label>
            <textarea
              id="msg"
              className={styles.textarea}
              value={message}
              maxLength={CARD_MESSAGE_MAX}
              rows={5}
              onChange={(e) => setMessage(e.target.value)}
            />
            <span
              className={`${styles.count} ${
                message.length >= CARD_MESSAGE_MAX ? styles.countMax : ""
              }`}
            >
              {message.length}/{CARD_MESSAGE_MAX}
            </span>

            <label className={styles.label} htmlFor="sender">Sign off (optional)</label>
            <input
              id="sender"
              className={styles.input}
              type="text"
              maxLength={40}
              placeholder="e.g. With love, Yusuf"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />

            <p className={styles.note}>
              The dua is printed beneath your message, and the inside-left is left
              blank for a handwritten note if you like.
            </p>

            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.btnRow}>
              <button className="btn btn-outline" onClick={() => setStep("choose")}>
                ← Cards
              </button>
              <button
                className={`btn btn-primary ${styles.nextBtn}`}
                onClick={() => {
                  setError("");
                  setStep("deliver");
                }}
              >
                Continue to delivery
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ── step: deliver ── */
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.stepLabel}>Step 3 of 3</p>
        <h1 className={styles.heading}>Where should we send it?</h1>
        <p className={styles.sub}>
          We print your card and post it directly to the recipient, worldwide.
        </p>

        <div className={styles.formGrid}>
          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="email">Your email (for the receipt)</label>
            <input id="email" className={styles.input} type="email"
              placeholder="you@example.com" autoComplete="email"
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
            <label className={styles.label} htmlFor="rname">Recipient&apos;s name</label>
            <input id="rname" className={styles.input} type="text"
              autoComplete="name" placeholder="Who it's going to"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="l1">Address line 1</label>
            <input id="l1" className={styles.input} type="text"
              autoComplete="address-line1"
              value={line1} onChange={(e) => setLine1(e.target.value)} />
          </div>
          <div className={styles.fieldFull}>
            <label className={styles.label} htmlFor="l2">Address line 2 (optional)</label>
            <input id="l2" className={styles.input} type="text"
              autoComplete="address-line2"
              value={line2} onChange={(e) => setLine2(e.target.value)} />
          </div>
          <div>
            <label className={styles.label} htmlFor="city">City</label>
            <input id="city" className={styles.input} type="text"
              autoComplete="address-level2"
              value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className={styles.label} htmlFor="state">State / Region</label>
            <input id="state" className={styles.input} type="text"
              autoComplete="address-level1"
              value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div>
            <label className={styles.label} htmlFor="zip">Postcode</label>
            <input id="zip" className={styles.input} type="text"
              autoComplete="postal-code"
              value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </div>
        </div>

        <div className={styles.priceSummary}>
          <div className={styles.priceRow}>
            <span>Greeting card (printed &amp; posted)</span>
            <span>{CARD_PRICE_DISPLAY}</span>
          </div>
          <p className={styles.priceNote}>
            Thick 324gsm fine paper · posted directly to the recipient.
          </p>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.btnRow}>
          <button className="btn btn-outline" onClick={() => setStep("personalise")}>
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

function CardTile({ c, onPick }: { c: CardItem; onPick: (id: string) => void }) {
  return (
    <button type="button" className={styles.tile} onClick={() => onPick(c.id)}>
      <span className={styles.tileImg}>
        <Image
          src={`/images/cards/${c.id}.jpg`}
          alt={`${c.title} card`}
          width={420}
          height={594}
          sizes="(max-width: 720px) 44vw, 240px"
        />
      </span>
      <span className={styles.tileTitle}>{c.title}</span>
    </button>
  );
}
