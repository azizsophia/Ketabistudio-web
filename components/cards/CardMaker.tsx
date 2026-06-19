"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  OCCASIONS,
  RELATIONSHIPS,
  findCard,
  cardColors,
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
  const [accent, setAccent] = useState("");

  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoWarn, setPhotoWarn] = useState("");

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
    setAccent(cardColors(id)[0].hex); // default to the card's first colour
    setPhotoUrl("");
    setPhotoWarn("");
    setStep("personalise");
    setError("");
  }

  async function uploadPhoto(file: File) {
    setError("");
    setPhotoWarn("");
    if (!file.type.startsWith("image/")) {
      return setError("Please choose an image file.");
    }
    // gently warn on a low-resolution photo (the front prints ~5x7 inches)
    try {
      const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
        const im = new window.Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = rej;
        im.src = URL.createObjectURL(file);
      });
      if (Math.min(dims.w, dims.h) < 1200) {
        setPhotoWarn(
          "This photo is a little low-resolution, it may look soft in print. A larger, high quality photo prints best."
        );
      }
    } catch {
      /* non-fatal: still allow the upload */
    }
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/cards/photo", { method: "POST", body: fd });
      const data = await r.json();
      if (r.ok && data.url) {
        setPhotoUrl(data.url);
      } else {
        setError(data.error || "Could not upload that photo. Please try again.");
      }
    } catch {
      setError("Network error uploading the photo. Please try again.");
    } finally {
      setPhotoBusy(false);
    }
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
          accent,
          photo_url: photoUrl || undefined,
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
              <Front card={card} accent={accent} photoUrl={photoUrl} />
            </div>
            <p className={styles.previewLabel}>Inside</p>
            <div className={styles.insidePreview}>
              <p className={styles.insideMsg}>
                {message.trim() || "Your message will appear here…"}
              </p>
              <span
                className={styles.insideRule}
                style={{ backgroundColor: accent || undefined }}
                aria-hidden="true"
              />
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

            <span className={styles.label}>Cover colour</span>
            <div className={styles.swatchRow}>
              {cardColors(card.id).map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`${styles.swatch} ${
                    accent === c.hex ? styles.swatchOn : ""
                  }`}
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.name}
                  aria-pressed={accent === c.hex}
                  title={c.name}
                  onClick={() => setAccent(c.hex)}
                />
              ))}
            </div>

            <label className={styles.label} htmlFor="photo">
              Front cover photo (optional)
            </label>
            {photoUrl ? (
              <div className={styles.photoRow}>
                <span className={styles.photoOk}>Photo added ✓</span>
                <button
                  type="button"
                  className={styles.photoRemove}
                  onClick={() => {
                    setPhotoUrl("");
                    setPhotoWarn("");
                  }}
                >
                  Remove
                </button>
                <label className={styles.photoReplace}>
                  Replace
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) =>
                      e.target.files?.[0] && uploadPhoto(e.target.files[0])
                    }
                  />
                </label>
              </div>
            ) : (
              <label className={styles.photoUpload}>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) =>
                    e.target.files?.[0] && uploadPhoto(e.target.files[0])
                  }
                />
                {photoBusy ? "Uploading…" : "Tap to add your photo"}
              </label>
            )}
            {photoWarn && <p className={styles.warn}>{photoWarn}</p>}
            <p className={styles.hint}>
              For best results use a clear, high-resolution photo. Faces and key
              details look best kept out of the very bottom, where the wording
              sits.
            </p>

            <p className={styles.note}>
              Add a photo and it becomes the front cover, with the {card.title}{" "}
              wording set over it. The dua is printed beneath your message inside,
              and the inside-left is left blank for a handwritten note if you like.
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

/* The live front preview — mirrors the print renderer. With a photo: full-bleed
   photo, a soft bottom scrim, type bottom-anchored in ivory + gold. Without a
   photo: the chosen accent fills the cover, type centred. Either way the type
   is gold + ivory so it stays legible. */
function Front({
  card,
  accent,
  photoUrl,
}: {
  card: CardItem;
  accent: string;
  photoUrl: string;
}) {
  const big = card.group === "occasion" ? card.words[0]?.ar : card.word.ar;
  const translit =
    card.group === "occasion" ? card.words[0]?.translit : card.word.translit;
  const line2 = card.group === "occasion" ? card.en : card.headlineEn;
  const type = (
    <div className={styles.pfType}>
      <span className={styles.pfEyebrow}>{card.eyebrow.toUpperCase()}</span>
      <span className={styles.pfBig} dir="rtl" lang="ar">
        {big}
      </span>
      {translit && <span className={styles.pfTranslit}>{translit}</span>}
      <span className={styles.pfRule} aria-hidden="true" />
      <span className={styles.pfLine2}>{line2}</span>
    </div>
  );
  if (photoUrl) {
    return (
      <div
        className={`${styles.coverFront} ${styles.coverPhoto}`}
        style={{ backgroundImage: `url(${photoUrl})` }}
      >
        <div className={styles.photoScrim} />
        {type}
      </div>
    );
  }
  return (
    <div
      className={`${styles.coverFront} ${styles.coverSolid}`}
      style={{ backgroundColor: accent || "#1f6b5a" }}
    >
      {type}
    </div>
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
