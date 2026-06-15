"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Header.module.css";

const APP_LINKS = [
  { label: "Explore the app", href: "/app" },
  { label: "App Store", href: "https://apps.apple.com/us/app/ketabi/id6768112231", ext: true },
  { label: "Google Play", href: "https://play.google.com/store/apps/details?id=com.ketabi.myapp", ext: true },
  { label: "Request a feature", href: "mailto:ketabistudio@gmail.com?subject=Feature request — Ketabi app", ext: true },
  { label: "Get support", href: "mailto:ketabistudio@gmail.com?subject=Ketabi app support", ext: true },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" className={styles.brand} onClick={() => setOpen(false)}>
          <Image src="/icon.png" alt="" width={38} height={38} className={styles.kaf} />
          <span className={styles.name}>Ketabi Studio</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          <Link href="/#watch">Watch</Link>
          <Link href="/books">Books</Link>
          <Link href="/kids">Kids Corner</Link>
          <Link href="/cards" className={styles.soonLink}>
            Cards <span className={styles.soon}>soon</span>
          </Link>
          <div
            className={styles.dropWrap}
            onMouseEnter={() => setAppOpen(true)}
            onMouseLeave={() => setAppOpen(false)}
          >
            <button
              className={styles.dropBtn}
              aria-expanded={appOpen}
              onClick={() => setAppOpen((v) => !v)}
            >
              App <span className={styles.chev} aria-hidden="true">▾</span>
            </button>
            {appOpen && (
              <div className={styles.dropdown}>
                {APP_LINKS.map((l) =>
                  l.ext ? (
                    <a key={l.label} href={l.href} target={l.href.startsWith("mailto") ? undefined : "_blank"} rel="noopener noreferrer">
                      {l.label}
                    </a>
                  ) : (
                    <Link key={l.label} href={l.href} onClick={() => setAppOpen(false)}>
                      {l.label}
                    </Link>
                  )
                )}
              </div>
            )}
          </div>
          <Link href="/about">About</Link>
        </nav>

        <Link href="/books" className={`btn btn-primary ${styles.cta}`}>
          Shop books
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

      {open && (
        <nav className={styles.sheet} aria-label="Mobile">
          <Link href="/#watch" onClick={() => setOpen(false)}>Watch</Link>
          <Link href="/books" onClick={() => setOpen(false)}>Books</Link>
          <Link href="/kids" onClick={() => setOpen(false)}>Kids Corner</Link>
          <Link href="/cards" onClick={() => setOpen(false)} className={styles.soonLink}>
            Cards <span className={styles.soon}>soon</span>
          </Link>
          <Link href="/app" onClick={() => setOpen(false)}>App</Link>
          <Link href="/about" onClick={() => setOpen(false)}>About</Link>
          <Link href="/books" className="btn btn-primary" onClick={() => setOpen(false)}>
            Shop books
          </Link>
        </nav>
      )}
    </header>
  );
}
