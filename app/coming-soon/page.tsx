import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import styles from "./coming-soon.module.css";
import WaitlistForm from "./WaitlistForm";

export const metadata: Metadata = {
  title: "Ketabi Studio, Islamic keepsakes, books & cards, coming soon",
  description:
    "From One Root, a 30-day Qur'an journal (one Arabic root a day, every source cited) is available now on Etsy. Plus personalized Islamic storybooks, hardcover photo keepsakes, and digital cards with voice notes. Join the founding list for early access. The Ketabi app is available today.",
};

const APP_STORE = "https://apps.apple.com/us/app/ketabi/id6768112231";
const GOOGLE_PLAY =
  "https://play.google.com/store/apps/details?id=com.ketabi.myapp";
const ETSY_JOURNAL =
  "https://www.etsy.com/listing/4533628130/quran-journal-printable-30-day-arabic";

/* product showcases, real, photo-filled imagery */
const KEEPSAKES = [
  {
    src: "/images/coming-soon/keepsake-baba.jpg",
    title: "Everything I Love About Baba",
  },
  {
    src: "/images/coming-soon/keepsake-mama.jpg",
    title: "Everything I Love About Mama",
  },
];

const BOOKS = [
  { src: "/images/coming-soon/iam.jpg", title: "I Am [Your Child]", tag: "Personalized" },
  { src: "/images/book-amira.jpg", title: "Her Beautiful Hijab", tag: "Personalized" },
  { src: "/images/book-duas.jpg", title: "My Beautiful Duas", tag: "Personalized" },
  { src: "/images/book-juha.jpg", title: "Juha & the Enormous Pumpkin", tag: "Storybook" },
  { src: "/images/book-maryam.jpg", title: "Maryam is Kind to Her Parents", tag: "Storybook" },
];

const CARDS = [
  { src: "/images/cards/eid.jpg", title: "Eid" },
  { src: "/images/cards/nikah.jpg", title: "Nikah" },
  { src: "/images/cards/baby.jpg", title: "New Baby" },
  { src: "/images/cards/ramadan.jpg", title: "Ramadan" },
];

const APP_SHOTS = [
  "/images/app-home.jpg",
  "/images/app-garden.jpg",
  "/images/app-adhkar.jpg",
  "/images/app-journal.jpg",
];

