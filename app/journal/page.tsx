import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import styles from "./journal.module.css";

export const metadata: Metadata = {
  title: "From One Root, the 30-day Qur'an journal",
  description:
    "A living dictionary of the Qur'an. Thirty days, one Arabic root a day, traced to its source and cited like scholarship, with room to write. Made to be kept.",
};

const ETSY = "https://ketabistudio.etsy.com";

/* A single "living dictionary" entry, built in HTML so it stays crisp and
   responsive. Arabic renders right-to-left; the letter labels sit under each
   letter in reading order. Every claim is the kind sourced in the journal. */
function RootCard() {
  return (
    <figure className={styles.card}>
      <div className={styles.cardHead}>
        <span>KETABI · A LIVING DICTIONARY</span>
        <span>N.º 01</span>
      </div>

      <div className={styles.rootRow} dir="rtl" aria-label="The root ra ha mim">
        <span className={styles.glyph}>
          ر<i>R</i>
        </span>
        <span className={styles.glyph}>
          ح<i>H</i>
        </span>
        <span className={styles.glyph}>
          م<i>M</i>
        </span>
      </div>

      <p className={styles.meanings}>
        <span>1. mercy</span>
        <span>2. the womb</span>
      </p>

      <ul className={styles.tree}>
        <li>
          <b>rahma</b>
          <span>mercy</span>
        </li>
        <li>
          <b>rahim</b>
          <span>the womb</span>
        </li>
        <li>
          <b>ar-Rahman</b>
          <span>the Most Merciful</span>
        </li>
      </ul>

      <figcaption className={styles.cardLine}>
        Mercy and the womb are the same three letters. Your first home was named
        after His mercy.
      </figcaption>
      <p className={styles.cardCite}>
        Qur&apos;an 7:156 · classical dictionaries of Arabic
      </p>
    </figure>
  );
}

const ROOTS = [
  {
    ar: "صبر",
    word: "sabr",
    gloss: "to hold in place",
    body: "Sabr is not gritting your teeth until it passes. Its root means to hold, to restrain, to keep something where it belongs. Patience is the strength that keeps you standing where you are meant to stand while the storm argues with you.",
  },
  {
    ar: "فطر",
    word: "fitra",
    gloss: "to split open",
    body: "Fitra is usually translated as your natural disposition. The root, fatara, means to split open, the way dawn splits the night. Your faith is not something you install. It is something you were made with, and keep returning to.",
  },
  {
    ar: "برك",
    word: "barakah",
    gloss: "to kneel and stay",
    body: "The picture behind barakah is a camel kneeling down to stay. Barakah is not more. It is what makes the little you have settle, and stretch further than it should. Some homes have less and hold more. Now you have the word for why.",
  },
];

export default function JournalPage() {
  return (
    <div className={styles.page}>
      {/* ── hero ── */}
      <section className={styles.hero}>
        <p className={styles.kick}>The Ketabi journal</p>
        <h1 className={styles.h1}>
          Every word
          <br />
          has a root.
        </h1>
        <p className={styles.lede}>
          We trace the words of the Qur&apos;an back to where they begin.
          Verified against the classical dictionaries. Every source cited. Yours
          to keep.
        </p>
      </section>

      {/* ── the living dictionary card ── */}
      <section className={styles.showcase}>
        <RootCard />
      </section>

      {/* ── the essay (explain it, Substack-deep) ── */}
      <section className={styles.essay}>
        <p className={styles.dropLead}>
          Most Islamic quote accounts hand you a feeling. We wanted to hand you a
          reference.
        </p>
        <p>
          Arabic is built on roots. Almost every word grows from three letters,
          and once you know the root, the word opens. It stops being a term you
          memorized and becomes a picture you can see. You stop reading over the
          Qur&apos;an and start reading into it.
        </p>
        <p>
          Take the one above. The word for mercy, <em>rahma</em>, and the word
          for the womb, <em>rahim</em>, are the same three letters. The place you
          were first held and the mercy of the One who made you are, quite
          literally, spelled the same. You do not forget a verse about mercy
          again once you have seen that.
        </p>

        <div className={styles.roots}>
          {ROOTS.map((r) => (
            <div key={r.word} className={styles.rootBlock}>
              <p className={styles.rootWord}>
                <span className={styles.rootAr} lang="ar">
                  {r.ar}
                </span>
                <span className={styles.rootName}>{r.word}</span>
                <span className={styles.rootGloss}>{r.gloss}</span>
              </p>
              <p className={styles.rootBody}>{r.body}</p>
            </div>
          ))}
        </div>

        <p>
          None of this is invented. Every meaning is traced to the classical
          dictionaries of Arabic and the verse where the word lives, and the
          source is printed right there on the page. This is the part no pretty
          graphic gives you: the receipts.
        </p>
      </section>

      {/* ── the product ── */}
      <section className={styles.product}>
        <div className={styles.productArt}>
          <Image
            src="/images/journal-from-one-root.jpg"
            alt="From One Root, the 30-day Qur'an journal"
            width={520}
            height={640}
            className={styles.productImg}
          />
        </div>
        <div className={styles.productBody}>
          <p className={styles.kickRust}>From One Root</p>
          <h2 className={styles.h2}>Thirty days. One root a day.</h2>
          <p className={styles.productLede}>
            One Arabic root a day, traced to its source, with room to write. A
            quiet study of the language your prayers are already made of.
          </p>
          <ul className={styles.spec}>
            <li>30 roots</li>
            <li>Every source cited</li>
            <li>A page to reflect on each</li>
            <li>Instant digital download</li>
          </ul>
          <a href={ETSY} target="_blank" rel="noreferrer" className={styles.buy}>
            Get it on Etsy →
          </a>
          <p className={styles.buyNote}>
            Instant download. Print it, or keep it on your phone.
          </p>
        </div>
      </section>

      {/* ── why it is different ── */}
      <section className={styles.why}>
        <span className="divider" aria-hidden="true">
          <span />
        </span>
        <p className={styles.whyLine}>
          Not another quote on a pretty background. A reference you will keep,
          sourced like scholarship, made to be read slowly and returned to.
        </p>
        <Link href="/shop" className={styles.whyLink}>
          See everything we make →
        </Link>
      </section>
    </div>
  );
}
