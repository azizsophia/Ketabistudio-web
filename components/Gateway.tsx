import Link from "next/link";
import Image from "next/image";
import styles from "./Gateway.module.css";

const doors = [
  {
    href: "/#",
    eyebrow: "I · Watch",
    title: "Short videos",
    desc: "Quran miracles, history, and the signs of our time.",
    img: "/images/door-watch.jpg",
    external: "https://www.tiktok.com/@ketabi.studio",
    cta: "Watch on TikTok",
  },
  {
    href: "/books",
    eyebrow: "II · Read",
    title: "The library",
    desc: "Hand-illustrated storybooks, personalized for your child.",
    img: "/images/door-read.jpg",
    cta: "Open the library",
  },
  {
    href: "/app",
    eyebrow: "III · Reflect",
    title: "The app",
    desc: "Daily adhkar, a Quran journal, and your Garden in Jannah.",
    img: "/images/door-reflect.jpg",
    cta: "Explore the app",
  },
];

export default function Gateway() {
  return (
    <>
      <section className={styles.hero}>
        <div className={`wrap ${styles.heroInner}`}>
          <p className={`arabic ${styles.bismillah}`}>
            بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
          </p>
          <p className="eyebrow">Welcome to Ketabi Studio</p>
          <h1 className={styles.h1}>
            A place for the whole
            <br />
            family to grow<span className={styles.gold}>.</span>
          </h1>
          <p className={`lede ${styles.lede}`}>
            An Islamic studio of short videos, children&apos;s storybooks, and a
            mindful companion app. Each one made with intention.
          </p>
          <div className={styles.socials}>
            <a href="https://www.tiktok.com/@ketabi.studio" target="_blank" rel="noopener noreferrer">
              TikTok
            </a>
            <a href="https://www.youtube.com/@KetabiStudio" target="_blank" rel="noopener noreferrer">
              YouTube
            </a>
          </div>
          <div className={styles.scrollHint} aria-hidden="true">
            Where would you like to go?
          </div>
        </div>
      </section>

      <section className={`wrap ${styles.doors}`}>
        {doors.map((door) => {
          const inner = (
            <>
              <span className={styles.doorImgWrap}>
                <Image
                  src={door.img}
                  alt=""
                  width={700}
                  height={900}
                  className={styles.doorImg}
                />
                <span className={styles.doorShade} aria-hidden="true" />
              </span>
              <span className={styles.doorBody}>
                <span className={styles.doorEyebrow}>{door.eyebrow}</span>
                <span className={styles.doorTitle}>{door.title}</span>
                <span className={styles.doorDesc}>{door.desc}</span>
                <span className={styles.doorCta}>{door.cta} →</span>
              </span>
            </>
          );
          return door.external ? (
            <a
              key={door.title}
              href={door.external}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.door}
            >
              {inner}
            </a>
          ) : (
            <Link key={door.title} href={door.href} className={styles.door}>
              {inner}
            </Link>
          );
        })}
      </section>
    </>
  );
}
