"use client";

import { useEffect, useRef, useState } from "react";
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
  /** optional recorded voice note (mp3) that plays inside the opened card */
  voiceUrl?: string;
  /** background motif design: crescent | arch | rings | lantern | rose */
  theme?: string;
  /** colour scheme: midnight | plum | forest | light */
  scheme?: string;
  /** public link slug — used to notify the sender on a real open (not demo) */
  token?: string;
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

  /* On the first real open, quietly tell the sender "your card was opened".
     This fires only in a real browser once the card is revealed — link-preview
     crawlers (WhatsApp, iMessage, etc.) fetch the HTML without running this, so
     an unfurl never counts as an open. Demo cards never notify. */
  const notified = useRef(false);
  useEffect(() => {
    if (stage !== "revealed" || notified.current) return;
    const t = props.token;
    if (!t || t === "demo") return;
    notified.current = true;
    try {
      const body = JSON.stringify({ token: t });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/digital-cards/opened",
          new Blob([body], { type: "application/json" })
        );
      } else {
        fetch("/api/digital-cards/opened", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* notification is best-effort — never block the card */
    }
  }, [stage, props.token]);

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
  const theme = ["arch", "rings", "lantern", "rose"].includes(props.theme || "")
    ? (props.theme as string)
    : "crescent";
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
      className={`${styles.stage} ${
        stage === "revealed" ? styles.revealed : ""
      } ${styles[`scheme_${scheme}`]}`}
    >
      <div className={styles.glow} aria-hidden="true" />
      {/* large outline motif in the background — a moon on the side, an arch
          in the back. Faint behind the cover, stronger once opened. */}
      <div className={`${styles.motif} ${styles[`motif_${theme}`]}`}>
        <Emblem theme={theme} variant="big" />
      </div>

      {/* Cover — a closed card you tap to open. With a photo it becomes a
          full-bleed photo cover; without one, the elegant jewel card. */}
      <button
        type="button"
        className={`${styles.cover} ${props.photoUrl ? styles.coverHasPhoto : ""}`}
        onClick={reveal}
        disabled={stage !== "cover"}
        aria-hidden={stage !== "cover"}
        aria-label="Open your card"
      >
        {props.photoUrl ? (
          <>
            <span
              className={styles.coverPhoto}
              style={{ backgroundImage: `url(${props.photoUrl})` }}
            />
            <span className={styles.coverPhotoScrim} aria-hidden="true" />
          </>
        ) : (
          <span className={styles.coverShine} aria-hidden="true" />
        )}
        <span className={styles.coverInner}>
          {!props.photoUrl && <Emblem theme={theme} variant="small" />}
          <span className={styles.coverEyebrow}>A gift for you</span>
          {recipient && <span className={styles.coverName}>{recipient}</span>}
          {!props.photoUrl && (
            <span className={styles.coverRule} aria-hidden="true" />
          )}
          <span className={styles.coverHint}>
            <span className={styles.coverPulse} aria-hidden="true" />
            Tap to open
          </span>
        </span>
      </button>

      {/* Card */}
      <article className={styles.card} aria-hidden={stage !== "revealed"}>
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

        {props.voiceUrl && (
          <div className={styles.voiceWrap}>
            <p className={styles.voiceLabel} style={{ color: accent }}>
              A voice note for you
            </p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              className={styles.voicePlayer}
              src={props.voiceUrl}
              controls
              preload="metadata"
            />
          </div>
        )}

        <div className={styles.duaWrap}>
          <p className={styles.duaLabel} style={{ color: accent }}>
            A dua for you
          </p>
          <p className={styles.dua}>{card.dua}</p>
        </div>

        {sender && <p className={styles.sender}>{sender}</p>}

        <div className={styles.made}>
          <p className={styles.madeLead}>Want to send one like this?</p>
          <Link
            href="/digital-cards?utm_source=card&utm_medium=viral&utm_campaign=make-your-own"
            className={styles.madeCta}
            style={{ borderColor: accent, color: accent }}
          >
            Make your own with Ketabi →
          </Link>
        </div>
      </article>

      {/* keep reduced-motion users from missing the (now-skipped) cover */}
      {reduced && null}
    </div>
  );
}

/* Premium modern-Islamic motifs. On the cover card it's a small gold emblem;
   in the background it's a large thin outline. No star shapes of any kind. */
export function Emblem({ theme, variant }: { theme: string; variant: "big" | "small" }) {
  const big = variant === "big";
  const cls = big ? styles.motifSvg : styles.coverMotif;
  const sw = big ? 1.5 : 2; // background reads thinner, cover emblem a touch bolder

  if (theme === "arch") {
    return (
      <svg className={cls} viewBox="0 0 48 56" aria-hidden="true" fill="none">
        <g stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
          <circle cx="24" cy="5" r="1.7" fill="currentColor" stroke="none" />
          <path d="M9 55 V27 C9 16 16 9 24 7 C32 9 39 16 39 27 V55" />
          <path d="M14.5 55 V29 C14.5 20 19 14 24 12 C29 14 33.5 20 33.5 29 V55" opacity="0.5" />
        </g>
      </svg>
    );
  }
  if (theme === "rings") {
    return (
      <svg className={cls} viewBox="0 0 52 48" aria-hidden="true" fill="none">
        <g stroke="currentColor" strokeWidth={sw}>
          <circle cx="19" cy="25" r="12.5" />
          <circle cx="33" cy="25" r="12.5" />
        </g>
      </svg>
    );
  }
  if (theme === "lantern") {
    return (
      <svg className={cls} viewBox="0 0 48 56" aria-hidden="true" fill="none">
        <g stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <path d="M24 4 v3.5" />
          <ellipse cx="24" cy="9.5" rx="3" ry="1.5" />
          <path d="M18 13 h12 l1.5 4 h-15 z" />
          <path d="M16.5 17 h15 v22 q0 4 -3.5 5 h-8 q-3.5 -1 -3.5 -5 z" />
          <path d="M24 17 v27" opacity="0.4" />
          <path d="M21.5 44.5 h5 l-1.2 4 h-2.6 z" />
        </g>
      </svg>
    );
  }
  if (theme === "rose") {
    return (
      <svg className={cls} viewBox="0 0 48 52" aria-hidden="true" fill="none">
        <g stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 20 C16 12 32 12 32 21 C32 27 27 30 24 30 C19 30 17 26 18.5 22.5 C20 19.5 25 19.5 25.5 23" />
          <path d="M24 30 V47" />
          <path d="M24 37 C21 34.5 17 35 15 36.5 C17 39.5 21 40 24 38.5" />
          <path d="M24 40 C27 37.5 31 38 33 39.5 C31 42.5 27 43 24 41.5" />
        </g>
      </svg>
    );
  }
  /* crescent moon — filled on the cover, a clean outline in the background */
  return (
    <svg className={cls} viewBox="0 0 48 48" aria-hidden="true" fill="none">
      <path
        d="M24 5 a19 19 0 1 0 0 38 a13 19 0 1 1 0 -38 Z"
        fill={big ? "none" : "currentColor"}
        stroke={big ? "currentColor" : "none"}
        strokeWidth={big ? 1.6 : 0}
      />
    </svg>
  );
}
