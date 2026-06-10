import Link from "next/link";
import Image from "next/image";
import styles from "./Gateway.module.css";

const watchDoor = {
  id: "watch",
  eyebrow: "I · Watch",
  title: "Short videos",
  desc: "Quran miracles, history, and the signs of our time.",
  img: "/images/door-watch.jpg",
  socials: [
    { label: "TikTok", href: "https://www.tiktok.com/@ketabi.studio" },
    { label: "YouTube", href: "https://www.youtube.com/@KetabiStudio" },
  ],
};

const linkDoors = [
  {
    href: "/books",
    eyebrow: "II · Read",
    title: "Children's books",
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
          <div className={styles.scrollHint} aria-hidden="true">
            Where would you like to go?
          </div>
        </div>
      </section>

      <section className={`wrap ${styles.doors}`} id="watch">
        {/* Door I — Watch (with TikTok + YouTube) */}
        <div className={styles.door}>
          <span className={styles.doorImgWrap}>
            <Image
              src={watchDoor.img}
              alt=""
              width={1200}
              height={800}
              className={styles.doorImg}
            />
            <span className={styles.doorShade} aria-hidden="true" />
          </span>
          <span className={styles.doorBody}>
            <span className={styles.doorEyebrow}>{watchDoor.eyebrow}</span>
            <span className={styles.doorTitle}>{watchDoor.title}</span>
            <span className={styles.doorDesc}>{watchDoor.desc}</span>
            <span className={styles.doorSocials}>
              {watchDoor.socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.label}
                </a>
              ))}
            </span>
          </span>
        </div>

        {/* Doors II + III — internal links */}
        {linkDoors.map((door) => (
          <Link key={door.title} href={door.href} className={styles.door}>
            <span className={styles.doorImgWrap}>
              <Image
                src={door.img}
                alt=""
                width={1200}
                height={800}
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
          </Link>
        ))}
      </section>
    </>
  );
}
