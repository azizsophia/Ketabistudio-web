import Link from "next/link";
import Image from "next/image";
import styles from "./Gateway.module.css";

/* The three expressions of one mission, framed as stages of a family's
   journey so the app reads as "the grown-ups' corner," not a random product. */
type World = {
  key: string;
  href: string;
  internal: boolean;
  age: string;
  title: string;
  desc: string;
  img: string;
  cta?: string;
  socials?: { label: string; href: string }[];
};

const worlds: World[] = [
  {
    key: "watch",
    href: "#watch",
    internal: false,
    age: "For the curious",
    title: "Short films",
    desc: "The Quran's wonders, our history, and the signs of our time — the videos that started it all.",
    img: "/images/door-watch.jpg",
    socials: [
      { label: "TikTok", href: "https://www.tiktok.com/@ketabi.studio" },
      { label: "YouTube", href: "https://www.youtube.com/@KetabiStudio" },
    ],
  },
  {
    key: "read",
    href: "/books",
    internal: true,
    age: "For little hearts",
    title: "Children's books",
    desc: "Hand-illustrated, personalized storybooks that make your child the star of their own dua.",
    img: "/images/door-read.jpg",
    cta: "Open the library",
  },
  {
    key: "reflect",
    href: "/app",
    internal: true,
    age: "For you",
    title: "The app",
    desc: "Daily adhkar, a Quran journal, and your Garden in Jannah. Calm, free, and ad-free.",
    img: "/images/door-reflect.jpg",
    cta: "Explore the app",
  },
];

export default function Gateway() {
  return (
    <>
      {/* ── brand hero ── */}
      <section className={styles.hero}>
        <div className={`wrap ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={`arabic ${styles.bismillah}`}>
              بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
            </p>
            <p className="eyebrow">Ketabi Studio</p>
            <h1 className={styles.h1}>
              Beautiful Islamic learning,
              <br />
              for every age<span className={styles.gold}>.</span>
            </h1>
            <p className={`lede ${styles.lede}`}>
              An Islamic studio of short films, children&apos;s storybooks, and a
              mindful app — three ways for one family to grow closer to Allah,
              each made with intention.
            </p>
            <div className={styles.heroCta}>
              <a href="#worlds" className="btn btn-primary">See what we make</a>
              <Link href="/books" className={styles.heroTextLink}>
                Meet the books →
              </Link>
            </div>
          </div>

          {/* signature visual: one studio, three ages */}
          <div className={styles.heroArt} aria-hidden="true">
            <span className={`${styles.artCard} ${styles.artVideo}`}>
              <Image src="/images/door-watch.jpg" alt="" width={640} height={420} className={styles.artImg} />
              <span className={styles.artPlay}>▶</span>
            </span>
            <span className={`${styles.artCard} ${styles.artBook}`}>
              <Image src="/images/book-duas.jpg" alt="" width={520} height={520} className={styles.artImg} />
            </span>
            <span className={`${styles.artCard} ${styles.artPhone}`}>
              <Image src="/images/app-garden.jpg" alt="" width={360} height={685} className={styles.artImg} />
            </span>
          </div>
        </div>
      </section>

      {/* ── the why ── */}
      <section className={styles.why}>
        <div className={`wrap ${styles.whyInner}`}>
          <span className="divider" aria-hidden="true"><span /></span>
          <p className={styles.whyText}>
            We make the Islamic content we wish we&apos;d grown up with —
            beautiful enough to keep, and true enough to trust. From a child&apos;s
            first dua to your own quiet dhikr, Ketabi is for the whole family.
          </p>
        </div>
      </section>

      {/* ── the three worlds ── */}
      <section className={`wrap ${styles.worlds}`} id="worlds">
        <header className={styles.worldsHead}>
          <p className="eyebrow">One studio, every age</p>
          <h2 className={styles.worldsTitle}>Three ways to grow</h2>
        </header>

        <div className={styles.grid}>
          {worlds.map((w) => {
            const inner = (
              <>
                <span className={styles.doorImgWrap} id={w.internal ? undefined : w.key}>
                  <Image src={w.img} alt="" width={1200} height={800} className={styles.doorImg} />
                  <span className={styles.doorShade} aria-hidden="true" />
                  {!w.internal && <span className={styles.doorPlay} aria-hidden="true">▶</span>}
                </span>
                <span className={styles.doorBody}>
                  <span className={styles.doorAge}>{w.age}</span>
                  <span className={styles.doorTitle}>{w.title}</span>
                  <span className={styles.doorDesc}>{w.desc}</span>
                  {w.internal ? (
                    <span className={styles.doorCta}>{w.cta} →</span>
                  ) : (
                    <span className={styles.doorSocials}>
                      {w.socials!.map((s) => (
                        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
                          {s.label}
                        </a>
                      ))}
                    </span>
                  )}
                </span>
              </>
            );
            return w.internal ? (
              <Link key={w.key} href={w.href} className={styles.door}>{inner}</Link>
            ) : (
              <div key={w.key} className={styles.door}>{inner}</div>
            );
          })}
        </div>
      </section>
    </>
  );
}
