import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PHOTOBOOK_ORDER, PHOTOBOOK_TEMPLATES } from "@/lib/photobook";
import styles from "../../books/books.module.css";

export const metadata: Metadata = {
  title: "Keepsakes",
  description:
    "Hardcover photo keepsakes you fill with your own photos and words — for Mama, Baba, grandparents, your spouse, a new baby, and Ramadan. Sealed with a dua.",
};

export default function KeepsakesPage() {
  return (
    <div className={styles.library}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={`wrap ${styles.heroInner}`}>
          <p className="eyebrow">Keepsakes</p>
          <h1 className={styles.h1}>
            Your photos, your words
            <span className={styles.gold}>.</span>
          </h1>
          <p className={`lede ${styles.lede}`}>
            Hardcover photo books you fill yourself — every page a photo and a
            line, sealed with a dua. For the people you love most.
          </p>
          <span className={`divider ${styles.heroDivider}`} aria-hidden="true">
            <span />
          </span>
        </div>
      </header>

      <section className={`wrap ${styles.grid}`} aria-label="Photo keepsakes">
        {PHOTOBOOK_ORDER.map((slug) => {
          const t = PHOTOBOOK_TEMPLATES[slug];
          return (
            <Link
              key={slug}
              href={`/keepsakes/${slug}`}
              className={`card ${styles.bookCard}`}
            >
              <span className={styles.cover}>
                <span
                  className={styles.coverGlow}
                  style={{ background: t.accent.main }}
                  aria-hidden="true"
                />
                <Image
                  src={`/images/keepsake/${slug}/cover.jpg`}
                  alt={`${t.title} keepsake`}
                  width={700}
                  height={700}
                  sizes="(max-width: 720px) 90vw, 340px"
                  className={styles.coverImg}
                />
                <span className={styles.personalizeBadge}>
                  <span className={styles.badgeDiamond} aria-hidden="true" />
                  Your photos
                </span>
              </span>
              <span className={styles.body}>
                <span className={`${styles.tag} ${styles.tagPersonalized}`}>
                  Keepsake
                </span>
                <span className={styles.title}>{t.title}</span>
                <span className={styles.value}>{t.value}</span>
                <span className={styles.blurb}>{t.blurb}</span>
                <span className={styles.cta}>
                  Make this keepsake
                  <span aria-hidden="true"> &rarr;</span>
                </span>
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
