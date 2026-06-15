"use client";

import { useState } from "react";
import styles from "../../hifz.module.css";

export default function Ayah({
  verseKey,
  ayahNumber,
  arabic,
  translation,
  audioUrl,
  initialMemorized,
}: {
  verseKey: string;
  ayahNumber: number;
  arabic: string;
  translation: string | null;
  audioUrl: string | null;
  initialMemorized: boolean;
}) {
  const [memorized, setMemorized] = useState(initialMemorized);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !memorized;
    setSaving(true);
    // optimistic
    setMemorized(next);
    try {
      const res = await fetch("/api/hifz/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verse_key: verseKey,
          action: next ? "memorize" : "unmemorize",
        }),
      });
      if (!res.ok) setMemorized(!next); // revert on failure
    } catch {
      setMemorized(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.ayah}>
      <div className={styles.ayahHead}>
        <span className={styles.ayahNum}>{ayahNumber}</span>
      </div>

      <p className={styles.arabicText}>{arabic}</p>

      {translation && (
        <p
          className={styles.translation}
          dangerouslySetInnerHTML={{ __html: translation }}
        />
      )}

      <div className={styles.ayahControls}>
        {audioUrl && (
          <audio className={styles.audio} controls preload="none" src={audioUrl} />
        )}
        <button
          type="button"
          className={`${styles.memBtn} ${memorized ? styles.memBtnOn : ""}`}
          onClick={toggle}
          disabled={saving}
        >
          {memorized ? "Memorized ✓" : "Mark memorized"}
        </button>
      </div>
    </div>
  );
}
