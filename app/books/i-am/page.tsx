import type { Metadata } from "next";
import IamBookBuilder from "@/components/IamBookBuilder";
import FlipBook from "@/components/FlipBook";
import { bookPriceDisplay } from "@/lib/pricing";
import styles from "./iam-intro.module.css";

export const metadata: Metadata = {
  title: "I Am: a personalized book of good character",
  description:
    "A personalized keepsake where your child is the hero of every page. Twelve beautiful traits in English and Arabic, with their name, your dedication, and your own photos.",
};

/* The twelve traits printed in the book — written out so a customer knows
   exactly what they are buying before the builder asks for anything. Mirrors
   iam-templates/book-template.html spreads 1-12. */
const TRAITS: { en: string; ar: string }[] = [
  { en: "Kind", ar: "لَطِيف" },
  { en: "Grateful", ar: "شَاكِر" },
  { en: "Loving", ar: "بَارّ" },
  { en: "Generous", ar: "كَرِيم" },
  { en: "Honest", ar: "صَادِق" },
  { en: "Forgiving", ar: "صَفُوح" },
  { en: "Patient", ar: "صَابِر" },
  { en: "Brave", ar: "شُجَاع" },
  { en: "Curious", ar: "مُتَعَلِّم" },
  { en: "Clean", ar: "نَظِيف" },
  { en: "Cheerful", ar: "بَشُوش" },
  { en: "Mindful", ar: "تَقِيّ" },
];

export default function IamBookPage() {
  return (
    <>
      <section className={styles.intro}>
        <div className={`wrap ${styles.introInner}`}>
          <p className="eyebrow">Personalized keepsake</p>
          <h1 className={styles.h1}>I Am [Your Child]</h1>
          <p className={styles.lede}>
            Children grow into the words they hear about themselves. This book
            fills thirty-two pages with the ones that matter: your child&apos;s
            name, your photos, and twelve beautiful traits they already carry,
            each in English and Arabic, sealed with a dua.
          </p>
          <p className={styles.price}>
            From {bookPriceDisplay()} · hardcover or softcover · we ship worldwide
          </p>

          <div className={styles.bookBlock}>
            <FlipBook
              cover="/images/iam/cover-sample.jpg"
              title="I Am [Your Child]"
              pages={[
                { src: "/images/iam/preview-1.jpg" },
                { src: "/images/iam/preview-2.jpg" },
                { src: "/images/iam/preview-3.jpg" },
                { src: "/images/iam/preview-4.jpg" },
                { src: "/images/iam/preview-5.jpg" },
              ]}
              stage="forest"
              eyebrow="Real pages from the book"
              caption="A real sample: your child's name and your photos take these places."
            />
          </div>

          <div className={styles.traits}>
            <p className={styles.traitsHead}>The twelve traits inside</p>
            <p className={styles.traitsSub}>
              One spread each, with your photo on the facing page.
            </p>
            <div className={styles.traitGrid}>
              {TRAITS.map((t) => (
                <div key={t.en} className={styles.trait}>
                  <span className={styles.traitEn}>I am {t.en.toLowerCase()}</span>
                  <span className={styles.traitAr} lang="ar" dir="rtl">
                    {t.ar}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className={styles.makeIt}>Make it their own ↓</p>
        </div>
      </section>
      <IamBookBuilder />
    </>
  );
}
