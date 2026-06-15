import type { Metadata } from "next";
import Link from "next/link";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About",
  description:
    "Ketabi Studio, an independent Islamic studio making beautiful, intentional learning for the whole family, from a child's first dua to your own daily dhikr.",
};

const pillars = [
  {
    title: "Beautiful",
    desc: "Hand-illustrated, carefully typeset, and calm to return to. We believe sacred learning deserves to be lovely.",
  },
  {
    title: "Accurate",
    desc: "Rooted in the Quran and Sunnah. Every dua, ayah, and story is checked against authentic sources, never invented.",
  },
  {
    title: "Intentional",
    desc: "Human-written and made on purpose. No ads, no noise, no shortcuts. Only what helps a heart draw nearer to Allah.",
  },
];

export default function About() {
  return (
    <div className={styles.page}>
      {/* ── hero ── */}
      <section className={styles.hero}>
        <div className={`wrap ${styles.heroInner}`}>
          <p className={`arabic ${styles.bismillah}`}>
            بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
          </p>
          <p className="eyebrow">Our story</p>
          <h1 className={styles.h1}>
            An Islamic studio,
            <br />
            made with intention<span className={styles.gold}>.</span>
          </h1>
          <p className={`lede ${styles.lede}`}>
            Ketabi means &ldquo;my book.&rdquo; We make beautiful, intentional
            learning for the whole family, from a child&apos;s first dua to your
            own daily dhikr.
          </p>
          <span className={`divider ${styles.heroDivider}`} aria-hidden="true">
            <span />
          </span>
        </div>
      </section>

      {/* ── narrative ── */}
      <section className={styles.story}>
        <div className={`wrap ${styles.storyInner}`}>
          <p className={styles.lead}>
            Ketabi began with a simple wish: that learning our deen could feel
            as warm and beautiful as the deen itself.
          </p>
          <p className={styles.para}>
            It started as short films, the Quran&apos;s wonders, our history,
            and the signs of our time, shared with anyone who was curious. From
            there it grew into hand-illustrated storybooks where a child becomes
            the star of their own dua, and then into a quiet app for the
            grown-ups: daily adhkar, a Quran journal, and a Garden in Jannah
            that grows with your dhikr.
          </p>
          <p className={styles.para}>
            One studio, three ways to grow closer to Allah, all made by hand and
            held to the same standard. We write every word ourselves, illustrate
            every page, and check every dua against the Quran and Sunnah. If it
            isn&apos;t beautiful, accurate, and made on purpose, it doesn&apos;t
            ship.
          </p>
        </div>
      </section>

      {/* ── values / pillars ── */}
      <section className={styles.values}>
        <div className="wrap">
          <div className={styles.valuesHead}>
            <p className="eyebrow">What we hold to</p>
            <h2>Three things, every time</h2>
          </div>
          <div className={styles.valuesGrid}>
            {pillars.map((p) => (
              <div key={p.title} className={`card ${styles.pillar}`}>
                <span className={styles.pillarMark} aria-hidden="true" />
                <h3 className={styles.pillarTitle}>{p.title}</h3>
                <p className={styles.pillarDesc}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── three expressions, one mission ── */}
      <section className={styles.threads}>
        <div className={`wrap ${styles.threadsInner}`}>
          <span className="divider" aria-hidden="true"><span /></span>
          <p className={styles.threadsLine}>
            The <span className={styles.accent}>films</span> spark wonder, the{" "}
            <span className={styles.accent}>books</span> make it personal, and
            the <span className={styles.accent}>app</span> turns it into a daily
            habit. Different ages, one family, one intention.
          </p>
        </div>
      </section>

      {/* ── closing CTA ── */}
      <section className={`wrap ${styles.cta}`}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Come and see what we make</h2>
          <p className={styles.ctaBody}>
            Start with a storybook for the little ones, or a calm space for your
            own dhikr. Both made with the same care.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/books" className="btn btn-gold">
              Explore the books
            </Link>
            <Link href="/app" className={`btn ${styles.ctaPlay}`}>
              Discover the app
            </Link>
          </div>
          <p className={styles.contact}>
            Questions, orders, or anything else? Reach us at{" "}
            <a href="mailto:ketabistudio@gmail.com">ketabistudio@gmail.com</a>.
            We read everything.
          </p>
        </div>
      </section>
    </div>
  );
}
