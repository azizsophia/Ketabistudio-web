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
          <div className={styles.envFlap} />
          <button
            type="button"
            className={styles.seal}
            onClick={advance}
            aria-label="Open your card"
            disabled={stage !== "sealed"}
          >
            <span className={styles.sealMark}>{sealLetter}</span>
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
