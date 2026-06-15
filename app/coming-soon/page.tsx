import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import styles from "./coming-soon.module.css";
import WaitlistForm from "./WaitlistForm";

export const metadata: Metadata = {
  title: "Coming soon",
  description:
    "Ketabi Studio — beautiful, intentional Islamic learning for the whole family. Personalized storybooks and luxury cards are opening soon. Join the list and download the Ketabi app today.",
};

const APP_STORE = "https://apps.apple.com/us/app/ketabi/id6768112231";
const GOOGLE_PLAY =
  "https://play.google.com/store/apps/details?id=com.ketabi.myapp";

const TOUR = [
  {
    src: "/images/book-amira.jpg",
    title: "Her Beautiful Hijab",
    note: "Personalized — her name on the cover & through every page",
  },
  {
    src: "/images/book-duas.jpg",
    title: "Beautiful Duas",
    note: "A dua for every moment, with your child as the star",
  },
  {
    src: "/images/book-juha.jpg",
    title: "Juha & the Enormous Pumpkin",
    note: "A warm, witty folktale to read together",
  },
  {
    src: "/images/book-maryam.jpg",
    title: "Maryam is Kind to Her Parents",
    note: "Little hands, big kindness — ending on the Quranic dua",
  },
];

export default function ComingSoon() {
  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        {/* ── hero ── */}
        <Image
          src="/icon.png"
          alt="Ketabi Studio"
          width={64}
          height={64}
          className={styles.mark}
          priority
        />

        <p className={styles.bismillah}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</p>

        <p className={styles.eyebrow}>Ketabi Studio</p>

        <h1 className={styles.h1}>
          Something beautiful
          <br />
          is coming<span className={styles.gold}>.</span>
        </h1>

        <p className={styles.lede}>
          Beautiful, intentional Islamic learning for the whole family — from a
          child&apos;s first dua to your own daily dhikr. Personalized
          storybooks and luxury cards are opening soon, in shaa Allah.
        </p>

        {/* ── waitlist ── */}
        <div className={styles.waitWrap}>
          <p className={styles.waitLabel}>
            Be the first to know when the shop opens
          </p>
          <WaitlistForm />
          <p className={styles.waitFine}>
            No spam, ever — just one note when we launch.
          </p>
        </div>

        {/* ── a peek at what's coming ── */}
        <div className={styles.tourHead}>
          <span className={styles.tourRule} aria-hidden="true" />
          <span>A peek at what&apos;s coming</span>
          <span className={styles.tourRule} aria-hidden="true" />
        </div>

        <div className={styles.tourGrid}>
          {TOUR.map((b) => (
            <figure key={b.title} className={styles.tourCard}>
              <span className={styles.tourImgWrap}>
                <Image
                  src={b.src}
                  alt={b.title}
                  width={300}
                  height={300}
                  className={styles.tourImg}
                />
              </span>
              <figcaption className={styles.tourCap}>
                <span className={styles.tourTitle}>{b.title}</span>
                <span className={styles.tourNote}>{b.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className={styles.tourFoot}>
          Plus a studio of luxury Islamic greeting cards — personalised and
          posted straight to your loved ones.
        </p>

        {/* ── app available today ── */}
        <p className={styles.appNote}>The Ketabi app is here today:</p>

        <div className={styles.stores}>
          <a
            href={APP_STORE}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.storeBtn}
          >
            <span className={styles.storeKicker}>Download on the</span>
            <span className={styles.storeName}>App Store</span>
          </a>
          <a
            href={GOOGLE_PLAY}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.storeBtn}
          >
            <span className={styles.storeKicker}>Get it on</span>
            <span className={styles.storeName}>Google Play</span>
          </a>
        </div>

        <nav className={styles.legal} aria-label="Legal">
          <Link href="/privacy-policy">Privacy Policy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms">Terms</Link>
          <span aria-hidden="true">·</span>
          <a href="mailto:ketabistudio@gmail.com">Contact</a>
        </nav>

        <p className={styles.copyright}>
          © {new Date().getFullYear()} Ketabi Studio
        </p>
      </div>
    </div>
  );
}
