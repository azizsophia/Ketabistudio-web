"use client";

import { useEffect, useRef, useState } from "react";
import type { TransitionEvent } from "react";
import Image from "next/image";
import styles from "./FlipBook.module.css";

/*
  FlipBook — premium auto-playing page-turn showcase.

  Two stacked layers "ping-pong": the page about to be revealed is ALWAYS
  already painted on the lower layer, so a turn never flashes the wrong page.
  The top layer rotates away (perspective + fade) to reveal it; the layers then
  swap roles. The now-hidden layer silently loads the next page behind the new
  top. Honours prefers-reduced-motion and pauses on hover.

  Backwards compatible: <FlipBook cover title pages /> still works; the optional
  stage / eyebrow / caption / autoMs props add the luxe treatment.
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
  autoMs = 4400,
}: Props) {
  const slides = [cover, ...pages.map((p) => p.src)];
  const n = slides.length;

  // a/b are the two layers; `top` is whichever is currently face-up. The lower
  // layer always shows the NEXT page so a flip reveals a pre-painted image.
  const [aIdx, setAIdx] = useState(0);
  const [bIdx, setBIdx] = useState(1 % n);
  const [top, setTop] = useState<"a" | "b">("a");
  const [flipping, setFlipping] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || reduced.current || n < 2) return;
    const t = setInterval(() => setFlipping(true), autoMs);
    return () => clearInterval(t);
  }, [paused, autoMs, n]);

  const current = top === "a" ? aIdx : bIdx;

  function onTopEnd(e: TransitionEvent) {
    // advance once, on the transform's end only (opacity also transitions)
    if (e.propertyName !== "transform" || !flipping) return;
    if (top === "a") {
      setTop("b");
      setFlipping(false);
      setAIdx((bIdx + 1) % n); // hidden layer pre-loads the page after next
    } else {
      setTop("a");
      setFlipping(false);
      setBIdx((aIdx + 1) % n);
    }
  }

  function jump(i: number) {
    const t = ((i % n) + n) % n;
    setFlipping(false);
    if (top === "a") {
      setAIdx(t);
      setBIdx((t + 1) % n);
    } else {
      setBIdx(t);
      setAIdx((t + 1) % n);
    }
  }

  function layer(which: "a" | "b") {
    const isTop = top === which;
    const idx = which === "a" ? aIdx : bIdx;
    return (
      <div
        className={`${styles.layer} ${isTop ? styles.layerTop : styles.layerBottom} ${
          isTop && flipping ? styles.flipping : ""
        }`}
        onTransitionEnd={isTop ? onTopEnd : undefined}
        aria-hidden={!isTop}
      >
        <Image
          src={slides[idx]}
          alt={isTop ? (idx === 0 ? `${title} cover` : `${title} — inside`) : ""}
          width={900}
          height={900}
          className={styles.art}
          priority={idx === 0}
        />
        <span className={styles.leafShade} aria-hidden="true" />
      </div>
    );
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
          {layer("a")}
          {layer("b")}
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
              className={`${styles.dot} ${i === current ? styles.dotActive : ""}`}
              onClick={() => jump(i)}
              aria-label={`Go to page ${i + 1}`}
              aria-selected={i === current}
              role="tab"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
