import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import styles from "./coming-soon.module.css";

export const metadata: Metadata = {
  title: "Coming soon",
  description:
    "Ketabi Studio — beautiful, intentional Islamic learning for the whole family. Our storybook shop is opening soon. Download the Ketabi app today.",
};

const APP_STORE = "https://apps.apple.com/us/app/ketabi/id6768112231";
const GOOGLE_PLAY =
  "https://play.google.com/store/apps/details?id=com.ketabi.myapp";

export default function ComingSoon() {
  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
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
          child&apos;s first dua to your own daily dhikr. Our personalized
          storybook shop is opening soon, in shaa Allah.
        </p>

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
