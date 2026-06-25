import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import styles from "./coming-soon.module.css";
import WaitlistForm from "./WaitlistForm";

export const metadata: Metadata = {
  title: "Coming soon",
  description:
    "Ketabi Studio. Personalized Islamic storybooks, hardcover photo keepsakes, and beautifully made greeting cards, each sealed with a dua. Join the founding list and download the Ketabi app today.",
};

const APP_STORE = "https://apps.apple.com/us/app/ketabi/id6768112231";
const GOOGLE_PLAY =
  "https://play.google.com/store/apps/details?id=com.ketabi.myapp";

const TOUR = [
  {
    src: "/images/book-amira.jpg",
    title: "Her Beautiful Hijab",
    note: "Personalized, with her name on the cover and through every page",
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
    note: "Little hands, big kindness, ending on the Quranic dua",
  },
];

const CARDS = [
  { src: "/images/cards/eid.jpg", title: "Eid" },
  { src: "/images/cards/nikah.jpg", title: "Nikah" },
  { src: "/images/cards/baby.jpg", title: "New Baby" },
  { src: "/images/cards/wife.jpg", title: "For My Wife" },
];

const PERKS = [
  "Early access to shop before we open to everyone",
  "First look at every new book, keepsake and card",
  "A founding member welcome when we open, Inshallah",
];

export default function ComingSoon() {
  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        {/* ── hero ── */}
        <p className={styles.bismillah}>بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</p>

        <Image
          src="/images/logo-vertical.png"
          alt="Ketabi Studio"
          width={170}
          height={173}
          className={styles.logo}
          priority
        />

        <h1 className={styles.h1}>
          Something beautiful
          <br />
          is coming<span className={styles.gold}>.</span>
        </h1>

        <p className={styles.lede}>
          Beautiful, intentional Islamic gifts for the whole family.
          Personalized storybooks, hardcover photo keepsakes you fill with your
          own photos, and beautifully made greeting cards, each one sealed with a
          dua. Opening soon, Inshallah.
        </p>

        {/* ── waitlist ── */}
        <div className={styles.waitWrap}>
          <p className={styles.waitLabel}>Join the founding list</p>
          <ul className={styles.perks}>
            {PERKS.map((p) => (
              <li key={p} className={styles.perk}>
                <span className={styles.perkMark} aria-hidden="true">
                  ✦
                </span>
                {p}
              </li>
            ))}
          </ul>
          <WaitlistForm />
          <p className={styles.waitFine}>
            One note when we open. No spam, ever.
          </p>
        </div>

        {/* ── app available today (above the books) ── */}
        <p className={styles.appNote}>The Ketabi app is here today</p>

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

        {/* ── a peek at what's coming ── */}
        <div className={styles.tourHead}>
          <span className={styles.tourRule} aria-hidden="true" />
          <span>A peek at what&apos;s coming</span>
          <span className={styles.tourRule} aria-hidden="true" />
        </div>

        <p className={styles.peekSub}>Personalized storybooks</p>
        <p className={styles.tourIntro}>
          A whole shelf of children&apos;s books, some personalized so your
          little one becomes the star of their very own story.
        </p>

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
                <span className={styles.tourSheen} aria-hidden="true" />
              </span>
              <figcaption className={styles.tourCap}>
                <span className={styles.tourTitle}>{b.title}</span>
                <span className={styles.tourNote}>{b.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className={styles.peekSub}>Photo keepsakes</p>
        <p className={styles.tourIntro}>
          Hardcover books you fill with your own photos, each page with a
          heartfelt line written for you, for Mama, Baba, grandparents, your
          spouse, a new baby, and Ramadan. Sealed with a dua.
        </p>

        <p className={styles.peekSub}>Greeting cards</p>
        <p className={styles.tourIntro}>
          Beautifully designed Islamic cards, each with a vetted dua,
          personalized and posted straight to your loved ones.
        </p>

        <div className={styles.cardsRow}>
          {CARDS.map((c) => (
            <span key={c.title} className={styles.cardThumb}>
              <Image src={c.src} alt={c.title} width={300} height={420} />
            </span>
          ))}
        </div>

        {/* ── follow us ── */}
        <div className={styles.followWrap}>
          <p className={styles.followLabel}>Follow us</p>
          <div className={styles.socials}>
            <a
              href="https://www.youtube.com/@KetabiStudio"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialBtn}
            >
              YouTube
            </a>
            <a
              href="https://www.tiktok.com/@ketabi.studio"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialBtn}
            >
              TikTok
            </a>
          </div>
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
