import type { Metadata } from "next";
import Link from "next/link";
import styles from "../shop.module.css";

export const metadata: Metadata = {
  title: "Children's Play Mats — coming soon",
  description:
    "Beautiful, soft children's play mats — thoughtfully designed. Arriving soon, Inshallah.",
};

export default function PlayMatsPage() {
  return (
    <div className={styles.shop}>
      <header className={styles.hero}>
        <p className="eyebrow">Children's Play Mats</p>
        <h1 className={styles.h1}>Arriving soon, Inshallah.</h1>
        <p className={`lede ${styles.lede}`}>
          We're putting the finishing touches on a line of beautiful, soft play
          mats for little ones — made with the same care as everything else we
          do. Check back soon.
        </p>
        <p style={{ marginTop: 28 }}>
          <Link href="/shop" className="btn btn-primary">
            Back to the shop
          </Link>
        </p>
      </header>
    </div>
  );
}
