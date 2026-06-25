"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  OCCASIONS,
  RELATIONSHIPS,
  findCard,
  cardColors,
  CARD_MESSAGE_MAX,
  type CardItem,
} from "@/lib/cards";
import { DIGITAL_CARD_PRICE_DISPLAY } from "@/lib/pricing";
import { CardFront, CardInside } from "./CardArt";
import styles from "./DigitalCardMaker.module.css";

/* The digital card studio: pick a card → personalise → choose how to deliver
   (a private link you share, optionally emailed to them too) → pay. No address,
   no shipping, no country gating — it sends worldwide, instantly. */

const NAME_MAX = 40;
type Step = "choose" | "personalise" | "deliver";

export default function DigitalCardMaker() {
  const [step, setStep] = useState<Step>("choose");
  const [itemId, setItemId] = useState<string>("");
  const card: CardItem | null = useMemo(
    () => (itemId ? findCard(itemId) : null),
    [itemId]
  );

  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("");
  const [accent, setAccent] = useState("");

  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoWarn, setPhotoWarn] = useState("");

  const [email, setEmail] = useState("");
  const [deliverEmail, setDeliverEmail] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function pick(id: string) {
    setItemId(id);
    setMessage(findCard(id).msg); // start from the suggestion; fully editable
    setAccent(cardColors(id)[0].hex);
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
    try {
      const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
        const im = new window.Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = rej;
        im.src = URL.createObjectURL(file);
      });
      if (Math.min(dims.w, dims.h) < 1000) {
        setPhotoWarn(
          "This photo is a little low-resolution. A larger, high-quality photo looks best."
        );
      }
    } catch {
      /* non-fatal */
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
      return setError("Please enter a valid email for your receipt.");
    }
    if (
      deliverEmail &&
      (!recipientEmail.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()))
    ) {
      return setError("Please enter a valid email address to send the card to.");
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/digital-cards/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          message: message.trim(),
          sender: sender.trim(),
          recipient_name: recipient.trim(),
          accent,
          photo_url: photoUrl || undefined,
          email: email.trim(),
          deliver_email: deliverEmail,
          recipient_email: deliverEmail ? recipientEmail.trim() : undefined,
        }),
      });
      const data = await r.json();
      if (r.ok && data.ok && data.orderId) {
        const c = await fetch("/api/digital-cards/checkout", {
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
            A beautiful animated card, delivered by a private link in minutes —
            ready to share by text, WhatsApp or email, anywhere in the world.{" "}
            <Link href="/c/demo" target="_blank" className={styles.demoLink}>
              See how it opens →
            </Link>
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
            <div className={styles.cardFrame}>
              <CardFront card={card} accent={accent} photoUrl={photoUrl} />
            </div>
            <p className={styles.previewLabel}>Inside</p>
            <div className={styles.cardFrame}>
              <CardInside
                card={card}
                accent={accent}
                message={message}
                sender={sender}
                recipientName={recipient}
              />
            </div>
          </aside>

          <div className={styles.formPane}>
            <p className={styles.stepLabel}>Step 2 of 3</p>
            <h1 className={styles.heading}>{card.title}</h1>
            <p className={styles.sub}>
              We&apos;ve written a message for you — make it yours.
            </p>

            <label className={styles.label} htmlFor="to">Who it&apos;s for</label>
            <input
              id="to"
              className={styles.input}
              type="text"
              maxLength={NAME_MAX}
              placeholder="Their name, e.g. Amira"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <p className={styles.hint}>
              Appears as &ldquo;Dear &hellip;&rdquo; inside, and their initial is
              pressed into the wax seal on the envelope.
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
              maxLength={NAME_MAX}
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

            <span className={styles.label}>Front cover photo (optional)</span>
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
                Continue
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
        <h1 className={styles.heading}>How should we deliver it?</h1>
        <p className={styles.sub}>
          The moment you pay, you get a private link to your card — share it by
          text, WhatsApp or anywhere you like. We can email it to them too.
        </p>

        <label className={styles.label} htmlFor="email">Your email (for the receipt &amp; your link)</label>
        <input id="email" className={styles.input} type="email"
          placeholder="you@example.com" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={deliverEmail}
            onChange={(e) => setDeliverEmail(e.target.checked)}
          />
          <span>Also email the card straight to them</span>
        </label>

        {deliverEmail && (
          <>
            <label className={styles.label} htmlFor="remail">
              Their email
            </label>
            <input id="remail" className={styles.input} type="email"
              placeholder="their@email.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)} />
            <p className={styles.hint}>
              We&apos;ll send them a beautiful note with a button to open the
              card{recipient.trim() ? `, addressed to ${recipient.trim()}` : ""}.
            </p>
          </>
        )}

        <div className={styles.priceSummary}>
          <div className={styles.priceRow}>
            <span>Digital greeting card</span>
            <span>{DIGITAL_CARD_PRICE_DISPLAY}</span>
          </div>
          <p className={styles.priceNote}>
            Delivered instantly by link · no postage, no waiting · share it
            anywhere in the world.
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
