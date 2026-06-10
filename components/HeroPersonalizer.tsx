"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./HeroPersonalizer.module.css";

const MAX = 14;

export default function HeroPersonalizer() {
  const [name, setName] = useState("");
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
            Beautifully illustrated books where your child is part of the
            story — printed, bound, and delivered to your door.
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
            <Link href="/#books" className="btn btn-primary">
              Shop books
            </Link>
          </div>
        </div>

        <div className={styles.bookWrap} aria-hidden="true">
          <div className={styles.book}>
            <Image
              src="/images/hero-amira-blank.jpg"
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
                      ? "clamp(1.5rem, 4.6vw, 2.6rem)"
                      : "clamp(2rem, 6vw, 3.6rem)",
                }}
              >
                {shown}
              </span>
              <span className={styles.bookSub}>and Her Beautiful Hijab</span>
              <span className={styles.bookBy}>by Ketabi Studio</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
