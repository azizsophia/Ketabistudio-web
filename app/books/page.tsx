import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BOOKS } from "@/lib/books";
import styles from "./books.module.css";

export const metadata: Metadata = {
  title: "The Library",
  description:
    "Hand-illustrated Islamic storybooks for children — personalized keepsakes, folktales, and stories of values.",
};

export default function BooksPage() {
  return (
    <div className={styles.library}>
      <header className={`wrap ${styles.head}`}>
        <p className="eyebrow">The Ketabi Library</p>
        <h1>Shelves made for little hands</h1>
        <p className="lede">
          Hand-illustrated, human-written, printed to order. Scroll — the
          shelf is opening.
        </p>
      </header>

      <div className={`wrap ${styles.shelves}`}>
        {BOOKS.map((b, i) => (
          <Link
            key={b.slug}
            href={`/books/${b.slug}`}
            className={styles.shelfRow}
            style={{ zIndex: BOOKS.length - i }}
          >
            <span className={styles.scene}>
              <span className={styles.book3d}>
                <span
                  className={styles.spine}
                  style={{ background: b.spine }}
                />
                <Image
                  src={b.cover}
                  alt={`${b.title} cover`}
                  width={700}
                  height={700}
                  className={styles.face}
                  priority={i === 0}
                />
              </span>
              <span className={styles.plank} aria-hidden="true" />
            </span>

            <span className={styles.meta}>
              <span className={styles.tag}>{b.tag}</span>
              <span className={styles.title}>{b.title}</span>
              <span className={styles.value}>{b.value}</span>
              <span className={styles.blurb}>{b.blurb}</span>
              <span className={styles.open}>Open this book →</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
