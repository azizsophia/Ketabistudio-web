import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GIFT_GUIDES, getGiftGuide } from "@/lib/giftGuides";
import styles from "./gifts.module.css";

/* SEO gift-guide landing pages: /gifts/eid-gifts, /gifts/gifts-for-baba, …
   Statically generated, with ItemList + Product structured data so they can
   earn rich results. Content lives in lib/giftGuides.ts. */

export function generateStaticParams() {
  return GIFT_GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = getGiftGuide(slug);
  if (!g) return {};
  return {
    title: g.metaTitle,
    description: g.metaDescription,
    alternates: { canonical: `https://www.ketabistudio.com/gifts/${g.slug}` },
    openGraph: {
      title: g.metaTitle,
      description: g.metaDescription,
      images: [g.products[0]?.image || "/images/book-amira.jpg"],
    },
  };
}

export default async function GiftGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = getGiftGuide(slug);
  if (!g) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: g.h1,
    itemListElement: g.products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        image: `https://www.ketabistudio.com${p.image}`,
        url: `https://www.ketabistudio.com${p.href}`,
        description: p.blurb,
        brand: { "@type": "Brand", name: "Ketabi Studio" },
        offers: {
          "@type": "Offer",
          price: p.priceNumber.toFixed(2),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
    })),
  };

  const others = GIFT_GUIDES.filter((x) => x.slug !== g.slug).slice(0, 5);

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className={styles.hero}>
        <div className={`wrap ${styles.heroInner}`}>
          <p className="eyebrow">{g.eyebrow}</p>
          <h1 className={styles.h1}>{g.h1}</h1>
          <div className={styles.intro}>
            {g.intro.map((para) => (
              <p key={para.slice(0, 24)}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.grid} aria-label="Gift picks">
        {g.products.map((p) => (
          <Link key={p.href} href={p.href} className={styles.card}>
            <Image
              src={p.image}
              alt={p.name}
              width={256}
              height={256}
              className={styles.thumb}
            />
            <span className={styles.body}>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.price}> {p.price}</span>
              <p className={styles.blurb}>{p.blurb}</p>
              <span className={styles.cta}>See it →</span>
            </span>
          </Link>
        ))}
      </section>

      <p className={styles.closing}>{g.closing}</p>

      <nav className={styles.moreGuides} aria-label="More gift guides">
        {others.map((o) => (
          <Link key={o.slug} href={`/gifts/${o.slug}`}>
            {o.h1}
          </Link>
        ))}
      </nav>
    </div>
  );
}
