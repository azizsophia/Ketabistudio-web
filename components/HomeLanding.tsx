import Link from "next/link";
import Image from "next/image";
import Personalizer from "./Personalizer";
import styles from "./HomeLanding.module.css";
import { BOOKS } from "@/lib/books";
import { bookPriceDisplay } from "@/lib/pricing";

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

      <section className={styles.hero}>
        <p className={styles.kick}>As-salamu alaykum</p>
        <h1 className={styles.h1}>
          Their name. Their story.
          <em> Kept for life.</em>
        </h1>
        <p className={styles.sub}>
          Personalized storybooks, a 30-day Qur&#39;an journal, digital cards
          and photo keepsakes. Every one carries a name you love.
        </p>
        <div className={styles.heroCtas}>
          <Link href="/shop" className={styles.cta}>
            Shop the collection
          </Link>
          <Link href="/books" className={styles.ctaGhost}>
            Storybooks
          </Link>
        </div>
      </section>

      {hijab && (
        <section className={styles.tryIt} id="try-it">
          <div className={styles.tryHead}>
            <h2>Watch her cover come to life</h2>
            <p>
              Type a name, pick her look. This is the real book preview, not a
              mock-up.
            </p>
          </div>
          <Personalizer />
          <Link
            href={`/books/${hijab.slug}`}
            className={styles.tryLink}
          >
            Make it a real book · {bookPriceDisplay(hijab.slug)} →
          </Link>
        </section>
      )}

      <section className={styles.worlds} aria-label="Our collections">
        <Link href="/books" className={`${styles.world} ${styles.wBooks}`}>
          <Image
            src="/images/shop/storybooks.jpg"
            alt=""
            width={220}
            height={260}
            className={styles.worldImg}
          />
          <div>
            <h3>Storybooks</h3>
            <p>
              Hand-illustrated Islamic stories, one of them starring your
              child.
            </p>
            <span className={styles.worldCta}>Browse the shelf →</span>
          </div>
        </Link>

        <a
          href="https://ketabistudio.etsy.com"
          target="_blank"
          rel="noreferrer"
          className={`${styles.world} ${styles.wJournal}`}
        >
          <Image
            src="/images/journal-from-one-root.jpg"
            alt=""
            width={220}
            height={260}
            className={styles.worldImg}
            style={{ objectPosition: "88% center" }}
          />
          <div>
            <h3>From One Root</h3>
            <p>
              The 30-day Qur&#39;an journal. One Arabic root a day, every
              source cited. On Etsy as an instant download.
            </p>
            <span className={styles.worldCta}>Start day one →</span>
          </div>
        </a>

        <Link
          href="/digital-cards"
          className={`${styles.world} ${styles.wCards}`}
        >
          <Image
            src="/images/shop/digital-cards.jpg"
            alt=""
            width={220}
            height={260}
            className={styles.worldImg}
          />
          <div>
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
            src="/images/shop/keepsakes.jpg"
            alt=""
            width={220}
            height={260}
            className={styles.worldImg}
          />
          <div>
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
          <b>1&#8211;3d</b>
          <span>print time</span>
        </div>
        <div>
          <b>🌍</b>
          <span>ships worldwide</span>
        </div>
      </section>

      <p className={styles.shipNote}>
        Printed to order in 1&#8211;3 business days. US delivery 5&#8211;10
        days, international 10&#8211;21 days. Digital cards and the journal
        arrive instantly.
      </p>
    </main>
  );
}
