import Link from "next/link";
import styles from "./Hero.module.css";

const contents = [
  { num: "I", title: "Watch & wonder", desc: "Films on the Quran's miracles", href: "#learn" },
  { num: "II", title: "Read together", desc: "Storybooks for little ones", href: "#books" },
  { num: "III", title: "Reflect daily", desc: "The Ketabi app", href: "#app" },
];

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`wrap ${styles.inner}`}>
        <p className="eyebrow">Ketabi Studio</p>
        <h1 className={styles.h1}>
          From the Quran&apos;s wonders
          <br />
          to bedtime stories.
        </h1>
        <p className={`lede ${styles.lede}`}>
          Short films exploring the miracles of the Quran, hand-illustrated
          storybooks for children, and a calm companion app for your daily
          dhikr — made with intention.
        </p>

        <nav className={styles.contents} aria-label="Page contents">
          <p className={styles.contentsLabel}>Contents</p>
          {contents.map((c) => (
            <Link key={c.num} href={c.href} className={styles.row}>
              <span className={styles.num}>{c.num}</span>
              <span className={styles.rowTitle}>{c.title}</span>
              <span className={styles.dots} aria-hidden="true" />
              <span className={styles.rowDesc}>{c.desc}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
