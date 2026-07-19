import Link from "next/link";
import Image from "next/image";
import Personalizer from "./Personalizer";
import TrustLayer from "./TrustLayer";
import styles from "./HomeLanding.module.css";
import { BOOKS } from "@/lib/books";
import { bookPriceDisplay, HARDCOVER_PRICE_DISPLAY } from "@/lib/pricing";

/* Launch home: "Made to be kept." One brand line that is true of every
   product world, each world given equal weight, and the live personalizer
   (the winning product) demonstrated above the fold instead of hidden on a
   product page. Mobile-first; every block reflows from 320px up. */

const visibleBooks = BOOKS.filter((b) => !b.hidden);

export default function HomeLanding() {
  const hijab = visibleBooks.find((b) => b.slug === "her-beautiful-hijab");
  return (
    <main className={styles.page}>
      <div className={styles.announce}>
        Free US shipping on storybooks · we ship worldwide
      </div>

      <section className={styles.keepHero}>
        <div className={styles.keepHeroText}>
          <p className={styles.kick}>As-salamu alaykum</p>
          <h1 className={styles.h1}>
            Their words. Your photos.
            <em> Kept forever.</em>
          </h1>
          <p className={styles.sub}>
            Turn the little things your family says, and the photos already on
            your phone, into a hardcover keepsake they will hold onto for life.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/shop/keepsakes" className={styles.cta}>
              Make a keepsake · from {HARDCOVER_PRICE_DISPLAY} →
            </Link>
            <Link href="/shop" className={styles.ctaGhost}>
              Shop everything
            </Link>
          </div>
        </div>
        <div className={styles.keepHeroImg}>
          <Image
            src="/images/home/keepsake-hero.jpg"
            alt="A hardcover 'Everything I Love About Mama' photo keepsake"
            width={1100}
            height={1100}
            priority
          />
        </div>
      </section>

      {hijab && (
        <section className={styles.storyIntro} id="try-it">
          <p className={styles.eyebrow}>Or, a story with their name in it</p>
          <h2 className={styles.h2}>
            Their name. Their story.
            <em> Kept for life.</em>
          </h2>
          <p className={styles.sub}>
            Type her name and watch her book cover come to life. The real
            preview, not a mock-up.
          </p>
          <Personalizer />
          <div className={styles.tryCtas}>
            <Link href={`/books/${hijab.slug}`} className={styles.tryLink}>
              Make it a real book · from {bookPriceDisplay(hijab.slug)} →
            </Link>
          </div>
        </section>
      )}

      <section className={styles.worlds} aria-label="Our collections">
        <Link href="/books" className={`${styles.world} ${styles.wBooks}`}>
          <Image
            src="/images/worlds/storybooks.jpg"
            alt=""
            width={220}
            height={260}
            className={styles.worldImg}
          />
          <div className={styles.worldBody}>
            <h3>Storybooks</h3>
            <p>
              Hand-illustrated Islamic stories, one of them starring your
              child.
            </p>
            <span className={styles.worldCta}>Browse the shelf →</span>
          </div>
        </Link>

        <Link href="/journal" className={`${styles.world} ${styles.wJournal}`}>
          <Image
            src="/images/worlds/journal.jpg"
            alt=""
            width={220}
            height={260}
            className={styles.worldImg}
          />
          <div className={styles.worldBody}>
            <h3>From One Root</h3>
            <p>
              The 30-day Qur&#39;an journal. One Arabic root a day, traced to
              its source, every one cited.
            </p>
            <span className={styles.worldCta}>Open the journal →</span>
          </div>
        </Link>

        <Link
          href="/digital-cards"
          className={`${styles.world} ${styles.wCards}`}
        >
          <Image
            src="/images/worlds/cards-v2.jpg"
            alt=""
            width={220}
            height={260}
            className={styles.worldImg}
          />
          <div className={styles.worldBody}>
            <h3>Digital cards</h3>
            <p>
              A beautiful animated card with a real voice note inside. Made
              and sent in minutes, anywhere on earth.
            </p>
            <span className={styles.worldCta}>Send one tonight →</span>
          </div>
        </Link>

        <Link
          href="/shop/keepsakes"
          className={`${styles.world} ${styles.wKeeps}`}
        >
          <Image
            src="/images/worlds/keepsakes.jpg"
            alt=""
            width={220}
            height={260}
            className={styles.worldImg}
          />
          <div className={styles.worldBody}>
            <h3>Photo keepsakes</h3>
            <p>
              Hardcover books of your own photos and lovingly written words,
              for the people you love most.
            </p>
            <span className={styles.worldCta}>Choose your person →</span>
          </div>
        </Link>
      </section>

      <section className={styles.proof}>
        <div>
          <b>100%</b>
          <span>sources cited</span>
        </div>
        <div>
          <b>1&#8211;3 days</b>
          <span>printed to order</span>
        </div>
        <div>
          <b>Worldwide</b>
          <span>we ship</span>
        </div>
      </section>

      <TrustLayer />

      <p className={styles.shipNote}>
        Printed to order in 1&#8211;3 business days. US delivery 5&#8211;10
        days, international 10&#8211;21 days. Digital cards and the journal
        arrive instantly.
      </p>
    </main>
  );
}
