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
import { CardInside } from "./CardArt";
import { Emblem } from "./DigitalCardViewer";
import {
  MOTIFS,
  SCHEMES,
  defaultMotif,
  schemeStyle,
} from "@/lib/digitalCard";
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
  const [theme, setTheme] = useState("crescent");
  const [scheme, setScheme] = useState("midnight");

  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoWarn, setPhotoWarn] = useState("");

  const [email, setEmail] = useState("");
  const [deliverEmail, setDeliverEmail] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [schedLocal, setSchedLocal] = useState(""); // "YYYY-MM-DDTHH:mm"
  const [schedTz, setSchedTz] = useState(detectTz());

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scheduledIso =
    deliverEmail && sendMode === "schedule" && schedLocal
      ? zonedToUtcIso(schedLocal, schedTz)
      : "";

  function pick(id: string) {
    setItemId(id);
    setMessage(findCard(id).msg); // start from the suggestion; fully editable
    setAccent(cardColors(id)[0].hex);
    setTheme(defaultMotif(id)); // a fitting motif to start from
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
    if (deliverEmail && sendMode === "schedule") {
      if (!schedLocal) {
        return setError("Please choose when we should email the card.");
      }
      if (!scheduledIso || Date.parse(scheduledIso) <= Date.now() + 60_000) {
        return setError("Please choose a delivery time in the future.");
      }
      if (Date.parse(scheduledIso) > Date.now() + MAX_SCHEDULE_DAYS * 864e5) {
        return setError(
          `You can schedule delivery up to ${MAX_SCHEDULE_DAYS} days ahead. To send earlier, choose “Send now”.`
        );
      }
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
          theme,
          scheme,
          photo_url: photoUrl || undefined,
          email: email.trim(),
          deliver_email: deliverEmail,
          recipient_email: deliverEmail ? recipientEmail.trim() : undefined,
          scheduled_at: scheduledIso || undefined,
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
            <p className={styles.previewLabel}>Cover</p>
            <CoverPreview
              theme={theme}
              scheme={scheme}
              recipient={recipient}
              photoUrl={photoUrl}
            />
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
              Appears as the name on the cover, and as &ldquo;Dear
              &hellip;&rdquo; inside.
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

            <span className={styles.label}>Design</span>
            <div className={styles.motifRow}>
              {MOTIFS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`${styles.motifBtn} ${
                    theme === m.key ? styles.motifOn : ""
                  }`}
                  aria-pressed={theme === m.key}
                  title={m.label}
                  onClick={() => setTheme(m.key)}
                >
                  <Emblem theme={m.key} variant="small" />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            <span className={styles.label}>Colour</span>
            <div className={styles.swatchRow}>
              {SCHEMES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`${styles.swatch} ${
                    scheme === s.key ? styles.swatchOn : ""
                  }`}
                  style={{ background: s.dot }}
                  aria-label={s.label}
                  aria-pressed={scheme === s.key}
                  title={s.label}
                  onClick={() => setScheme(s.key)}
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

            <span className={styles.label}>When should we email it?</span>
            <div className={styles.sendModeRow}>
              <button
                type="button"
                className={`${styles.sendModeBtn} ${
                  sendMode === "now" ? styles.sendModeOn : ""
                }`}
                aria-pressed={sendMode === "now"}
                onClick={() => setSendMode("now")}
              >
                Send now
              </button>
              <button
                type="button"
                className={`${styles.sendModeBtn} ${
                  sendMode === "schedule" ? styles.sendModeOn : ""
                }`}
                aria-pressed={sendMode === "schedule"}
                onClick={() => setSendMode("schedule")}
              >
                Schedule it
              </button>
            </div>

            {sendMode === "schedule" && (
              <>
                <div className={styles.schedGrid}>
                  <input
                    className={styles.input}
                    type="datetime-local"
                    value={schedLocal}
                    min={minSchedLocal()}
                    max={maxSchedLocal()}
                    onChange={(e) => setSchedLocal(e.target.value)}
                    aria-label="Delivery date and time"
                  />
                  <select
                    className={styles.input}
                    value={schedTz}
                    onChange={(e) => setSchedTz(e.target.value)}
                    aria-label="Timezone"
                  >
                    {tzOptions().map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className={styles.hint}>
                  {scheduledIso
                    ? `We'll email it ${describeSchedule(schedLocal, schedTz)}. Your private link works straight away — only the email waits.`
                    : `Pick the day and time they should receive it — up to ${MAX_SCHEDULE_DAYS} days ahead, perfect for Eid morning.`}
                </p>
              </>
            )}
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

/* A faithful static preview of the closed cover card — reflects the chosen
   motif, colour scheme and recipient name as the buyer designs. */
function CoverPreview({
  theme,
  scheme,
  recipient,
  photoUrl,
}: {
  theme: string;
  scheme: string;
  recipient: string;
  photoUrl: string;
}) {
  const s = schemeStyle(scheme);
  const hasPhoto = !!photoUrl;
  return (
    <div
      className={`${styles.coverPreview} ${hasPhoto ? styles.cpHasPhoto : ""}`}
      style={{
        background: hasPhoto ? "#10131a" : s.coverBg,
        borderColor: s.border,
      }}
    >
      {hasPhoto && (
        <>
          <span
            className={styles.cpPhoto}
            style={{ backgroundImage: `url(${photoUrl})` }}
          />
          <span className={styles.cpScrim} />
        </>
      )}
      <span className={styles.cpContent}>
        {!hasPhoto && (
          <span className={styles.cpMotif} style={{ color: s.gold }}>
            <Emblem theme={theme} variant="small" />
          </span>
        )}
        <span
          className={styles.cpEyebrow}
          style={{ color: hasPhoto ? "rgba(255,248,235,0.85)" : s.eyebrow }}
        >
          A gift for you
        </span>
        <span
          className={styles.cpName}
          style={{ color: hasPhoto ? "#fff" : s.name }}
        >
          {recipient.trim() || "Their name"}
        </span>
        {!hasPhoto && (
          <span className={styles.cpRule} style={{ background: s.rule }} />
        )}
        <span
          className={styles.cpHint}
          style={{ color: hasPhoto ? "rgba(255,248,235,0.82)" : s.hint }}
        >
          <span className={styles.cpDot} style={{ background: s.gold }} />
          Tap to open
        </span>
      </span>
    </div>
  );
}

/* The buyer's own timezone, used as the sensible default for scheduling. */
function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh";
  } catch {
    return "Asia/Riyadh";
  }
}

/* A short list of timezones that cover the Gulf + the common diaspora, with the
   buyer's detected zone pinned first so most people never touch it. */
function tzOptions(): { value: string; label: string }[] {
  const base = [
    { value: "Asia/Riyadh", label: "Saudi Arabia (Riyadh)" },
    { value: "Asia/Dubai", label: "UAE (Dubai)" },
    { value: "Asia/Qatar", label: "Qatar (Doha)" },
    { value: "Asia/Kuwait", label: "Kuwait" },
    { value: "Africa/Cairo", label: "Egypt (Cairo)" },
    { value: "Europe/London", label: "UK (London)" },
    { value: "America/New_York", label: "US East (New York)" },
    { value: "America/Los_Angeles", label: "US West (Los Angeles)" },
  ];
  const detected = detectTz();
  const rest = base.filter((o) => o.value !== detected);
  const detectedLabel =
    base.find((o) => o.value === detected)?.label || detected;
  return [{ value: detected, label: `${detectedLabel} — your time` }, ...rest];
}

/* Convert a wall-clock "YYYY-MM-DDTHH:mm" in `timeZone` to a UTC ISO instant.
   Works without a date library by measuring the zone's offset at that instant
   via Intl, so "9:00am on Eid in Riyadh" lands correctly wherever the buyer is. */
function zonedToUtcIso(local: string, timeZone: string): string {
  try {
    const [datePart, timePart] = local.split("T");
    if (!datePart || !timePart) return "";
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    const asUTC = Date.UTC(y, m - 1, d, hh, mm);
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(new Date(asUTC));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    let hour = get("hour");
    if (hour === 24) hour = 0;
    const tzAsUTC = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      hour,
      get("minute"),
      get("second")
    );
    const offset = tzAsUTC - asUTC;
    return new Date(asUTC - offset).toISOString();
  } catch {
    return "";
  }
}

/* The email service (Resend) only honours a scheduled send up to 30 days
   out, so that's the hard ceiling on how far ahead a card can be scheduled.
   We leave a small buffer so the order→payment gap can't push it over. */
export const MAX_SCHEDULE_DAYS = 30;

function localStamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* Floor for the date picker: a few minutes from now, in the buyer's local
   clock (the format the datetime-local input expects). */
function minSchedLocal(): string {
  return localStamp(Date.now() + 5 * 60_000);
}

/* Ceiling for the date picker: 30 days out, the furthest we can reliably
   deliver. */
function maxSchedLocal(): string {
  return localStamp(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60_000);
}

/* A friendly read-back of the chosen wall-clock time + zone, e.g.
   "on Fri, 20 Mar at 9:00 AM (Saudi Arabia)". */
function describeSchedule(local: string, timeZone: string): string {
  try {
    const [datePart, timePart] = local.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    const dt = new Date(y, m - 1, d, hh, mm);
    const day = dt.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const time = dt.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const tzLabel =
      tzOptions()
        .find((o) => o.value === timeZone)
        ?.label.replace(" — your time", "") || timeZone;
    return `on ${day} at ${time} (${tzLabel})`;
  } catch {
    return "at the time you chose";
  }
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
