import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { VISIBLE_BOOKS as BOOKS } from "@/lib/books";
import BookScene from "@/components/kids/BookScene";
import Motifs from "@/components/kids/Motifs";
import styles from "./kids.module.css";

export const metadata: Metadata = {
  title: "Kids Corner",
  description:
    "A warm, magical corner of children's books where your child can be the star of the story. Personalized Islamic keepsakes, folktales, and stories of values.",
};

const CLUSTER_TILT = ["-4deg", "3deg", "-2deg", "4deg"];

export default function KidsPage() {
  return (
    <div className={styles.page}>
      {/* ── HERO ── */}
      <section className={styles.hero}>
        <Motifs />
        <div className={`wrap ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Kids Corner</p>
            <h1 className={styles.heroTitle}>
              Where your child is the <span className={styles.accent}>star</span>{" "}
              of the story.
            </h1>
            <p className={`lede ${styles.heroLede}`}>
              A gentle, beautiful place to wander. Hand-illustrated keepsakes,
              beloved folktales, and stories that help little hearts grow,
              printed to order and made to be read again and again.
            </p>
            <div className={styles.heroCtas}>
              <Link href="#first-book" className="btn btn-primary">
                Explore the books
              </Link>
              <Link href="/books" className={styles.textLink}>
                See the full library &rarr;
              </Link>
            </div>
          </div>

          <div className={styles.cluster} aria-hidden="true">
            {BOOKS.map((b, i) => (
              <div
                key={b.slug}
                className={styles.clusterItem}
                style={{ ["--tilt" as string]: CLUSTER_TILT[i] }}
              >
                <Image
                  src={b.cover}
                  alt=""
                  width={420}
                  height={420}
                  sizes="(max-width: 480px) 45vw, 180px"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCENES (one per book) ── */}
      <div className={`wrap ${styles.scenes}`}>
        {BOOKS.map((b, i) => (
          <div key={b.slug} id={i === 0 ? "first-book" : undefined}>
            <BookScene book={b} flip={i % 2 === 1} priority={false} />
          </div>
        ))}
      </div>

      {/* ── CLOSING BAND ── */}
      <section className={`wrap ${styles.closing}`}>
        <div className={styles.closingCard}>
          <Motifs />
          <div className={`divider ${styles.closingDivider}`}>
            <span />
          </div>
          <h2>Find the one they will ask for tonight.</h2>
          <p className={styles.closingLede}>
            Every book is human-written, hand-illustrated, and printed with care.
            Step into the full library and find the story that feels like theirs.
          </p>
          <div className={styles.closingCta}>
            <Link href="/books" className="btn btn-gold">
              Visit the library
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
