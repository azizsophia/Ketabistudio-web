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
  /** background motif design: crescent | arch */
  theme?: string;
  /** colour scheme: midnight | plum | forest | light */
  scheme?: string;
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
  const theme = props.theme === "arch" ? "arch" : "crescent";
  const scheme = ["plum", "forest", "light"].includes(props.scheme || "")
    ? props.scheme
    : "midnight";

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
    <div
      className={`${styles.stage} ${styles[stage]} ${styles[`scheme_${scheme}`]}`}
    >
      <div className={styles.glow} aria-hidden="true" />
      {/* large outline motif in the background — a moon on the side, an arch
          in the back. Faint behind the cover, stronger once opened. */}
      <div className={`${styles.motif} ${styles[`motif_${theme}`]}`}>
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

/* Two modern Islamic motifs — moon and arch. On the cover card it's a small
   filled gold emblem; in the background it's a large thin OUTLINE (a moon on
   the side, an arch in the back). No star shapes of any kind. */
function Emblem({ theme, variant }: { theme: string; variant: "big" | "small" }) {
  const big = variant === "big";
  const cls = big ? styles.motifSvg : styles.coverMotif;

  if (theme === "arch") {
    return (
      <svg className={cls} viewBox="0 0 48 54" aria-hidden="true" fill="none">
        <g stroke="currentColor" strokeLinecap="round">
          <path d="M8 53 V23 C8 12 15 5 24 5 C33 5 40 12 40 23 V53" strokeWidth={big ? 1.1 : 1.5} />
          <path d="M14 53 V25 C14 16.5 18 11 24 11 C30 11 34 16.5 34 25 V53" strokeWidth={big ? 0.9 : 1.2} opacity="0.55" />
        </g>
      </svg>
    );
  }
  /* crescent moon */
  if (big) {
    /* big = thin outline */
    return (
      <svg className={cls} viewBox="0 0 48 48" aria-hidden="true" fill="none">
        <path
          d="M33 5 a19 19 0 1 0 0 38 a23.5 23.5 0 1 1 0 -38 Z"
          stroke="currentColor"
          strokeWidth="1.1"
        />
      </svg>
    );
  }
  /* small = filled moon */
  return (
    <svg className={cls} viewBox="0 0 48 48" aria-hidden="true" fill="none">
      <path
        d="M33 6 a18.5 18.5 0 1 0 0 36 a23 23 0 1 1 0 -36 Z"
        fill="currentColor"
      />
    </svg>
  );
}
