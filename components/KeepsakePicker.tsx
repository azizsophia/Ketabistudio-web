"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import FlipBook from "./FlipBook";
import { PHOTOBOOK_TEMPLATES, type PhotobookSlug } from "@/lib/photobook";
import styles from "./KeepsakePicker.module.css";

/* "Choose your person" picker. Instead of stacking all seven keepsakes down a
   14,000px page, the shopper taps a person and only that book unfolds. Calmer,
   faster to the decision, and far friendlier on a phone. */

type Person = { slug: PhotobookSlug; who: string };

const PEOPLE: Person[] = [
  { slug: "about-mama", who: "Mama" },
  { slug: "about-baba", who: "Baba" },
  { slug: "about-grandma", who: "Grandma" },
  { slug: "about-grandpa", who: "Grandpa" },
  { slug: "about-spouse", who: "Spouse" },
  { slug: "about-baby", who: "Baby" },
  { slug: "our-ramadan", who: "Ramadan" },
];

export default function KeepsakePicker() {
  const [active, setActive] = useState<PhotobookSlug>("about-mama");
  const t = PHOTOBOOK_TEMPLATES[active];

  return (
    <div className={styles.wrap}>
      <p className={styles.pickLabel}>Who is it for?</p>
      <div className={styles.people} role="tablist" aria-label="Choose who the keepsake is for">
        {PEOPLE.map((p) => (
          <button
            key={p.slug}
            role="tab"
            aria-selected={active === p.slug}
            className={`${styles.person} ${active === p.slug ? styles.on : ""}`}
            onClick={() => setActive(p.slug)}
          >
            <span className={styles.thumb}>
              <Image
                src={`/images/keepsake/${p.slug}/cover.jpg`}
                alt=""
                width={140}
                height={140}
                className={styles.thumbImg}
              />
            </span>
            <span className={styles.who}>{p.who}</span>
          </button>
        ))}
      </div>

      <div className={styles.stage} key={active}>
        <FlipBook
          cover={`/images/keepsake/${active}/cover.jpg`}
          title={t.title}
          pages={[
            { src: `/images/keepsake/${active}/page02.jpg` },
            { src: `/images/keepsake/${active}/page06.jpg` },
            { src: `/images/keepsake/${active}/page10.jpg` },
            { src: `/images/keepsake/${active}/page14.jpg` },
            { src: `/images/keepsake/${active}/page18.jpg` },
            { src: `/images/keepsake/${active}/page23.jpg` },
          ]}
          stage="charcoal"
          eyebrow="Real pages from the book"
          caption="This is the layout you'll get. Your photos go in, your words too, sealed with a dua"
        />

        <div className={styles.detail}>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.value}>{t.value}</p>
          <p className={styles.blurb}>{t.blurb}</p>
          <Link href={`/keepsakes/${active}`} className={styles.cta}>
            Make this keepsake →
          </Link>
          <p className={styles.ship}>
            Hardcover, made to order · we ship worldwide
          </p>
        </div>
      </div>
    </div>
  );
}
