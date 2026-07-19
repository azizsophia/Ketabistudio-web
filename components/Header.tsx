"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Header.module.css";

/* Unified commerce header for the "Made to be kept" launch. One clean nav
   across the four product worlds, a real full-screen mobile menu, and a
   single Shop call-to-action (no cart badge — each product checks out
   directly, so a bag count would be dishonest). */

/* Nav order = marketing priority (owner, 2026-07-19): keepsakes lead,
   then books, journal second-to-last of the products, cards last. */
const NAV: { label: string; href: string; ext?: boolean }[] = [
  { label: "Keepsakes", href: "/shop/keepsakes" },
  { label: "Books", href: "/shop/storybooks" },
  { label: "Journal", href: "/journal" },
  { label: "Cards", href: "/digital-cards" },
  { label: "About", href: "/about" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={styles.barWrap}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} onClick={() => setOpen(false)}>
          <Image src="/icon.png" alt="" width={34} height={34} className={styles.kaf} />
          <span className={styles.name}>Ketabi&nbsp;Studio</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {NAV.map((l) =>
            l.ext ? (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ) : (
              <Link key={l.label} href={l.href}>
                {l.label}
              </Link>
            )
          )}
        </nav>

        <Link href="/shop" className={styles.shopBtn}>
          Shop
        </Link>

        <button
          className={styles.burger}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`${styles.bar} ${open ? styles.barTop : ""}`} />
          <span className={`${styles.bar} ${open ? styles.barMid : ""}`} />
          <span className={`${styles.bar} ${open ? styles.barBot : ""}`} />
        </button>
      </div>
      </div>

      {open && (
        <div className={styles.sheet}>
          <nav aria-label="Mobile">
            <Link href="/shop" onClick={() => setOpen(false)}>
              Shop everything
            </Link>
            {NAV.map((l) =>
              l.ext ? (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              )
            )}
          </nav>
          <p className={styles.sheetNote}>
            Made to be kept · we ship worldwide
          </p>
        </div>
      )}
    </header>
  );
}
