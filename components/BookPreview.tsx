"use client";

import { useState } from "react";
import styles from "./BookPreview.module.css";

/*
  Wonderbly-style live book preview.
  Page 0: front cover (per-look art) with the title rendered live
  Page 1: story page 12 (mirror scene) with name in the text
  Page 2: story page 23 (tree scene) with name in the text

  Text positions mirror the print pipeline exactly:
  - Cover title: name y=2.7%, subtitle y=12.2%, byline y=17.7% (of 2550)
  - p12 bbox [1324,155,2436,491] -> centered text block
  - p23 bbox [677,151,1874,386] -> centered text block
  Fonts match print: Bjola (title), Crocodile Feet (story).
*/

type Props = {
  name: string; // empty string allowed; we show "Child's Name" then
  skin: string;
  hair: string;
  hairStyle: string;
};

export default function BookPreview({ name, skin, hair, hairStyle }: Props) {
  const [page, setPage] = useState(0);
  const [turning, setTurning] = useState(false);

  const shown = name.trim() || "Child's Name";
  const isPlaceholder = !name.trim();

  function go(dir: 1 | -1) {
    const next = page + dir;
    if (next < 0 || next > 2) return;
    setTurning(true);
    setTimeout(() => {
      setPage(next);
      setTurning(false);
    }, 180);
  }

  const p12Text = [
    `${shown} looked in the mirror`,
    `and couldn't stop smiling.`,
    `There she was, the same ${shown},`,
    `but something felt different.`,
    `She felt tall. She felt proud.`,
  ];

  const p23Text = [
    `${shown} sat under the old tree`,
    `and watched the sky turn pink and gold.`,
    `"Thank you, Allah," she whispered,`,
    `"for my family, my friends,`,
    `and my beautiful hijab."`,
  ];

  return (
    <div className={styles.previewShell}>
      <div className={`${styles.page} ${turning ? styles.turning : ""}`}>
        {page === 0 && (
          <div className={styles.spread}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/images/hero-${skin}-${hair}-${hairStyle}.jpg`}
              alt="Book cover preview"
              className={styles.art}
            />
            <div className={styles.coverTitle}>
              <span
                className={`${styles.coverName} ${isPlaceholder ? styles.placeholder : ""}`}
                style={{
                  fontSize:
                    shown.length > 11
                      ? "clamp(1.05rem, 5.2vw, 1.9rem)"
                      : "clamp(1.5rem, 7.6vw, 2.8rem)",
                }}
              >
                {shown}
              </span>
              <span className={styles.coverSub}>and Her Beautiful Hijab</span>
              <span className={styles.coverByline}>by Ketabi Studio</span>
            </div>
          </div>
        )}

        {page === 1 && (
          <div className={styles.spread}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/images/preview-p12-${skin}.jpg`}
              alt="Story page preview"
              className={styles.art}
            />
            <div className={styles.textP12}>
              {p12Text.map((line, i) => (
                <span key={i} className={isPlaceholder && line.includes(shown) ? styles.lineWithPlaceholder : ""}>
                  {line}
                </span>
              ))}
            </div>
          </div>
        )}

        {page === 2 && (
          <div className={styles.spread}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/images/preview-p23-${skin}.jpg`}
              alt="Story page preview"
              className={styles.art}
            />
            <div className={styles.textP23}>
              {p23Text.map((line, i) => (
                <span key={i} className={isPlaceholder && line.includes(shown) ? styles.lineWithPlaceholder : ""}>
                  {line}
                </span>
              ))}
            </div>
          </div>
        )}
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
          {[0, 1, 2].map((i) => (
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
          disabled={page === 2}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
      <p className={styles.hint}>
        {page === 0
          ? "Turn the page to see her name inside the story"
          : page === 1
          ? "Her name, woven into every page"
          : "Printed exactly as you see it"}
      </p>
    </div>
  );
}