export default function ComingSoon() {
  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        {/* ─────────── HERO ─────────── */}
        <header className={styles.hero}>
          <p className={styles.bismillah}>بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</p>

          <Image
            src="/images/logo-vertical.png"
            alt="Ketabi Studio"
            width={132}
            height={134}
            className={styles.logo}
            priority
          />

          <h1 className={styles.h1}>
            Islamic keepsakes your family
            <br className={styles.brDesk} /> will treasure forever
          </h1>

          <p className={styles.lede}>
            Personalized storybooks · hardcover photo keepsakes · digital cards, 
            each one sealed with a dua. Opening soon, inshaAllah.
          </p>

          {/* the product, front and centre, above the fold */}
          <div className={styles.heroShowcase}>
            <div className={styles.heroMain}>
              <Image
                src="/images/coming-soon/keepsake-baba.jpg"
                alt="A hardcover keepsake, Everything I Love About Baba"
                width={520}
                height={520}
                className={styles.heroImg}
                priority
              />
            </div>
            <div className={styles.heroSide}>
              <Image src="/images/coming-soon/iam.jpg" alt="Personalized I Am book" width={260} height={260} className={styles.heroThumb} />
              <Image src="/images/cards/eid.jpg" alt="Eid greeting card" width={260} height={360} className={styles.heroThumbTall} />
            </div>
          </div>

          {/* ─── the founding offer + capture, above the fold ─── */}
          <div className={styles.offer}>
            <span className={styles.offerBadge}>Founding list · first 50</span>
            <p className={styles.offerHead}>
              The first 50 get <span className={styles.gold}>20% off</span> their first keepsake
            </p>
            <p className={styles.offerSub}>
              Join now for early access before we open to everyone, plus your
              founding-member discount when the shop launches, inshaAllah. Once
              the first fifty spots are gone, they&apos;re gone.
            </p>
            <WaitlistForm />
            <p className={styles.waitFine}>One email when we open. No spam, ever.</p>
          </div>
        </header>

        {/* ─────────── APP, available today ─────────── */}
        <section className={styles.appBand}>
          <p className={styles.eyebrow}>Available today</p>
          <h2 className={styles.h2}>The Ketabi app is here now</h2>
          <p className={styles.sectionLede}>
            Your daily companion for dhikr and reflection, track your adhkar,
            journal the Quran, and watch your Garden in Jannah grow. Free,
            ad-free, and available now while you wait for the shop.
          </p>
          <div className={styles.appShots}>
            {APP_SHOTS.map((s, i) => (
              <span key={s} className={`${styles.phone} ${styles[`phone${i}`]}`}>
                <Image src={s} alt="Ketabi app" width={220} height={476} />
              </span>
            ))}
          </div>
          <div className={styles.stores}>
            <a href={APP_STORE} target="_blank" rel="noopener noreferrer" className={styles.storeBtn}>
              <span className={styles.storeKicker}>Download on the</span>
              <span className={styles.storeName}>App Store</span>
            </a>
            <a href={GOOGLE_PLAY} target="_blank" rel="noopener noreferrer" className={styles.storeBtn}>
              <span className={styles.storeKicker}>Get it on</span>
              <span className={styles.storeName}>Google Play</span>
            </a>
          </div>
        </section>

        {/* ─────────── JOURNAL, available now on Etsy ─────────── */}
        <section className={styles.journalBand}>
          <p className={styles.eyebrow}>Available now on Etsy</p>
          <h2 className={styles.h2}>
            From One Root, the language of the Qur&apos;an, one root at a time
          </h2>
          <p className={styles.sectionLede}>
            A 30-day journal. One Arabic root a day, traced back to its classical
            source, with room to reflect. Every source cited, a quiet study of
            the words your prayers are already made of.
          </p>
          <a
            href={ETSY_JOURNAL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.journalImgLink}
          >
            <Image
              src="/images/journal-from-one-root.jpg"
              alt="From One Root, a 30-day journal through the language of the Qur'an"
              width={720}
              height={450}
              className={styles.journalImg}
            />
          </a>
          <div className={styles.stores}>
            <a
              href={ETSY_JOURNAL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.storeBtn}
            >
              <span className={styles.storeKicker}>Shop the journal on</span>
              <span className={styles.storeName}>Etsy</span>
            </a>
          </div>
        </section>

        {/* ─────────── KEEPSAKES ─────────── */}
        <section className={styles.section}>
          <p className={styles.eyebrow}>The keepsake collection</p>
          <h2 className={styles.h2}>Hardcover books, filled with your photos</h2>
          <p className={styles.sectionLede}>
            Twenty things you love about them, for Mama, Baba, grandparents, your
            spouse, a new baby, or Ramadan, each page a heartfelt line, sealed
            with a dua.
          </p>
          <div className={styles.duo}>
            {KEEPSAKES.map((k) => (
              <figure key={k.title} className={styles.showCard}>
                <span className={styles.showImgWrap}>
                  <Image src={k.src} alt={k.title} width={440} height={440} className={styles.showImg} />
                </span>
                <figcaption className={styles.showCap}>{k.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ─────────── BOOKS ─────────── */}
        <section className={styles.section}>
          <p className={styles.eyebrow}>The bookshelf</p>
          <h2 className={styles.h2}>Books that make your child the hero</h2>
          <p className={styles.sectionLede}>
            Personalized Islamic storybooks starring your little one, plus warm
            folktales to read together.
          </p>
          <div className={styles.bookGrid}>
            {BOOKS.map((b) => (
              <figure key={b.title} className={styles.bookCard}>
                <span className={styles.bookImgWrap}>
                  <Image src={b.src} alt={b.title} width={320} height={320} className={styles.bookImg} />
                  <span className={styles.tagPill}>{b.tag}</span>
                </span>
                <figcaption className={styles.bookCap}>{b.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ─────────── CARDS ─────────── */}
        <section className={styles.section}>
          <p className={styles.eyebrow}>Greeting cards</p>
          <h2 className={styles.h2}>Sent for you, sealed with a dua</h2>
          <p className={styles.sectionLede}>
            Beautiful Islamic cards, personalized and posted straight to your
            loved ones, or send a digital card in minutes.
          </p>
          <div className={styles.cardsRow}>
            {CARDS.map((c) => (
              <figure key={c.title} className={styles.cardThumb}>
                <Image src={c.src} alt={c.title} width={280} height={388} />
                <figcaption className={styles.cardCap}>{c.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ─────────── SECOND CAPTURE ─────────── */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalHead}>
            Don&apos;t miss the opening<span className={styles.gold}>.</span>
          </h2>
          <p className={styles.finalSub}>
            Founding members get in first and save 20% on their first order,
            inshaAllah.
          </p>
          <div className={styles.finalForm}>
            <WaitlistForm />
          </div>
          <p className={styles.waitFine}>One email when we open. No spam, ever.</p>
        </section>

        {/* ─────────── FOOTER ─────────── */}
        <footer className={styles.footer}>
          <div className={styles.socials}>
            <a href="https://www.youtube.com/@KetabiStudio" target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>YouTube</a>
            <a href="https://www.tiktok.com/@ketabi.studio" target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>TikTok</a>
          </div>
          <nav className={styles.legal} aria-label="Legal">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <span aria-hidden="true">·</span>
            <a href="mailto:ketabistudio@gmail.com">Contact</a>
          </nav>
          <p className={styles.copyright}>© {new Date().getFullYear()} Ketabi Studio</p>
        </footer>
      </div>
    </div>
  );
}
