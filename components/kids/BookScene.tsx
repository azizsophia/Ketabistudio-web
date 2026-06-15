import Image from "next/image";
import Link from "next/link";
import type { Book } from "@/lib/books";
import styles from "@/app/kids/kids.module.css";

type Props = {
  book: Book;
  /** even-indexed scenes flip the art to the right on desktop */
  flip: boolean;
  /** first scene's cover gets priority for LCP */
  priority?: boolean;
};

/** A small sparkle used inline in the personalization magic line. */
function Sparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c.6 6.1 5.9 11.4 12 12-6.1.6-11.4 5.9-12 12-.6-6.1-5.9-11.4-12-12C6.1 11.4 11.4 6.1 12 0Z" />
    </svg>
  );
}

export default function BookScene({ book, flip, priority }: Props) {
  const personalized = book.personalization.type === "personalized";
  const cta = personalized ? "Make it theirs" : "Read together";
  const rot = flip ? "3deg" : "-3deg";

  return (
    <article className={`${styles.scene} ${flip ? styles.flip : ""}`}>
      <div className={styles.sceneArt}>
        <span className={styles.halo} aria-hidden="true" />
        <div className={styles.cover} style={{ ["--rot" as string]: rot }}>
          <Image
            src={book.cover}
            alt={`${book.title} cover`}
            width={840}
            height={840}
            sizes="(max-width: 820px) 86vw, 420px"
            priority={priority}
          />
        </div>
      </div>

      <div className={styles.sceneCopy}>
        <span className={styles.pill}>{book.tag}</span>
        <h2 className={styles.sceneTitle}>{book.title}</h2>
        <p className={styles.sceneValue}>{book.value}</p>
        <p className={styles.sceneBlurb}>{book.blurb}</p>

        {personalized && (
          <p className={styles.magicLine}>
            <Sparkle />
            Add your child&rsquo;s name and look, and they become the star.
          </p>
        )}

        <div className={styles.sceneCta}>
          <Link href={`/books/${book.slug}`} className="btn btn-primary">
            {cta} &rarr;
          </Link>
        </div>
      </div>
    </article>
  );
}
