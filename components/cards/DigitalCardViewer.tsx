"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { findCard } from "@/lib/cards";
import styles from "./DigitalCardViewer.module.css";

export type DigitalCardView = {
  itemId: string;
  accent: string;
  message: string;
  sender: string;
  recipientName: string;
  photoUrl?: string;
  /** background motif design: crescent | arch | lantern | arabesque */
  theme?: string;
};

type Stage = "cover" | "revealed";

/* A modern "Light Reveal": a calm full-screen cover that, on tap, dissolves
   (blur + scale) while the card resolves into focus — the Arabic word, the
   message, and the dua arriving in sequence. No envelope, no skeuomorphism.
   Respects prefers-reduced-motion (renders the card straight away, no motion). */
export default function DigitalCardViewer(props: DigitalCardView) {
  const card = findCard(props.itemId);
  const [stage, setStage] = useState<Stage>("cover");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    if (m.matches) setStage("revealed");
  }, []);

  /* hero word + occasion line, from the card data */
  const heroAr = card.group === "occasion" ? card.words[0]?.ar : card.word.ar;
  const rawTranslit =
    card.group === "occasion" ? card.words[0]?.translit : card.word.translit;
  /* hide the transliteration when it just repeats the eyebrow (e.g. Eid) */
  const heroTranslit =
    rawTranslit && rawTranslit.toLowerCase() !== card.eyebrow.toLowerCase()
      ? rawTranslit
      : "";
  const occasionEn = card.group === "occasion" ? card.en : card.headlineEn;

  const recipient = props.recipientName.trim();
  const sender = props.sender.trim();
  const message = props.message.trim();
  const accent = props.accent || "#2c6e6a";
  const theme = props.theme || "crescent";

  function reveal() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        /* ignore */
      }
    }
    setStage("revealed");
  }

  return (
    <div className={`${styles.stage} ${styles[stage]}`}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.motif}>
        <Emblem theme={theme} variant="big" />
      </div>

      {/* Cover — a closed card you tap to open */}
      <button
        type="button"
        className={styles.cover}
        onClick={reveal}
        disabled={stage !== "cover"}
        aria-hidden={stage !== "cover"}
        aria-label="Open your card"
      >
        <span className={styles.coverShine} aria-hidden="true" />
        <span className={styles.coverInner}>
          <Emblem theme={theme} variant="small" />
          <span className={styles.coverEyebrow}>A gift for you</span>
          {recipient && <span className={styles.coverName}>{recipient}</span>}
          <span className={styles.coverRule} aria-hidden="true" />
          <span className={styles.coverHint}>
            <span className={styles.coverPulse} aria-hidden="true" />
            Tap to open
          </span>
        </span>
      </button>

      {/* Card */}
      <article className={styles.card} aria-hidden={stage !== "revealed"}>
        {props.photoUrl && (
          <div
            className={styles.photo}
            style={{ backgroundImage: `url(${props.photoUrl})` }}
            role="img"
            aria-label="Your photo"
          />
        )}
        <p className={styles.eyebrow} style={{ color: accent }}>
          {card.eyebrow}
        </p>
        <p className={styles.hero} lang="ar" dir="rtl">
          {heroAr}
        </p>
        {heroTranslit && <p className={styles.translit}>{heroTranslit}</p>}
        {occasionEn && <p className={styles.occasion}>{occasionEn}</p>}

        <span
          className={styles.divider}
          style={{ background: accent }}
          aria-hidden="true"
        />

        {recipient && <p className={styles.dear}>Dear {recipient},</p>}
        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.duaWrap}>
          <p className={styles.duaLabel} style={{ color: accent }}>
            A dua for you
          </p>
          <p className={styles.dua}>{card.dua}</p>
        </div>

        {sender && <p className={styles.sender}>{sender}</p>}

        <p className={styles.made}>
          <Link href="/digital-cards" className={styles.madeLink}>
            Make your own card
          </Link>
        </p>
      </article>

      {/* keep reduced-motion users from missing the (now-skipped) cover */}
      {reduced && null}
    </div>
  );
}

/* Modern Islamic motifs — line-art emblems used as the card's design theme.
   Small (gold, on the cover card) and big (faint, in the night sky behind).
   Deliberately NO star shapes of any kind. */
function Emblem({ theme, variant }: { theme: string; variant: "big" | "small" }) {
  const cls = variant === "big" ? styles.motifSvg : styles.coverMotif;
  const sw = variant === "big" ? 1.3 : 1.5;

  if (theme === "arch") {
    return (
      <svg className={cls} viewBox="0 0 48 54" aria-hidden="true" fill="none">
        <g stroke="currentColor" strokeLinecap="round">
          <path d="M8 53 V23 C8 12 15 5 24 5 C33 5 40 12 40 23 V53" strokeWidth={sw} />
          <path d="M14 53 V25 C14 16.5 18 11 24 11 C30 11 34 16.5 34 25 V53" strokeWidth={sw * 0.8} opacity="0.55" />
        </g>
      </svg>
    );
  }
  if (theme === "lantern") {
    return (
      <svg className={cls} viewBox="0 0 48 56" aria-hidden="true" fill="none">
        <g stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <circle cx="24" cy="5" r="2.2" />
          <path d="M24 7.2 V11" />
          <path d="M16.5 15 H31.5 L33.5 19 H14.5 Z" />
          <path d="M16 19 H32 V44 Q32 48 24 49 Q16 48 16 44 Z" />
          <path d="M24 19 V47" opacity="0.5" />
          <path d="M21.5 49 H26.5 L25 53 H23 Z" />
        </g>
      </svg>
    );
  }
  if (theme === "arabesque") {
    return (
      <svg className={cls} viewBox="0 0 48 52" aria-hidden="true" fill="none">
        <g stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
          <path d="M24 5 C15 15 15 26 24 33 C33 26 33 15 24 5 Z" />
          <path d="M24 33 V48" />
          <path d="M24 39 C19.5 36.5 16 39 15 43.5" />
          <path d="M24 39 C28.5 36.5 32 39 33 43.5" />
        </g>
      </svg>
    );
  }
  /* crescent (default) — a filled moon */
  return (
    <svg className={cls} viewBox="0 0 48 48" aria-hidden="true" fill="none">
      <path
        d="M33 6 a18.5 18.5 0 1 0 0 36 a23 23 0 1 1 0 -36 Z"
        fill="currentColor"
      />
    </svg>
  );
}
