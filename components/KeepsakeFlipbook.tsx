"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./KeepsakeFlipbook.module.css";

/**
 * A lightweight, dependency-free flip-book for previewing a keepsake's pages.
 * - click the right/left half of the page (or the arrows) to turn
 * - arrow keys ← →, and swipe on touch
 * - a soft page-turn fade so it feels like a book, not a slideshow
 */
export default function KeepsakeFlipbook({
  pages,
  startLabel = "Cover",
}: {
  pages: string[];
  startLabel?: string;
}) {
  const [i, setI] = useState(0);
  const [turning, setTurning] = useState<"f" | "b" | null>(null);
  const touchX = useRef<number | null>(null);
  const total = pages.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      setI((cur) => {
        const next = cur + dir;
        if (next < 0 || next >= total) return cur;
        setTurning(dir === 1 ? "f" : "b");
        return next;
      });
    },
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    if (!turning) return;
    const t = setTimeout(() => setTurning(null), 420);
    return () => clearTimeout(t);
  }, [turning, i]);

  const label = i === 0 ? startLabel : `Page ${i} of ${total - 1}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.stage}>
        <button
          type="button"
          aria-label="Previous page"
          className={`${styles.arrow} ${styles.left}`}
          onClick={() => go(-1)}
          disabled={i === 0}
        >
          ‹
        </button>

        <div
          className={styles.book}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (dx < -40) go(1);
            else if (dx > 40) go(-1);
            touchX.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={i}
            src={pages[i]}
            alt={label}
            className={`${styles.page} ${
              turning === "f"
                ? styles.turnF
                : turning === "b"
                ? styles.turnB
                : ""
            }`}
            draggable={false}
          />
          {/* invisible click zones: left = back, right = forward */}
          <button
            type="button"
            aria-label="Previous page"
            className={`${styles.zone} ${styles.zoneL}`}
            onClick={() => go(-1)}
          />
          <button
            type="button"
            aria-label="Next page"
            className={`${styles.zone} ${styles.zoneR}`}
            onClick={() => go(1)}
          />
        </div>

        <button
          type="button"
          aria-label="Next page"
          className={`${styles.arrow} ${styles.right}`}
          onClick={() => go(1)}
          disabled={i === total - 1}
        >
          ›
        </button>
      </div>

      <div className={styles.meta}>
        <span className={styles.counter}>{label}</span>
        <span className={styles.hint}>Tap the page or use ← → to turn</span>
      </div>
    </div>
  );
}
