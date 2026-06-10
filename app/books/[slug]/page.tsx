import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKS, PRINT_SPEC, getBook } from "@/lib/books";
import Personalizer from "@/components/Personalizer";
import styles from "./book.module.css";

export function generateStaticParams() {
  return BOOKS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const book = getBook((await params).slug);
  if (!book) return {};
  return { title: book.title, description: book.blurb };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const book = getBook((await params).slug);
  if (!book) notFound();

  const personalized = book.personalization.type === "personalized";

  return (
    <div className={styles.page}>
      <div className={`wrap ${styles.top}`}>
        <div className={styles.coverCol}>
          <div className={styles.coverScene}>
            <div className={styles.cover3d}>
              <span
                className={styles.spine}
                style={{ background: book.spine }}
              />
              <Image
                src={book.cover}
                alt={`${book.title} cover`}
                width={700}
                height={700}
                priority
                className={styles.coverFace}
              />
            </div>
          </div>
        </div>

        <div className={styles.info}>
          <p className="eyebrow">{book.tag} storybook</p>
          <h1 className={styles.h1}>{book.title}</h1>
          <p className={styles.value}>{book.value}</p>
          <p className={styles.desc}>{book.description}</p>

          <ul className={styles.specs}>
            <li>{PRINT_SPEC.pages} pages · {PRINT_SPEC.trim}</li>
            <li>{PRINT_SPEC.paper} · {PRINT_SPEC.cover}</li>
            <li>{PRINT_SPEC.shipsFrom}</li>
            <li>
              {personalized
                ? `Personalized on: ${book.personalization.appearsOn.join(", ")}`
                : `Make it a gift: ${book.personalization.appearsOn.join(", ")}`}
            </li>
          </ul>

          <div className={styles.ctaRow}>
            <a
              className="btn btn-primary"
              href={`mailto:ketabistudio@gmail.com?subject=Notify me — ${book.title}`}
            >
              Ordering opens soon — notify me
            </a>
          </div>
        </div>
      </div>

      {personalized && (
        <div className="wrap">
          <Personalizer />
        </div>
      )}

      <div className={`wrap ${styles.previewBlock}`}>
        <p className="eyebrow">A peek inside</p>
        <div className={styles.previews}>
          {book.previews.map((p) => (
            <figure key={p.src} className={styles.previewCard}>
              <Image
                src={p.src}
                alt={p.caption}
                width={350}
                height={350}
                className={styles.previewImg}
              />
              <figcaption className={styles.previewCap}>{p.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className={`wrap ${styles.backRow}`}>
        <Link href="/books" className="btn btn-outline">
          ← Back to the library
        </Link>
      </div>
    </div>
  );
}
