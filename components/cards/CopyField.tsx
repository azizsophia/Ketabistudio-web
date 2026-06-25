"use client";

import { useState } from "react";
import styles from "../../app/digital-cards/success/success.module.css";

export default function CopyField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <div className={styles.copyRow}>
      <input
        className={styles.copyInput}
        value={url}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Your card link"
      />
      <button type="button" className={styles.copyBtn} onClick={copy}>
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
