"use client";

import { useEffect, useState } from "react";
import styles from "./Splash.module.css";

export default function Splash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("ketabi-splash");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!seen && !reduced) {
      setShow(true);
      sessionStorage.setItem("ketabi-splash", "1");
      const t = setTimeout(() => setShow(false), 2100);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;

  return (
    <div className={styles.splash} aria-hidden="true">
      <p className={`arabic ${styles.bismillah}`}>
        بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
      </p>
    </div>
  );
}
