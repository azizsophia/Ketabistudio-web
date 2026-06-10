import Image from "next/image";
import Link from "next/link";
import HeroPersonalizer from "@/components/HeroPersonalizer";
import styles from "./page.module.css";

const books = [
  {
    slug: "amira",
    img: "/images/book-amira.jpg",
    title: "Your Daughter & Her Beautiful Hijab",
    blurb:
      "A personalized keepsake — her name on the cover and woven through every page.",
    tag: "Personalized",
  },
  {
    slug: "juha",
    img: "/images/book-juha.jpg",
    title: "Juha and the Enormous Pumpkin",
    blurb:
      "The beloved folktale, retold with warmth: giving, humility, and gratitude.",
    tag: "Folktale",
  },
  {
    slug: "maryam",
    img: "/images/book-maryam.jpg",
    title: "Maryam is Kind to Her Parents",
    blurb:
      "Little hands can do big things — a story of kindness to Mama and Baba.",
    tag: "Values",
  },
];

export default function Home() {
  return (
    <>
      <HeroPersonalizer />

      <div className="divider" role="presentation">
        <span />
      </div>

      {/* ── BOOKS ── */}
      <section id="books" className="section">
        <div className="wrap">
          <p className="eyebrow">The bookshelf</p>
          <h2>Storybooks made with intention</h2>
          <p className={`lede ${styles.sectionLede}`}>
            Premium hardback-quality printing, gentle prose, and Islamic
            values at the heart of every story.
          </p>
          <div className={styles.shelf}>
            {books.map((b) => (
              <article key={b.slug} className={`card ${styles.bookCard}`}>
                <div className={styles.bookArt}>
                  <Image
                    src={b.img}
                    alt={`${b.title} cover`}
                    width={700}
                    height={700}
                  />
                </div>
                <div className={styles.bookBody}>
                  <p className={styles.bookTag}>{b.tag}</p>
                  <h3>{b.title}</h3>
                  <p className={styles.bookBlurb}>{b.blurb}</p>
                  <p className={styles.bookCta}>Coming soon →</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── APP ── */}
      <section id="app" className={styles.appSection}>
        <div className={`wrap ${styles.appGrid}`}>
          <div>
            <p className="eyebrow">The Ketabi app</p>
            <h2 className={styles.appHeading}>
              Your daily companion for dhikr &amp; reflection
            </h2>
            <p className={`lede ${styles.appLede}`}>
              Track your prayers, keep your morning and evening adhkar, and
              journal your spiritual journey — in a calm space designed with
              intention. No ads. No noise.
            </p>
            <div className={styles.appCtas}>
              <Link href="/about" className="btn btn-primary">
                Learn more
              </Link>
            </div>
          </div>
          <div className={styles.appPanel}>
            <p className={`arabic ${styles.appArabic}`}>
              أَلَا بِذِكْرِ اللّٰهِ تَطْمَئِنُّ الْقُلُوبُ
            </p>
            <p className={styles.appVerse}>
              “Truly, in the remembrance of Allah do hearts find rest.”
            </p>
            <p className={styles.appRef}>Quran 13:28</p>
          </div>
        </div>
      </section>

      {/* ── KIDS CORNER ── */}
      <section id="kids" className="section">
        <div className={`wrap ${styles.kidsCard}`}>
          <p className={styles.kidsEyebrow}>Kids corner</p>
          <h2 className={styles.kidsHeading}>Let&apos;s play and learn!</h2>
          <p className={styles.kidsLede}>
            Stories, activities, and little adventures for young hearts —
            opening soon, inshaAllah.
          </p>
        </div>
      </section>
    </>
  );
}
