"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./KeepsakeSlideshow.module.css";

/* Auto-fading hero slideshow of keepsake covers, so the homepage shows the
   range at a glance (it's for every person, not just Mama). Tap a dot to jump. */

const SLIDES = [
  { src: "/images/home/hero-mama.jpg", alt: "Everything I Love About Mama keepsake" },
  { src: "/images/home/hero-baba.jpg", alt: "Everything I Love About Baba keepsake" },
  { src: "/images/home/hero-grandma.jpg", alt: "Everything I Love About Teta keepsake" },
  { src: "/images/home/hero-grandpa.jpg", alt: "Everything I Love About Jiddo keepsake" },
  { src: "/images/home/hero-baby.jpg", alt: "Welcome Little One baby keepsake" },
];

export default function KeepsakeSlideshow() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={styles.wrap} aria-label="Keepsake examples">
      {SLIDES.map((s, idx) => (
        <Image
          key={s.src}
          src={s.src}
          alt={s.alt}
          width={1100}
          height={1100}
          priority={idx === 0}
          className={styles.slide}
          style={{ opacity: idx === i ? 1 : 0 }}
        />
      ))}
      <div className={styles.dots}>
        {SLIDES.map((s, idx) => (
          <button
            key={s.src}
            type="button"
            aria-label={`Show keepsake ${idx + 1}`}
            className={idx === i ? `${styles.dot} ${styles.dotOn}` : styles.dot}
            onClick={() => setI(idx)}
          />
        ))}
      </div>
    </div>
  );
}
