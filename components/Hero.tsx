import Link from "next/link";
import Image from "next/image";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`wrap ${styles.inner}`}>
        <h1 className={styles.h1}>
          The wonder of the Quran,
          <br />
          for every age<span className={styles.gold}>.</span>
        </h1>
        <p className={`lede ${styles.lede}`}>
          Films that explore its miracles. Storybooks for little hearts. A
          calm app for your daily dhikr.
        </p>

        <div className={styles.bento}>
          <Link href="#learn" className={`${styles.tile} ${styles.tileWatch}`}>
            <span className={styles.tileNum}>I</span>
            <span className={`arabic ${styles.tileArabic}`} aria-hidden="true">
              قُلْ هُوَ اللَّهُ أَحَدٌ
            </span>
            <span className={styles.tileTitle}>Watch &amp; wonder</span>
            <span className={styles.tileDesc}>
              The Quran&apos;s miracles, in short films
            </span>
          </Link>

          <Link href="#books" className={`${styles.tile} ${styles.tileRead}`}>
            <Image
              src="/images/hero-medium.jpg"
              alt=""
              width={1100}
              height={1100}
              priority
              className={styles.tileArt}
            />
            <span className={styles.tileShade} aria-hidden="true" />
            <span className={styles.tileNum}>II</span>
            <span className={styles.tileTitle}>Read together</span>
            <span className={styles.tileDesc}>
              Storybooks for little ones
            </span>
          </Link>

          <Link href="#app" className={`${styles.tile} ${styles.tileApp}`}>
            <Image
              src="/images/app-adhkar-ar.jpg"
              alt=""
              width={560}
              height={1065}
              className={styles.tilePhone}
            />
            <span className={styles.tileNum}>III</span>
            <span className={styles.tileTitle}>Reflect daily</span>
            <span className={styles.tileDesc}>The Ketabi app</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
