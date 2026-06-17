import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKS, PRINT_SPEC, getBook } from "@/lib/books";
import OrderSection from "@/components/OrderSection";
import DuasPreviewPlayground from "@/components/DuasPreviewPlayground";
import FlipBook from "@/components/FlipBook";
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
  const fixed = book.personalization.type === "fixed";
  const soon = !!book.comingSoon;

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
            {soon ? (
              <span className={styles.priceTag}>Coming soon, in shaa Allah</span>
            ) : (
              <>
                <a className="btn btn-primary" href="#order">
                  Order now
                </a>
                <span className={styles.priceTag}>$27.99 + shipping</span>
              </>
            )}
          </div>
        </div>
      </div>

      {fixed && (
      <div className={`wrap ${styles.previewBlock}`}>
        <p className="eyebrow">A peek inside</p>
        <FlipBook cover={book.cover} title={book.title} pages={book.previews} />
      </div>
      )}

      {!personalized && !fixed && (
      <div className={`wrap ${styles.previewBlock}`}>
        <p className="eyebrow">A peek inside</p>
        <div className={styles.previews}>
          {book.previews.map((p) => (
            <figure key={p.src} className={styles.previewCard}>
              <Image
                src={p.src}
                alt={p.caption}
                width={900}
                height={900}
                className={styles.previewImg}
              />
              <figcaption className={styles.previewCap}>{p.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      )}

      {soon ? (
        <>
          <div className={`wrap ${styles.previewBlock}`}>
            <div className={styles.soonPanel}>
              <p className="eyebrow">Coming soon</p>
              <h2 className={styles.soonTitle}>
                This one&apos;s on its way, in shaa Allah
              </h2>
              <p className={styles.soonText}>
                {book.title} isn&apos;t quite ready to order yet — we&apos;re
                putting the finishing touches on it. Join the list and we&apos;ll
                let you know the moment it opens.
              </p>
              <Link href="/coming-soon" className="btn btn-primary">
                Notify me
              </Link>
            </div>
          </div>
          <div className={`wrap ${styles.previewBlock}`}>
            <p className="eyebrow">Get a glimpse</p>
            <DuasPreviewPlayground />
          </div>
        </>
      ) : (
        <div id="order">
          <OrderSection slug={book.slug} personalized={personalized} />
        </div>
      )}

      <div className={`wrap ${styles.backRow}`}>
        <Link href="/books" className="btn btn-outline">
          ← Back to the library
        </Link>
      </div>
    </div>
  );
}
