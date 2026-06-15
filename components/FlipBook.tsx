"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./FlipBook.module.css";

/*
  FlipBook — static page-turn preview for the fixed (non-personalized) books.
  Page 0: front cover. Pages 1..N: interior preview images.
  Each interior image already has the book's real page text baked in, so the
  caption here is just a short hint label under the spread.
*/

type Props = {
  cover: string;
  title: string;
  pages: { src: string; caption: string }[];
};

export default function FlipBook({ cover, title, pages }: Props) {
  const [page, setPage] = useState(0);
  const [turning, setTurning] = useState(false);

  const last = pages.length; // page 0 = cover, then 1..pages.length

  function go(dir: 1 | -1) {
    const next = page + dir;
    if (next < 0 || next > last) return;
    setTurning(true);
    setTimeout(() => {
      setPage(next);
      setTurning(false);
    }, 180);
  }

  const isCover = page === 0;
  const hint = isCover
    ? "Turn the page to peek inside"
    : pages[page - 1].caption;

  return (
    <div className={styles.previewShell}>
      <div className={`${styles.page} ${turning ? styles.turning : ""}`}>
        <div className={styles.spread}>
          {isCover ? (
            <Image
              src={cover}
              alt={`${title} cover`}
              width={900}
              height={900}
              className={styles.art}
            />
          ) : (
            <Image
              src={pages[page - 1].src}
              alt={pages[page - 1].caption}
              width={900}
              height={900}
              className={styles.art}
            />
          )}
        </div>
      </div>

      {/* page turn controls */}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.turnBtn}
          onClick={() => go(-1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          ‹
        </button>
        <div className={styles.dots}>
          {Array.from({ length: last + 1 }).map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${page === i ? styles.dotActive : ""}`}
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.turnBtn}
          onClick={() => go(1)}
          disabled={page === last}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
