"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./Personalizer.module.css";

const MAX = 14;

const LOOKS = [
  { key: "light", label: "Light", swatch: "#f3d5bd" },
  { key: "medium", label: "Medium", swatch: "#d9a877" },
  { key: "dark", label: "Deep", swatch: "#9c6b44" },
] as const;

export default function Personalizer() {
  const [name, setName] = useState("");
  const [look, setLook] = useState<(typeof LOOKS)[number]["key"]>("medium");
  const shown = (name.trim() || "Amira").slice(0, MAX);

  return (
    <div className={styles.box}>
      <div className={styles.controls}>
        <p className={styles.title}>Make her the star</p>
        <p className={styles.sub}>
          Type a name, choose her look — and watch the cover come to life.
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

        <p className={styles.label} id="look-label">
          Her look
        </p>
        <div className={styles.swatches} role="group" aria-labelledby="look-label">
          {LOOKS.map((l) => (
            <button
              key={l.key}
              type="button"
              className={`${styles.swatch} ${
                look === l.key ? styles.swatchActive : ""
              }`}
              style={{ background: l.swatch }}
              aria-label={l.label}
              aria-pressed={look === l.key}
              onClick={() => setLook(l.key)}
            />
          ))}
        </div>
      </div>

      <div className={styles.bookWrap} aria-hidden="true">
        <div className={styles.book}>
          {LOOKS.map((l) => (
            <Image
              key={l.key}
              src={`/images/hero-${l.key}.jpg`}
              alt=""
              width={1100}
              height={1100}
              priority={l.key === "medium"}
              className={styles.art}
              style={{ display: look === l.key ? "block" : "none" }}
            />
          ))}
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
