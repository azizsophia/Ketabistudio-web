import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./shop.module.css";

export const metadata: Metadata = {
  title: "Shop — books, keepsakes & cards",
  description:
    "Hand-illustrated Islamic storybooks, personalized photo keepsakes, and beautifully made greeting cards — printed to order with care.",
};

type Tile = {
  href: string;
  tag: string;
  title: string;
  sub: string;
  cta: string;
  img?: string;
  color?: string;
  soon?: boolean;
};

const TILES: Tile[] = [
  {
    href: "/shop/storybooks",
    tag: "For little hearts",
    title: "Storybooks",
    sub: "Hand-illustrated Islamic stories — folktales, values, and books your child can star in.",
    cta: "Browse storybooks →",
    img: "/images/book-amira.jpg",
  },
  {
    href: "/shop/keepsakes",
    tag: "Your photos & words",
    title: "Keepsakes",
    sub: "Hardcover photo books you fill yourself — for Mama, Baba, grandparents, your spouse, a new baby, and Ramadan.",
    cta: "Browse keepsakes →",
    img: "/images/keepsake/about-mama/cover.jpg",
  },
  {
    href: "/cards",
    tag: "Sent for you",
    title: "Greeting Cards",
    sub: "Personalized Islamic cards with a vetted dua — Eid, Nikah, new baby, and for the people you love.",
    cta: "Design a card →",
    img: "/images/cards/eid.jpg",
  },
  {
    href: "/shop/play-mats",
    tag: "For playtime",
    title: "Children's Play Mats",
    sub: "Beautiful, soft play mats for little ones — thoughtfully designed. Arriving soon, Inshallah.",
    cta: "Coming soon",
    color: "#2e4a3a",
    soon: true,
  },
];

export default function ShopPage() {
  return (
    <div className={styles.shop}>
      <header className={styles.hero}>
        <p className="eyebrow">The Ketabi Shop</p>
        <h1 className={styles.h1}>Made with intention.</h1>
        <p className={`lede ${styles.lede}`}>
          Everything we make — to read, to keep, and to give — printed to order
          with care.
        </p>
      </header>

      <section className={styles.tiles} aria-label="Shop categories">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className={styles.tile}>
            <span className={styles.tileImg}>
              {t.img ? (
                <Image
                  src={t.img}
                  alt={t.title}
                  fill
                  sizes="(max-width: 720px) 92vw, 520px"
                />
              ) : (
                <span
                  className={styles.tilePlaceholder}
                  style={{ background: t.color || "#2e4a3a" }}
                >
                  {t.title}
                </span>
              )}
              {t.soon && <span className={styles.soon}>Coming soon</span>}
            </span>
            <span className={styles.body}>
              <span className={styles.tag}>{t.tag}</span>
              <span className={styles.title}>{t.title}</span>
              <span className={styles.sub}>{t.sub}</span>
              <span className={styles.cta}>{t.cta}</span>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
