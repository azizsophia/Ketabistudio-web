import type { Metadata } from "next";
import styles from "./support.module.css";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Our apps are free and will stay free, built as an ongoing charity. Tips help cover server costs and future development. Jazakallahu khair for your support.",
};

const BMC_URL = "https://buymeacoffee.com/ketabistude";

export default function Support() {
  return (
    <div className={styles.page}>
      {/* ── hero ── */}
      <section className={styles.hero}>
        <div className={`wrap ${styles.heroInner}`}>
          <p className={`arabic ${styles.bismillah}`}>
            بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
          </p>
          <p className="eyebrow">Support</p>
          <h1 className={styles.h1}>
            Free, for His sake<span className={styles.gold}>.</span>
          </h1>
          <p className={`lede ${styles.lede}`}>
            Everything we build for daily worship is free, and it will stay
            that way. If you would like to help carry it, this is the place.
          </p>
          <span className={`divider ${styles.heroDivider}`} aria-hidden="true">
            <span />
          </span>
        </div>
      </section>

      {/* ── the ask ── */}
      <section className={styles.story}>
        <div className={`wrap ${styles.storyInner}`}>
          <p className={styles.lead}>
            Our apps are our sadaqah jariyah, an ongoing charity we pray keeps
            giving long after us.
          </p>
          <p className={styles.para}>
            That is why there are no ads, no subscriptions, and no locked
            features, and why there never will be. But servers, storage, and
            new development all carry real costs, and we carry them gladly. If
            our work has brought any goodness into your day and you would like
            to help keep it running and growing, a small tip goes directly
            toward those costs and nothing else.
          </p>
          <p className={styles.para}>
            Whether you give or simply make dua for us, thank you from the
            bottom of our hearts. May Allah reward you generously, accept it as
            charity given for His sake, and put barakah in everything you love.
          </p>
        </div>
      </section>

      {/* ── tip card ── */}
      <section className={styles.tipWrap}>
        <div className="wrap">
          <div className={styles.tipCard}>
            <span className={styles.mark} aria-hidden="true" />
            <h2 className={styles.tipTitle}>Leave a small tip</h2>
            <p className={styles.tipSub}>
              Every contribution, however small, helps keep our apps free for
              the whole ummah.
            </p>
            <a
              className={styles.bmcBtn}
              href={BMC_URL}
              target="_blank"
              rel="noreferrer"
            >
              Support us on Buy Me a Coffee
            </a>
            <p className={styles.fineprint}>
              Tips are processed securely by Buy Me a Coffee. Jazakallahu
              khair for your support.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
