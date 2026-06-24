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
  video?: string;
  poster?: string;
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
    video: "/videos/hero.mp4",
    poster: "/images/door-watch.jpg",
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
        <div className="wrap">
          <div className={styles.bismillahWrap}>
            <p className={styles.bismillah}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</p>
            <span className="divider" aria-hidden="true"><span /></span>
          </div>
          <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
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
              <video
                className={styles.artImg}
                src="/videos/hero.mp4"
                poster="/images/hero-video-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </span>
            <span className={`${styles.artCard} ${styles.artBook}`}>
              <Image src="/images/book-duas.jpg" alt="" width={520} height={520} className={styles.artImg} />
            </span>
            <span className={`${styles.artCard} ${styles.artPhone}`}>
              <Image src="/images/app-home.jpg" alt="" width={360} height={685} className={styles.artImg} />
            </span>
          </div>
          </div>
        </div>
      </section>

      {/* ── the why ── */}
      <section className={styles.why}>
        <div className={`wrap ${styles.whyInner}`}>
          <span className="divider" aria-hidden="true"><span /></span>
          <p className={styles.whyText}>
            Every film, book, and feature is made with the same care: rooted in
            the Quran and Sunnah, and beautiful enough to return to. One studio
            for the whole family, from a child&apos;s first dua to your own quiet
            dhikr.
          </p>
        </div>
      </section>

      {/* ── featured: the personalized "I Am [Child]" book ── */}
      <section className={styles.featured}>
        <div className={`wrap ${styles.featuredInner}`}>
          <Link href="/books/i-am" className={styles.featuredCover} aria-hidden="true" tabIndex={-1}>
            <span className={styles.fcPhotoHint}>Your photo</span>
            <span className={styles.fcScrim} aria-hidden="true" />
            <span className={styles.fcKeyline} aria-hidden="true" />
            <span className={styles.fcPlate}>
              <span className={styles.fcStar} aria-hidden="true">✦</span>
              <span className={styles.fcIam}>I am</span>
              <span className={styles.fcName}>Your child</span>
              <span className={styles.fcRule} aria-hidden="true" />
              <span className={styles.fcNameAr} dir="rtl" lang="ar">اسم طفلك</span>
            </span>
          </Link>
          <div className={styles.featuredCopy}>
            <p className="eyebrow">New · Personalized</p>
            <h2 className={styles.featuredTitle}>
              I Am <span className={styles.gold}>[Your Child]</span>
            </h2>
            <p className={styles.featuredDesc}>
              A keepsake where your child is the hero of every page: twelve
              beautiful traits in English and Arabic, with their name, your
              dedication, and your own photos.
            </p>
            <div className={styles.featuredCta}>
              <Link href="/books/i-am" className="btn btn-primary">
                Personalize the book
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── the three worlds ── */}
      <section className={`wrap ${styles.worlds}`} id="worlds">
        <div className={styles.grid}>
          {worlds.map((w) => {
            const inner = (
              <>
                <span className={styles.doorImgWrap} id={w.internal ? undefined : w.key}>
                  {w.video ? (
                    <video
                      className={styles.doorVid}
                      src={w.video}
                      poster={w.poster}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <Image src={w.img} alt="" width={1200} height={800} className={styles.doorImg} />
                  )}
                  <span className={styles.doorShade} aria-hidden="true" />
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
