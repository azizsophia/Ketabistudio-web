"use client";

import { useState } from "react";
import styles from "../../app/digital-cards/success/success.module.css";

/* Share block for the success page: copy the link, share it from the sender's
   own WhatsApp (so it's warm + never spam), or use the native share sheet. */
export default function CopyField({
  url,
  recipientName,
}: {
  url: string;
  recipientName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const to = recipientName?.trim();

  const message = to
    ? `Assalamu alaikum ${to} 🌙 I sent you a little something — open your card here: ${url}`
    : `Assalamu alaikum 🌙 I sent you a little something — open your card here: ${url}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "A card for you",
          text: to ? `A card for ${to} 🌙` : "A card for you 🌙",
          url,
        });
      } catch {
        /* user dismissed — no-op */
      }
    } else {
      copy();
    }
  }

  return (
    <>
      <div className={styles.copyRow}>
        <input
          className={styles.copyInput}
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Your card link"
        />
        <button type="button" className={styles.copyBtn} onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className={styles.shareRow}>
        <a
          className={styles.waBtn}
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden="true">✆</span> Share on WhatsApp
        </a>
        <button type="button" className={styles.shareBtn} onClick={nativeShare}>
          Share…
        </button>
      </div>
    </>
  );
}
