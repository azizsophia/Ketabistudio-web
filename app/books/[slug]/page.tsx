import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VISIBLE_BOOKS, PRINT_SPEC, getBook } from "@/lib/books";
import { bookPriceDisplay } from "@/lib/pricing";
import OrderSection from "@/components/OrderSection";
import DuasPreviewPlayground from "@/components/DuasPreviewPlayground";
import FlipBook from "@/components/FlipBook";
import StickyBuyBar from "@/components/StickyBuyBar";
import styles from "./book.module.css";

export function generateStaticParams() {
  return VISIBLE_BOOKS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const book = getBook((await params).slug);
  if (!book || book.hidden) return {};
  return { title: book.title, description: book.blurb };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const book = getBook((await params).slug);
  if (!book || book.hidden) notFound();

  const personalized = book.personalization.type === "personalized";
  const fixed = book.personalization.type === "fixed";
  const soon = !!book.comingSoon;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: book.title,
    description: book.blurb,
    image: `https://www.ketabistudio.com${book.cover}`,
    brand: { "@type": "Brand", name: "Ketabi Studio" },
    category: "Islamic children's books",
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: bookPriceDisplay(book.slug).replace(/[^0-9.]/g, ""),
      availability: soon
        ? "https://schema.org/PreOrder"
        : "https://schema.org/InStock",
      url: `https://www.ketabistudio.com/books/${book.slug}`,
    },
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
            <li>{PRINT_SPEC.leadTime} · we ship worldwide</li>
            <li>{PRINT_SPEC.delivery}</li>
            <li>
              {personalized
                ? `Personalized on: ${book.personalization.appearsOn.join(", ")}`
                : `Make it a gift: ${book.personalization.appearsOn.join(", ")}`}
            </li>
          </ul>

          <div className={styles.ctaRow}>
            {soon ? (
              <span className={styles.priceTag}>Coming soon, Inshallah</span>
            ) : (
              <>
                <a className="btn btn-primary" href="#order">
                  Order now
                </a>
                <span className={styles.priceTag}>
                  {personalized ? "From " : ""}{bookPriceDisplay(book.slug)} · Free US shipping
                </span>
              </>
            )}
          </div>
          {!soon && (
            <p className={styles.deliveryNote}>{PRINT_SPEC.deliveryFriendly}</p>
          )}
        </div>
      </div>

      {!soon && book.previews.length > 0 && (
        <div className={`wrap ${styles.previewBlock}`}>
          <p className="eyebrow">A peek inside</p>
          <FlipBook
            cover={book.cover}
            title={book.title}
            pages={book.previews}
            stage="forest"
            eyebrow={personalized ? "Personalized" : "Real inside pages"}
            caption={
              personalized
                ? "Real pages from the book. Your child’s name and look go on every one."
                : "Real pages from the book you’ll receive, not a mock-up."
            }
          />
        </div>
      )}

      {soon ? (
        <>
          <div className={`wrap ${styles.previewBlock}`}>
            <div className={styles.soonPanel}>
              <p className="eyebrow">Coming soon</p>
              <h2 className={styles.soonTitle}>
                This one&apos;s on its way, Inshallah
              </h2>
              <p className={styles.soonText}>
                {book.title} isn&apos;t quite ready to order yet. We&apos;re
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

      <StickyBuyBar
        label={book.title}
        price={bookPriceDisplay(book.slug)}
        personalized={personalized}
        soon={soon}
      />
    </div>
  );
}
