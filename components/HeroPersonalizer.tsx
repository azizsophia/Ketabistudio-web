"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./HeroPersonalizer.module.css";

const MAX = 14;

const LOOKS = [
  { key: "light", label: "Light", swatch: "#f3d5bd" },
  { key: "medium", label: "Medium", swatch: "#d9a877" },
  { key: "dark", label: "Deep", swatch: "#9c6b44" },
] as const;

export default function HeroPersonalizer() {
  const [name, setName] = useState("");
  const [look, setLook] = useState<(typeof LOOKS)[number]["key"]>("medium");
  const shown = (name.trim() || "Amira").slice(0, MAX);

  return (
    <section className={styles.hero}>
      <div className={`wrap ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow">Personalized Islamic storybooks</p>
          <h1>
            Stories that help
            <br />
            little hearts grow.
          </h1>
          <p className={`lede ${styles.lede}`}>
            Storybooks illustrated by hand, where your child is the star —
            printed, bound, and delivered to your door.
          </p>
          <label className={styles.tryLabel} htmlFor="hero-name">
            Try it — type your daughter&apos;s name
          </label>
          <div className={styles.tryRow}>
            <input
              id="hero-name"
              className={styles.input}
              type="text"
              placeholder="Amira"
              maxLength={MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <p className={styles.lookLabel} id="look-label">
            Choose her look
          </p>
          <div
            className={styles.swatches}
            role="group"
            aria-labelledby="look-label"
          >
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

          <div className={styles.ctaRow}>
            <Link href="/#books" className="btn btn-primary">
              Shop books
            </Link>
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
                      ? "clamp(1.4rem, 4.2vw, 2.4rem)"
                      : "clamp(1.9rem, 5.6vw, 3.4rem)",
                }}
              >
                {shown}
              </span>
              <span className={styles.bookSub}>and Her Beautiful Hijab</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
