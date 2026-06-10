import Image from "next/image";
import Link from "next/link";
import Hero from "@/components/Hero";
import Personalizer from "@/components/Personalizer";
import AppGallery from "@/components/AppGallery";
import styles from "./page.module.css";

const books = [
  {
    slug: "juha",
    img: "/images/book-juha.jpg",
    title: "Juha and the Enormous Pumpkin",
    blurb: "The beloved folktale retold: giving, humility, and gratitude.",
    tag: "Folktale",
    spine: "#d88a2b",
  },
  {
    slug: "maryam",
    img: "/images/book-maryam.jpg",
    title: "Maryam is Kind to Her Parents",
    blurb: "Little hands can do big things — kindness to Mama and Baba.",
    tag: "Values",
    spine: "#78bab2",
  },
];

const videos = [
  { title: "The Hidden Symmetry in Surah Al-Ikhlas", topic: "Quran by design" },
  { title: "The Quran and the Expanding Universe", topic: "Signs in creation" },
  { title: "Zamzam: Four Thousand Years of Water", topic: "Living history" },
];

export default function Home() {
  return (
    <>
      <Hero />

      {/* ── CHAPTER 1: WATCH & LEARN ── */}
      <section id="learn" className="section">
        <div className={`wrap ${styles.chapter}`}>
          <div className={styles.chapterHead}>
            <span className={styles.chapterNum}>Chapter one</span>
            <h2>Watch &amp; wonder</h2>
            <p className="lede">
              Quran deep-dives, miracles, and prophecies — short films watched
              and shared by a community of 65,000+.
            </p>
          </div>
          <div className={styles.videoRow}>
            {videos.map((v) => (
              <a
                key={v.title}
                href="https://www.tiktok.com/@ketabi.studio"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.videoCard}
              >
                <span className={styles.videoTopic}>{v.topic}</span>
                <span className={styles.videoTitle}>{v.title}</span>
                <span className={styles.videoWatch}>Watch →</span>
              </a>
            ))}
          </div>
          <div className={styles.chapterCtas}>
            <a
              href="https://www.tiktok.com/@ketabi.studio"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              TikTok
            </a>
            <a
              href="https://www.youtube.com/@KetabiStudio"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              YouTube
            </a>
          </div>
        </div>
      </section>

      {/* ── CHAPTER 2: READ TOGETHER ── */}
      <section id="books" className={styles.booksSection}>
        <div className={`wrap ${styles.chapter}`}>
          <div className={styles.chapterHead}>
            <span className={styles.chapterNum}>Chapter two</span>
            <h2>For the little ones</h2>
            <p className="lede">
              Hand-illustrated storybooks with Islamic values at heart — made
              to be read together at bedtime. More coming soon, inshaAllah.
            </p>
          </div>
          <Personalizer />
          <p className={styles.alsoLabel}>Also on the shelf</p>
          <div className={styles.shelf}>
            {books.map((b) => (
              <Link key={b.slug} href="#books" className={styles.bookItem}>
                <span className={styles.bookScene}>
                  <span className={styles.book3d}>
                    <span
                      className={styles.bookSpine}
                      style={{ background: b.spine }}
                    />
                    <Image
                      src={b.img}
                      alt={`${b.title} cover`}
                      width={700}
                      height={700}
                      className={styles.bookFace}
                    />
                  </span>
                </span>
                <span className={styles.bookMeta}>
                  <span className={styles.bookTag}>{b.tag}</span>
                  <span className={styles.bookTitle}>{b.title}</span>
                  <span className={styles.bookBlurb}>{b.blurb}</span>
                  <span className={styles.bookCta}>Coming soon →</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHAPTER 3: REFLECT DAILY ── */}
      <section id="app" className={styles.appSection}>
        <div className="wrap">
          <div className={styles.appTop}>
            <div>
              <span className={`${styles.chapterNum} ${styles.chapterNumLight}`}>
                Chapter three
              </span>
              <h2 className={styles.appHeading}>Reflect daily</h2>
              <p className={`lede ${styles.appLede}`}>
                The Ketabi app — track your prayers, keep your morning and
                evening adhkar, and journal your journey in a calm, ad-free
                space.
              </p>
              <div className={styles.appCtas}>
                <a
                  href="https://apps.apple.com/us/app/ketabi/id6768112231"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-gold"
                >
                  Download on the App Store
                </a>
                <span className={styles.playSoon}>Google Play — coming soon</span>
              </div>
            </div>
            <div className={styles.appQuote}>
              <p className={`arabic ${styles.appArabic}`}>
                أَلَا بِذِكْرِ اللّٰهِ تَطْمَئِنُّ الْقُلُوبُ
              </p>
              <p className={styles.appVerse}>
                “Truly, in the remembrance of Allah do hearts find rest.”
              </p>
              <p className={styles.appRef}>Quran 13:28</p>
            </div>
          </div>
          <AppGallery />
        </div>
      </section>

    </>
  );
}
