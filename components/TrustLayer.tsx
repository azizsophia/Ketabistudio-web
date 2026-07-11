"use client";

import { useState } from "react";
import styles from "./TrustLayer.module.css";

/* Brand-only trust layer — studio story, promise, and an FAQ accordion.
   No names, no location, no personal details. Reused on Home and shop pages. */

const FAQ = [
  {
    q: "How does personalization work?",
    a: "On a personalized book, you type the child's name and choose their look. We print a one-of-a-kind copy where they are the star, on the cover and inside. What you see in the live preview is what we print.",
  },
  {
    q: "How long does shipping take?",
    a: "Every book is printed to order in 1 to 3 business days, then shipped. US delivery is about 5 to 10 days, and international 10 to 21 days. Digital cards and the journal download arrive instantly.",
  },
  {
    q: "Do you ship worldwide?",
    a: "Yes. Physical books ship almost anywhere in the world. Digital cards and the journal are instant downloads, so they reach you anywhere with no shipping at all.",
  },
  {
    q: "Is everything authentic and sourced?",
    a: "Yes, and it matters to us more than anything. Every Arabic word, translation, and reference is checked against trusted sources before it is ever printed. Every root is verified, every source cited.",
  },
  {
    q: "What if something arrives damaged?",
    a: "Reach out with a photo and we will make it right with a reprint or a refund. Because each item is made to order, we handle these one to one, with care.",
  },
];

export default function TrustLayer() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className={styles.wrap} aria-label="About Ketabi and FAQ">
      <div className={styles.story}>
        <p className={styles.kick}>Our promise</p>
        <h2>Small studio. Serious care.</h2>
        <p className={styles.lead}>
          Ketabi is an independent studio making keepsakes for Muslim families:
          storybooks a child can star in, a journal that traces the Qur&#39;an one
          root at a time, and cards worth keeping. Everything is made to order,
          checked by hand, and printed only when it is right.
        </p>
        <ul className={styles.promises}>
          <li>
            <span className={styles.mark}>✓</span> Every root verified, every
            source cited
          </li>
          <li>
            <span className={styles.mark}>✓</span> Made to order, never mass
            printed
          </li>
          <li>
            <span className={styles.mark}>✓</span> Make-it-right guarantee on
            every order
          </li>
        </ul>
      </div>

      <div className={styles.faq}>
        <h3>Good to know</h3>
        {FAQ.map((item, i) => {
          const open = openIdx === i;
          return (
            <div key={item.q} className={styles.item}>
              <button
                className={styles.qBtn}
                aria-expanded={open}
                onClick={() => setOpenIdx(open ? null : i)}
              >
                <span>{item.q}</span>
                <span className={styles.plus} aria-hidden="true">
                  {open ? "–" : "+"}
                </span>
              </button>
              {open && <p className={styles.answer}>{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
