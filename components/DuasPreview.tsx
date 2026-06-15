"use client";

/**
 * Live flip-through preview for the personalized "My Beautiful Duas" book.
 * Matches the Hijab book's BookPreview UX (cover + interior pages, ‹ › arrows,
 * dots, a hint line, a turning animation).
 *
 * Pages:
 *   0. COVER       — nameless cover art + the typed name overlaid in gold.
 *   1. TEXT        — "When I wake up": occasion, name-woven narrative, the dua
 *                    in Arabic (RTL), transliteration, and meaning.
 *   2. ILLUSTRATION— scene art for the chosen look, with a small caption.
 *   3. TEXT        — "When I go to sleep": same treatment as page 1.
 *
 * Nameless covers live at /images/duas/cover-{character}-{look}.jpg.
 * Scene art lives at /images/duas/scene-{character}-{look}.jpg; if it has not
 * been generated yet it falls back to the bust portrait that always exists at
 * /images/duas/{character}-{look}.jpg.
 */
import { useState } from "react";
import { WAKE_SPREAD, SLEEP_SPREAD, substitute, type DuasSpread } from "@/lib/duasPreview";
import styles from "./DuasPreview.module.css";

type Props = { name: string; character: string; look: string };

const LAST = 3;

export default function DuasPreview({ name, character, look }: Props) {
  const [page, setPage] = useState(0);
  const [turning, setTurning] = useState(false);

  const display = (name || "Your child").trim() || "Your child";
  const coverSrc = `/images/duas/cover-${character}-${look}.jpg`;
  const sceneSrc = `/images/duas/scene-${character}-${look}.jpg`;
  const sceneFallback = `/images/duas/${character}-${look}.jpg`;

  function go(dir: 1 | -1) {
    const next = page + dir;
    if (next < 0 || next > LAST) return;
    setTurning(true);
    setTimeout(() => {
      setPage(next);
      setTurning(false);
    }, 180);
  }

  function TextPage({ spread }: { spread: DuasSpread }) {
    return (
      <div className={styles.textPage}>
        <div className={styles.frame}>
          <p className={styles.occasion}>{spread.occasion}</p>
          <p className={styles.narrative}>
            {substitute(spread.narrative, name, character)}
          </p>
          <p className={styles.arabic} dir="rtl" lang="ar">
            {spread.arabic}
          </p>
          <p className={styles.translit}>{spread.translit}</p>
          <p className={styles.meaning}>{spread.meaning}</p>
        </div>
      </div>
    );
  }

  const hint =
    page === 0
      ? "Turn the page to see their name woven into the duas"
      : page === 1
      ? "Their name, woven into every morning dua"
      : page === 2
      ? "Illustrated exactly as you choose their look"
      : "A peaceful dua to end every day";

  return (
    <div className={styles.previewShell}>
      <div className={`${styles.page} ${turning ? styles.turning : ""}`}>
        {page === 0 && (
          <div className={styles.spread}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverSrc}
              alt=""
              className={styles.art}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
            <div className={styles.coverName}>{display}&rsquo;s</div>
          </div>
        )}

        {page === 1 && (
          <div className={styles.spread}>
            <TextPage spread={WAKE_SPREAD} />
          </div>
        )}

        {page === 2 && (
          <div className={styles.spread}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sceneSrc}
              alt="Illustration from the book"
              className={styles.art}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                if (el.src.indexOf(sceneFallback) === -1) el.src = sceneFallback;
              }}
            />
            <div className={styles.caption}>
              {display}, exactly as you choose their look
            </div>
          </div>
        )}

        {page === 3 && (
          <div className={styles.spread}>
            <TextPage spread={SLEEP_SPREAD} />
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
          {[0, 1, 2, 3].map((i) => (
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
          disabled={page === LAST}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
