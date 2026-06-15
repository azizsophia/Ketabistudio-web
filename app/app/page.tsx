import type { Metadata } from "next";
import Image from "next/image";
import styles from "./app.module.css";

export const metadata: Metadata = {
  title: "The Ketabi App",
  description:
    "Your daily companion for dhikr, reflection, and peace, adhkar tracking, a Quran journal, and your Garden in Jannah. Free and ad-free.",
};

const features = [
  {
    img: "/images/app-checkin.jpg",
    eyebrow: "Your spiritual rhythm",
    title: "Begin with intention",
    body: "A gentle greeting, an inspirational ayah, and your rhythm for the day. A nudge toward your adhkar, or a quiet moment to journal.",
  },
  {
    img: "/images/app-adhkar.jpg",
    eyebrow: "Adhkar tracking",
    title: "Morning, evening, and every salah",
    body: "Track your daily remembrance: morning and evening adhkar, after-salah dhikr, and before-sleep duas, all with audio recitation to follow along.",
  },
  {
    img: "/images/app-garden.jpg",
    eyebrow: "Your Garden in Jannah",
    title: "Watch your rewards grow",
    body: "Every adhkar plants a date palm. Stay consistent and palaces rise. A living picture of the Prophet's ﷺ promise, growing with your dhikr.",
  },
  {
    img: "/images/app-journal.jpg",
    eyebrow: "Quran journal",
    title: "Read, reflect, and speak your heart",
    body: "Every surah of the Quran, ready to read and reflect on. Write your own tafsir, record a voice note, or follow guided prompts tuned to how your heart feels today.",
  },
];

export default function AppPage() {
  return (
    <div className={styles.page}>
      {/* ── floating phones hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={`wrap ${styles.heroInner}`}>
          <p className={`eyebrow ${styles.heroEyebrow}`}>The Ketabi app</p>
          <h1 className={styles.h1}>
            A calm space for
            <br />
            your daily dhikr<span className={styles.gold}>.</span>
          </h1>
          <p className={`lede ${styles.lede}`}>
            Free, ad-free, and designed with intention. Track your adhkar,
            journal the Quran, and watch your Garden in Jannah grow.
          </p>
          <div className={styles.stores}>
            <a
              href="https://apps.apple.com/us/app/ketabi/id6768112231"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-gold"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.ketabi.myapp"
              target="_blank"
              rel="noopener noreferrer"
              className={`btn ${styles.heroPlay}`}
            >
              Google Play
            </a>
          </div>
          <p className={styles.heroNote}>Always free. Always ad-free.</p>

          {/* fanned, floating app screens */}
          <div className={styles.fan} aria-hidden="true">
            <span className={`${styles.fanCard} ${styles.fanLeft}`}>
              <Image
                src="/images/app-heart.jpg"
                alt=""
                width={560}
                height={1065}
                className={styles.fanImg}
              />
            </span>
            <span className={`${styles.fanCard} ${styles.fanRight}`}>
              <Image
                src="/images/app-adhkar.jpg"
                alt=""
                width={560}
                height={1065}
                className={styles.fanImg}
              />
            </span>
            <span className={`${styles.fanCard} ${styles.fanCenter}`}>
              <Image
                src="/images/app-home.jpg"
                alt="Ketabi app home screen"
                width={560}
                height={1065}
                priority
                className={styles.fanImg}
              />
            </span>
          </div>
        </div>
      </section>

      {/* features, alternating */}
      <section className={styles.features}>
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`wrap ${styles.feature} ${i % 2 ? styles.flip : ""}`}
          >
            <div className={styles.featurePhone}>
              <span className={styles.featureGlow} aria-hidden="true" />
              <Image
                src={f.img}
                alt={`${f.title}, app screen`}
                width={560}
                height={1065}
                className={styles.shot}
              />
            </div>
            <div className={styles.featureCopy}>
              <p className="eyebrow">{f.eyebrow}</p>
              <h2 className={styles.h2}>{f.title}</h2>
              <p className={styles.body}>{f.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* support row */}
      <section className={`wrap ${styles.supportRow}`}>
        <a
          className={`card ${styles.supportCard}`}
          href="mailto:ketabistudio@gmail.com?subject=Feature request, Ketabi app"
        >
          <span className={styles.supportTitle}>Request a feature</span>
          <span className={styles.supportDesc}>
            Tell us what would make Ketabi better for you.
          </span>
        </a>
        <a
          className={`card ${styles.supportCard}`}
          href="mailto:ketabistudio@gmail.com?subject=Ketabi app support"
        >
          <span className={styles.supportTitle}>Get support</span>
          <span className={styles.supportDesc}>
            Something not working? We read everything.
          </span>
        </a>
      </section>

      {/* keep ketabi free, intentional, quiet */}
      <section className={`wrap ${styles.coffee}`}>
        <div className={styles.coffeeInner}>
          <p className={`arabic ${styles.coffeeArabic}`}>
            بِسْمِ اللّٰهِ
          </p>
          <span className="divider" aria-hidden="true"><span /></span>
          <h2 className={styles.coffeeTitle}>Keep Ketabi free</h2>
          <p className={styles.coffeeBody}>
            Ketabi is free, ad-free, and built independently, your prayers
            and reflections will never be sold or monetized. If it brings you
            peace, you can help it grow.
          </p>
          <a
            href="https://buymeacoffee.com/ketabistude"
            target="_blank"
            rel="noopener noreferrer"
            className={`btn btn-gold ${styles.coffeeBtn}`}
          >
            Support the project
          </a>
        </div>
      </section>
    </div>
  );
}
