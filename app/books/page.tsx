import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BOOKS } from "@/lib/books";
import styles from "./books.module.css";

export const metadata: Metadata = {
  title: "The Library",
  description:
    "Hand-illustrated Islamic storybooks for children, personalized keepsakes, folktales, and stories of values. Printed to order with care.",
};

export default function BooksPage() {
  return (
    <div className={styles.library}>
      {/* ── hero ── */}
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={`wrap ${styles.heroInner}`}>
          <p className="eyebrow">The Ketabi Library</p>
          <h1 className={styles.h1}>
            Beautiful books for
            <br />
            little hearts<span className={styles.gold}>.</span>
          </h1>
          <p className={`lede ${styles.lede}`}>
            Hand-illustrated, human-written, and printed to order. Some you can
            personalize so your child becomes the star of their very own story.
          </p>
          <span className={`divider ${styles.heroDivider}`} aria-hidden="true">
            <span />
          </span>
        </div>
      </header>

      {/* ── the shelf ── */}
      <section className={`wrap ${styles.grid}`} aria-label="All books">
        {[...BOOKS]
          .sort((a, b) => Number(!!a.comingSoon) - Number(!!b.comingSoon))
          .map((b, i) => {
          const personalized = b.tag === "Personalized";
          const soon = !!b.comingSoon;
          return (
            <Link
              key={b.slug}
              href={`/books/${b.slug}`}
              className={`card ${styles.bookCard}`}
            >
              <span className={styles.cover}>
                <span
                  className={styles.coverGlow}
                  style={{ background: b.spine }}
                  aria-hidden="true"
                />
                <Image
                  src={b.cover}
                  alt={`${b.title} cover`}
                  width={700}
                  height={700}
                  sizes="(max-width: 720px) 90vw, 340px"
                  className={styles.coverImg}
                  priority={i === 0}
                />
                {soon ? (
                  <span className={styles.soonBadge}>Coming soon</span>
                ) : (
                  personalized && (
                    <span className={styles.personalizeBadge}>
                      <span className={styles.badgeDiamond} aria-hidden="true" />
                      Personalize
                    </span>
                  )
                )}
              </span>

              <span className={styles.body}>
                <span
                  className={`${styles.tag} ${
                    personalized ? styles.tagPersonalized : ""
                  }`}
                >
                  {b.tag}
                </span>
                <span className={styles.title}>{b.title}</span>
                <span className={styles.value}>{b.value}</span>
                <span className={styles.blurb}>{b.blurb}</span>
                <span className={styles.cta}>
                  {soon
                    ? "Coming soon"
                    : personalized
                    ? "Personalize this book"
                    : "See the book"}
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
