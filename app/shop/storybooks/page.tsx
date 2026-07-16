import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { VISIBLE_BOOKS as BOOKS } from "@/lib/books";
import styles from "../../books/books.module.css";

export const metadata: Metadata = {
  title: "Storybooks",
  description:
    "Hand-illustrated Islamic storybooks for children: folktales, stories of values, and personalized books your child can star in. Printed to order.",
};

export default function StorybooksPage() {
  return (
    <div className={styles.library}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={`wrap ${styles.heroInner}`}>
          <p className="eyebrow">Storybooks</p>
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

      <section className={`wrap ${styles.grid}`} aria-label="All storybooks">
        {/* Flagship personalized title — a REAL rendered sample cover (child's
            photo + name in the true print layout) instead of the empty CSS
            mock, so the card sells at a glance (audit 2026-07-16). */}
        <Link href="/books/i-am" className={`card ${styles.bookCard}`}>
          <span className={styles.cover}>
            <span
              className={styles.coverGlow}
              style={{ background: "#2f5d57" }}
              aria-hidden="true"
            />
            <Image
              src="/images/iam/cover-sample.jpg"
              alt="I Am book sample cover, your child's photo and name"
              width={700}
              height={700}
              sizes="(max-width: 720px) 90vw, 340px"
              className={styles.coverImg}
            />
            <span className={styles.personalizeBadge}>
              <span className={styles.badgeDiamond} aria-hidden="true" />
              Personalize
            </span>
          </span>
          <span className={styles.body}>
            <span className={styles.title}>I Am [Your Child]</span>
            <span className={styles.value}>
              Twelve beautiful traits, in English and Arabic
            </span>
            <span className={styles.blurb}>
              A keepsake where your child is the hero of every page, with their
              name, your dedication, and your own photos.
            </span>
            <span className={styles.cta}>
              Personalize this book
              <span aria-hidden="true"> &rarr;</span>
            </span>
          </span>
        </Link>

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
                  {/* personalized books already carry the on-cover Personalize
                      badge — repeating it as a body tag read as a duplicate
                      (audit 2026-07-16), so the tag shows only for the rest */}
                  {!personalized && (
                    <span className={styles.tag}>{b.tag}</span>
                  )}
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
