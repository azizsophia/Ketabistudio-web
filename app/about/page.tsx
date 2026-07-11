import type { Metadata } from "next";
import Link from "next/link";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About",
  description:
    "Ketabi Studio is a small independent studio making keepsakes for Muslim families: personalized storybooks, a 30-day Qur'an journal, digital cards and hardcover photo books. Made to be kept.",
};

const pillars = [
  {
    title: "Calm by design",
    desc: "A gentle aesthetic that never overwhelms you with notifications or gamification. Every page and screen is crafted to bring you peace.",
  },
  {
    title: "Authentic",
    desc: "Rooted in the Quran and Sunnah. Every dua, ayah, and story is checked against authentic sources and verified Hadith, never invented.",
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
          <p className="eyebrow">About</p>
          <h1 className={styles.h1}>
            Made to be
            <br />
            kept<span className={styles.gold}>.</span>
          </h1>
          <p className={`lede ${styles.lede}`}>
            Ketabi means &ldquo;my book.&rdquo; We are a small studio making
            keepsakes for Muslim families: personalized storybooks, a 30-day
            Qur&apos;an journal, digital cards, and hardcover photo books. Each
            one is made by hand, checked with care, and meant to be kept.
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
            We make a small number of things, and we make them well.
          </p>
          <p className={styles.para}>
            Ketabi started with a simple wish: for Islamic gifts and learning to
            feel as warm and beautiful as the deen itself. So much out there
            feels mass-produced, or careless with the sacred. We wanted the
            opposite, so we make things slowly and hold every one to the same
            standard.
          </p>
          <p className={styles.para}>
            Today that means hand-illustrated storybooks where your child
            becomes the star of the story, From One Root, a 30-day journal that
            opens the Qur&apos;an one Arabic word at a time with every source
            cited, digital cards that carry your own voice, and hardcover photo
            books for the people you love most. A free app for daily dhikr is on
            the way, and we share short reflections on our YouTube. Different
            things for different moments, all held to one standard.
          </p>
        </div>
      </section>

      {/* ── values / pillars ── */}
      <section className={styles.values}>
        <div className="wrap">
          <div className={styles.valuesHead}>
            <p className="eyebrow">Design philosophy</p>
            <h2>Made with intent</h2>
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
            The <span className={styles.accent}>books</span> make it personal,
            the <span className={styles.accent}>journal</span> makes it daily,
            and every <span className={styles.accent}>keepsake</span> makes it
            last. Different ages, one family, one intention.
          </p>
        </div>
      </section>

      {/* ── closing CTA ── */}
      <section className={`wrap ${styles.cta}`}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Come and see what we make</h2>
          <p className={styles.ctaBody}>
            Start with a storybook for the little ones, or the journal for your
            own heart. Everything is made with the same care.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/books" className="btn btn-gold">
              Explore the books
            </Link>
            <Link href="/shop" className={`btn ${styles.ctaPlay}`}>
              Shop everything
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
