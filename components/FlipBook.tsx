"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./FlipBook.module.css";

/*
  FlipBook — premium auto-playing page-turn showcase.
  Page 0 = front cover, then the interior preview spreads. The book sits on a
  quiet "stage" (forest for storybooks, charcoal for keepsakes) and turns its
  own pages with a perspective flip + cast shadow, looping. Honours
  prefers-reduced-motion (no auto-play, simple cut) and pauses on hover.

  Backwards compatible: <FlipBook cover title pages /> still works; the new
  optional props (stage, eyebrow, caption, autoMs) add the luxe treatment.
*/

type Page = { src: string; caption?: string };

type Props = {
  cover: string;
  title: string;
  pages: Page[];
  stage?: "forest" | "charcoal";
  eyebrow?: string;
  caption?: string;
  autoMs?: number;
};

export default function FlipBook({
  cover,
  title,
  pages,
  stage = "forest",
  eyebrow,
  caption,
  autoMs = 2600,
}: Props) {
  const slides = [cover, ...pages.map((p) => p.src)];
  const n = slides.length;

  const [idx, setIdx] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Auto-advance: trigger a flip every autoMs unless paused or reduced-motion.
  useEffect(() => {
    if (paused || reduced.current || n < 2) return;
    const t = setInterval(() => setFlipping(true), autoMs);
    return () => clearInterval(t);
  }, [paused, autoMs, n]);

  const next = (idx + 1) % n;

  function onLeafEnd() {
    if (!flipping) return;
    setIdx(next);
    setFlipping(false);
  }

  function jump(to: number) {
    setFlipping(false);
    setIdx(((to % n) + n) % n);
  }

  return (
    <div
      className={styles.showcase}
      data-stage={stage}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={styles.stageInner}>
        <div className={styles.bookArea}>
          <span className={styles.dropShadow} aria-hidden="true" />
          {/* page revealed beneath the turning leaf */}
          <div className={styles.leafBack}>
            <Image
              src={slides[next]}
              alt=""
              width={900}
              height={900}
              className={styles.art}
              aria-hidden="true"
            />
          </div>
          {/* the turning leaf (current page) — remounts per idx so it never
              animates backwards on reset */}
          <div
            key={idx}
            className={`${styles.leaf} ${flipping ? styles.flipping : ""}`}
            onTransitionEnd={onLeafEnd}
          >
            <Image
              src={slides[idx]}
              alt={idx === 0 ? `${title} cover` : `${title} — inside`}
              width={900}
              height={900}
              className={styles.art}
              priority={idx === 0}
            />
            <span className={styles.leafShade} aria-hidden="true" />
          </div>
        </div>

        {(eyebrow || caption) && (
          <div className={styles.caption}>
            <span className={styles.rule} aria-hidden="true" />
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            {caption && <p className={styles.captionLine}>{caption}</p>}
          </div>
        )}

        <div className={styles.dots} role="tablist" aria-label="Pages">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.dot} ${i === idx ? styles.dotActive : ""}`}
              onClick={() => jump(i)}
              aria-label={`Go to page ${i + 1}`}
              aria-selected={i === idx}
              role="tab"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
