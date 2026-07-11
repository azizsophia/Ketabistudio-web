import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import KeepsakePicker from "@/components/KeepsakePicker";
import styles from "../../books/books.module.css";

export const metadata: Metadata = {
  title: "Keepsakes",
  description:
    "Hardcover photo keepsakes you fill with your own photos. Every caption comes lovingly written and yours to personalize, sealed with a dua, for Mama, Baba, grandparents, your spouse, a new baby, and Ramadan.",
};

export default function KeepsakesPage() {
  return (
    <div className={styles.library}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={`wrap ${styles.heroInner}`}>
          <p className="eyebrow">Keepsakes</p>
          <h1 className={styles.h1}>
            Your photos, heartfelt words
            <span className={styles.gold}>.</span>
          </h1>
          <p className={`lede ${styles.lede}`}>
            Hardcover photo books you fill with your own photos. Every page comes
            with a heartfelt line lovingly written for you, yours to keep or make
            your own, and the whole book is sealed with a dua.
          </p>
          <span className={`divider ${styles.heroDivider}`} aria-hidden="true">
            <span />
          </span>
        </div>
      </header>

      <div style={{ padding: "8px 0 40px" }}>
        <KeepsakePicker />
      </div>

      {/* Cross-sell: the I-Am book is also a photo keepsake (lives in Storybooks
          as its primary home; surfaced here for discovery, not duplicated). */}
      <section className={`wrap ${styles.crossWrap}`} aria-label="Also for your child">
        <Link href="/books/i-am" className={styles.cross}>
          <span className={styles.crossImg}>
            <Image
              src="/images/iam/cover.jpg"
              alt="I Am, a personalized photo keepsake for your child"
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
