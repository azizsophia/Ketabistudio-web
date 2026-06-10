"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./Personalizer.module.css";

const MAX = 14;

const SKINS = [
  { key: "light", label: "Light skin", swatch: "#f3d5bd" },
  { key: "medium", label: "Medium skin", swatch: "#d9a877" },
  { key: "dark", label: "Deep skin", swatch: "#9c6b44" },
] as const;

const HAIRS = [
  { key: "black", label: "Black hair", swatch: "#2b2326" },
  { key: "brown", label: "Brown hair", swatch: "#6b4630" },
  { key: "blonde", label: "Blonde hair", swatch: "#c79a4e" },
  { key: "red", label: "Red hair", swatch: "#b85c34" },
] as const;

const STYLES = [
  { key: "long-straight", label: "Long & straight" },
  { key: "long-curly", label: "Long & curly" },
  { key: "short-straight", label: "Short & straight" },
  { key: "short-curly", label: "Short & curly" },
] as const;

export default function Personalizer() {
  const [name, setName] = useState("");
  const [skin, setSkin] = useState<(typeof SKINS)[number]["key"]>("medium");
  const [hair, setHair] = useState<(typeof HAIRS)[number]["key"]>("black");
  const [style, setStyle] = useState<(typeof STYLES)[number]["key"]>("long-straight");
  const shown = (name.trim() || "Amira").slice(0, MAX);

  return (
    <div className={styles.box}>
      <div className={styles.controls}>
        <p className={styles.title}>Make her the star</p>
        <p className={styles.sub}>
          Her name, her skin, her hair — watch the cover come to life.
        </p>

        <label className={styles.label} htmlFor="kid-name">
          Her name
        </label>
        <input
          id="kid-name"
          className={styles.input}
          type="text"
          placeholder="Amira"
          maxLength={MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />

        <p className={styles.label} id="skin-label">
          Her skin
        </p>
        <div className={styles.swatches} role="group" aria-labelledby="skin-label">
          {SKINS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`${styles.swatch} ${
                skin === s.key ? styles.swatchActive : ""
              }`}
              style={{ background: s.swatch }}
              aria-label={s.label}
              aria-pressed={skin === s.key}
              onClick={() => setSkin(s.key)}
            />
          ))}
        </div>

        <p className={styles.label} id="hair-label">
          Her hair
        </p>
        <div className={styles.swatches} role="group" aria-labelledby="hair-label">
          {HAIRS.map((h) => (
            <button
              key={h.key}
              type="button"
              className={`${styles.swatch} ${
                hair === h.key ? styles.swatchActive : ""
              }`}
              style={{ background: h.swatch }}
              aria-label={h.label}
              aria-pressed={hair === h.key}
              onClick={() => setHair(h.key)}
            />
          ))}
        </div>

        <p className={styles.label} id="style-label">
          Her hairstyle
        </p>
        <div className={styles.stylePills} role="group" aria-labelledby="style-label">
          {STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`${styles.pill} ${
                style === s.key ? styles.pillActive : ""
              }`}
              aria-pressed={style === s.key}
              onClick={() => setStyle(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.bookWrap} aria-hidden="true">
        <div className={styles.book}>
          <Image
            src={`/images/hero-${skin}-${hair}-${style}.jpg`}
            alt=""
            width={1100}
            height={1100}
            priority
            className={styles.art}
          />
          <div className={styles.overlay}>
            <span
              className={styles.bookName}
              style={{
                fontSize:
                  shown.length > 9
                    ? "clamp(1.3rem, 3.6vw, 2.1rem)"
                    : "clamp(1.7rem, 4.8vw, 2.9rem)",
              }}
            >
              {shown}
            </span>
            <span className={styles.bookSub}>and Her Beautiful Hijab</span>
          </div>
        </div>
      </div>
    </div>
  );
}
