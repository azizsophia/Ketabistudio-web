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
      <Crescent />

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
          <MiniCrescent />
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

/* A small gold crescent motif for the cover card. */
function MiniCrescent() {
  return (
    <svg
      className={styles.coverMotif}
      viewBox="0 0 48 48"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M33 7 a18 18 0 1 0 0 34 a22 22 0 1 1 0 -34 Z"
        fill="currentColor"
        opacity="0.92"
      />
    </svg>
  );
}

/* A single thin mono-line crescent, bleeding off the top edge — the cultural
   signal, used as a quiet graphic device rather than an ornate border. */
function Crescent() {
  return (
    <svg
      className={styles.crescent}
      viewBox="0 0 200 200"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M140 20 a70 70 0 1 0 0 160 a86 86 0 1 1 0 -160 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.5"
      />
    </svg>
  );
}
