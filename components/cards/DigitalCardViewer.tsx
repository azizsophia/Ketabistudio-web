"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { findCard } from "@/lib/cards";
import { CardFront, CardInside } from "./CardArt";
import styles from "./DigitalCardViewer.module.css";

export type DigitalCardView = {
  itemId: string;
  accent: string;
  message: string;
  sender: string;
  recipientName: string;
  photoUrl?: string;
};

type Stage = "sealed" | "front" | "open";

/* The luxury motion experience. A sealed envelope rests, gold seal glinting;
   a tap breaks the seal and the card rises out; a second tap opens it like a
   real greeting card to reveal the message + dua inside. Respects
   prefers-reduced-motion (renders a calm, static stacked layout instead). */
export default function DigitalCardViewer(props: DigitalCardView) {
  const card = findCard(props.itemId);
  const [stage, setStage] = useState<Stage>("sealed");
  const [reduced, setReduced] = useState(false);

  /* The wax seal carries the recipient's initial, so it feels pressed just for
     them. Falls back to the Ketabi mark only when no name is given. */
  const sealLetter = (() => {
    const m = props.recipientName.trim().match(/\p{L}/u);
    return m ? m[0].toUpperCase() : "K";
  })();

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
  }, []);

  const front = (
    <CardFront card={card} accent={props.accent} photoUrl={props.photoUrl} />
  );
  const inside = (
    <CardInside
      card={card}
      accent={props.accent}
      message={props.message}
      sender={props.sender}
      recipientName={props.recipientName}
      revealed={stage === "open"}
    />
  );

  const footer = (
    <p className={styles.madeBy}>
      Sent with love ·{" "}
      <Link href="/digital-cards" className={styles.madeByLink}>
        Make your own card
      </Link>
    </p>
  );

  /* Calm fallback: no envelope, no 3D — just the card front above its inside. */
  if (reduced) {
    return (
      <div className={`${styles.stage} ${styles.stageStatic}`}>
        <div className={styles.staticCard}>{front}</div>
        <div className={styles.staticCard}>{inside}</div>
        {footer}
      </div>
    );
  }

  function advance() {
    /* A soft haptic tick at the moment of action (silently no-ops on iOS). */
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        /* ignore */
      }
    }
    setStage((s) => (s === "sealed" ? "front" : s === "front" ? "open" : "open"));
  }

  const hint =
    stage === "sealed"
      ? "Tap to open"
      : stage === "front"
      ? "Tap the card to open it"
      : "";

  return (
    <div className={`${styles.stage} ${styles[stage]}`}>
      <Sparkles />

      <div className={styles.scene}>
        {/* Envelope */}
        <div className={styles.envelope} aria-hidden={stage !== "sealed"}>
          <div className={styles.envBody} />
          {/* patterned liner, revealed as the flap lifts */}
          <div className={styles.envLiner} aria-hidden="true" />
          {props.recipientName.trim() && (
            <p className={styles.envName}>For {props.recipientName.trim()}</p>
          )}
          <div className={styles.envFlap} />
          <button
            type="button"
            className={styles.seal}
            onClick={advance}
            aria-label="Open your card"
            disabled={stage !== "sealed"}
          >
            <WaxSeal letter={sealLetter} />
          </button>
        </div>

        {/* Card */}
        <button
          type="button"
          className={styles.card}
          onClick={advance}
          aria-label={stage === "front" ? "Open the card" : "Your card"}
          disabled={stage === "sealed"}
        >
          <div className={styles.fold}>
            <div className={styles.panelInside}>{inside}</div>
            <div className={styles.panelCover}>
              <div className={styles.coverFace}>{front}</div>
              <div className={styles.coverBack} aria-hidden="true" />
            </div>
          </div>
        </button>
      </div>

      {hint && <p className={styles.hint}>{hint}</p>}
      {stage === "open" && footer}
    </div>
  );
}

/* A real wax seal, drawn as clean vector: a smooth, gently organic wax wafer
   (not a perfect circle, but crisp — no turbulence jaggies), matte forest-green
   wax, a fine scalloped impression rim, a debossed gold monogram, and a soft
   contact shadow. No gloss, no bright ring, no glow. */
function WaxSeal({ letter }: { letter: string }) {
  const serif = "var(--font-playfair), Georgia, serif";
  /* a smooth, slightly-irregular wax silhouette (subtle lobes, all curves) */
  const blob =
    "M60 19 C73 18.5 84 25 90.5 36 C96 45 96.5 58 92 70 C87.5 82 76 91 63 92.5 " +
    "C50 94 37 89 30 78 C23.5 68 22.5 54 27 42 C31.5 30 43 20 60 19 Z";
  return (
    <svg viewBox="0 0 120 120" className={styles.waxSvg} aria-hidden="true">
      <defs>
        <filter id="waxDrop" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="2.5"
            stdDeviation="3.4"
            floodColor="#0b0f0c"
            floodOpacity="0.45"
          />
        </filter>
        <radialGradient id="waxFill" cx="42%" cy="36%" r="80%">
          <stop offset="0%" stopColor="#3c5d46" />
          <stop offset="52%" stopColor="#2a4233" />
          <stop offset="100%" stopColor="#1a2b22" />
        </radialGradient>
        <linearGradient id="waxGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b78a3c" />
          <stop offset="45%" stopColor="#f1d897" />
          <stop offset="62%" stopColor="#cba24c" />
          <stop offset="100%" stopColor="#9c7a32" />
        </linearGradient>
      </defs>

      {/* wax body with a soft contact shadow */}
      <g filter="url(#waxDrop)">
        <path d={blob} fill="url(#waxFill)" />
        {/* a fine pressed impression rim, tone-on-tone (not a bright ring) */}
        <circle
          cx="60"
          cy="60"
          r="31"
          fill="none"
          stroke="rgba(0,0,0,0.16)"
          strokeWidth="1.1"
        />
        <circle
          cx="60"
          cy="60"
          r="31"
          fill="none"
          stroke="rgba(247,236,203,0.10)"
          strokeWidth="1.1"
          transform="translate(0,0.8)"
        />
      </g>

      {/* debossed monogram: dark recess above, light catch below, gold on top */}
      <g
        style={{ fontFamily: serif }}
        fontSize="40"
        fontWeight={600}
        textAnchor="middle"
      >
        <text x="60" y="74" fill="#15231b" opacity="0.5">
          {letter}
        </text>
        <text x="60" y="75.3" fill="#f7eccb" opacity="0.26">
          {letter}
        </text>
        <text x="60" y="74" fill="url(#waxGold)">
          {letter}
        </text>
      </g>
    </svg>
  );
}

/* A few drifting gold flecks for ambience. Purely decorative. */
function Sparkles() {
  const dots = [
    { left: "12%", top: "22%", d: "0s", s: 1 },
    { left: "82%", top: "18%", d: "1.4s", s: 0.7 },
    { left: "26%", top: "74%", d: "0.8s", s: 0.9 },
    { left: "70%", top: "68%", d: "2.1s", s: 1.1 },
    { left: "48%", top: "12%", d: "1.1s", s: 0.6 },
    { left: "90%", top: "48%", d: "0.4s", s: 0.8 },
  ];
  return (
    <div className={styles.sparkles} aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className={styles.sparkle}
          style={{
            left: d.left,
            top: d.top,
            animationDelay: d.d,
            transform: `scale(${d.s})`,
          }}
        />
      ))}
    </div>
  );
}
