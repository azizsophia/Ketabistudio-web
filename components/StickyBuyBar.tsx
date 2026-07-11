"use client";

import { useEffect, useState } from "react";
import styles from "./StickyBuyBar.module.css";

/* Mobile sticky buy bar — the highest-converting pattern on a phone product
   page. Price always in view, one tap jumps to the order builder. Appears
   only after the user scrolls past the hero and only on small screens. It
   never checks out on its own; it just focuses the real OrderSection. */

export default function StickyBuyBar({
  price,
  personalized,
  soon,
  label,
}: {
  price: string;
  personalized: boolean;
  soon?: boolean;
  label: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 380);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`${styles.bar} ${show ? styles.show : ""}`} aria-hidden={!show}>
      <div className={styles.info}>
        <span className={styles.name}>{label}</span>
        <span className={styles.price}>
          {soon ? "Coming soon" : `${personalized ? "From " : ""}${price}`}
        </span>
      </div>
      <a
        href={soon ? "/coming-soon" : "#order"}
        className={styles.cta}
      >
        {soon ? "Notify me" : personalized ? "Personalize" : "Order"}
      </a>
    </div>
  );
}
