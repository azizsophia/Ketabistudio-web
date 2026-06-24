import Link from "next/link";
import Image from "next/image";
import FlipBook from "./FlipBook";
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

      {/* ── the books, turning their own pages ── */}
      <section className={styles.showcase}>
        <div className={`wrap ${styles.showcaseInner}`}>
          <p className="eyebrow">Made for your child</p>
          <h2 className={styles.showcaseTitle}>
            Books they see themselves in<span className={styles.gold}>.</span>
          </h2>
          <p className={`lede ${styles.showcaseLede}`}>
            Hand-illustrated, personalized, and printed to order. Turn the pages
            and watch your child become the hero of every one.
          </p>

          <div className={styles.showcaseGrid}>
            <div className={styles.showcaseItem}>
              <FlipBook
                cover="/images/iam/cover.jpg"
                title="I Am — your child"
                pages={[
                  { src: "/images/iam/page06.jpg" },
                  { src: "/images/iam/page08.jpg" },
                  { src: "/images/iam/page20.jpg" },
                ]}
                stage="forest"
                eyebrow="Personalized"
                caption="Your child’s name will be here, and on every page"
              />
              <Link href="/books/i-am" className="btn btn-primary">
                Personalize “I Am”
              </Link>
            </div>

            <div className={styles.showcaseItem}>
              <FlipBook
                cover="/images/book-amira.jpg"
                title="Her Beautiful Hijab"
                pages={[
                  { src: "/images/preview-amira-5.jpg" },
                  { src: "/images/preview-amira-8.jpg" },
                  { src: "/images/preview-amira-12.jpg" },
                ]}
                stage="forest"
                eyebrow="Personalized"
                caption="Your child’s name will be here, and on every page"
              />
              <Link href="/books/her-beautiful-hijab" className="btn btn-primary">
                See the Hijab book
              </Link>
            </div>

            <div className={styles.showcaseItem}>
              <FlipBook
                cover="/images/keepsake/about-mama/cover.jpg"
                title="Everything I Love About Mama"
                pages={[
                  { src: "/images/keepsake/about-mama/page04.jpg" },
                  { src: "/images/keepsake/about-mama/page12.jpg" },
                  { src: "/images/keepsake/about-mama/page23.jpg" },
                ]}
                stage="charcoal"
                eyebrow="A hardcover keepsake"
                caption="Your own photos and words, sealed with a dua"
              />
              <Link href="/shop/keepsakes" className="btn btn-primary">
                Explore keepsakes
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
