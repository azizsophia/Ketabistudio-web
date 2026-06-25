import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PHOTOBOOK_ORDER, PHOTOBOOK_TEMPLATES } from "@/lib/photobook";
import FlipBook from "@/components/FlipBook";
import styles from "../../books/books.module.css";

export const metadata: Metadata = {
  title: "Keepsakes",
  description:
    "Hardcover photo keepsakes you fill with your own photos and words, for Mama, Baba, grandparents, your spouse, a new baby, and Ramadan. Sealed with a dua.",
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
            Hardcover photo books you fill yourself. Every page a photo and a
            line, sealed with a dua, for the people you love most.
          </p>
          <span className={`divider ${styles.heroDivider}`} aria-hidden="true">
            <span />
          </span>
        </div>
      </header>

      <div className="wrap" style={{ padding: "4px 0 48px" }}>
        <FlipBook
          cover="/images/keepsake/about-mama/cover.jpg"
          title="Everything I Love About Mama"
          pages={[
            { src: "/images/keepsake/about-mama/page04.jpg" },
            { src: "/images/keepsake/about-mama/page12.jpg" },
            { src: "/images/keepsake/about-mama/page23.jpg" },
          ]}
          stage="charcoal"
          eyebrow="A hardcover keepsake"
          caption="Your own photos and words, sealed with a dua"
        />
      </div>

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

      {/* Cross-sell: the I-Am book is also a photo keepsake (lives in Storybooks
          as its primary home; surfaced here for discovery, not duplicated). */}
      <section className={`wrap ${styles.crossWrap}`} aria-label="Also for your child">
        <Link href="/books/i-am" className={styles.cross}>
          <span className={styles.crossImg}>
            <Image
              src="/images/iam/cover.jpg"
              alt="I Am — a personalized photo keepsake for your child"
              width={520}
              height={520}
            />
          </span>
          <span className={styles.crossBody}>
            <span className={styles.crossEyebrow}>Also a keepsake, for your child</span>
            <span className={styles.crossTitle}>
              Make your child the hero of every page.
            </span>
            <span className={styles.crossText}>
              &ldquo;I Am ___&rdquo; is a personalized photo keepsake: twelve
              beautiful traits in English and Arabic, with your child&rsquo;s
              name, your own photos, and your dedication. A first keepsake
              they&rsquo;ll grow up treasuring.
            </span>
            <span className={styles.crossCta}>
              Personalize &ldquo;I Am&rdquo; <span aria-hidden="true">&rarr;</span>
            </span>
          </span>
        </Link>
      </section>
    </div>
  );
}
