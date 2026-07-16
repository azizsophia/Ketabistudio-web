import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./shop.module.css";

export const metadata: Metadata = {
  title: "Shop: books, keepsakes and cards",
  description:
    "Hand-illustrated Islamic storybooks, personalized photo keepsakes, and animated digital cards, made with care.",
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
    sub: "Hand-illustrated Islamic stories: folktales, values, and books your child can star in.",
    cta: "Browse storybooks →",
    img: "/images/shop/storybooks.jpg",
  },
  {
    href: "/shop/keepsakes",
    tag: "Your photos, heartfelt words",
    title: "Keepsakes",
    sub: "Hardcover photo books you fill with your own photos. Every caption comes lovingly written, yours to keep or make your own, for Mama, Baba, grandparents, your spouse, a new baby, and Ramadan.",
    cta: "Browse keepsakes →",
    img: "/images/shop/keepsakes.jpg",
  },
  {
    href: "https://ketabistudio.etsy.com",
    tag: "The 30-day Qur'an journal",
    title: "From One Root",
    sub: "One Arabic root a day, rahma, sabr, shukr, traced to the ayah it lives in, with room to write. Instant download on Etsy.",
    cta: "Start day one \u2192",
    img: "/images/journal-from-one-root.jpg",
  },
  {
    href: "/digital-cards",
    tag: "Sent in a moment",
    title: "Digital Cards",
    sub: "A beautiful animated card delivered by a private link. Share it by text, WhatsApp or email, anywhere in the world. Sealed with a dua, opened like real mail.",
    cta: "Send a digital card →",
    img: "/images/shop/digital-cards-v2.jpg",
  },
];

export default function ShopPage() {
  return (
    <div className={styles.shop}>
      <header className={styles.hero}>
        <p className="eyebrow">The Ketabi Shop</p>
        <h1 className={styles.h1}>Made to be kept.</h1>
        <p className={`lede ${styles.lede}`}>
          Everything we make to read, to keep, and to give. Printed to order
          with care, and we ship worldwide.
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
