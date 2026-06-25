import type { Metadata } from "next";
import Link from "next/link";
import styles from "../success/success.module.css";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: { index: false, follow: false },
};

export default function DigitalCardCancelled() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>No worries</h1>
        <p className={styles.lede}>
          Your card wasn&apos;t purchased and you weren&apos;t charged. Your
          design is still here whenever you&apos;d like to finish.
        </p>
        <div className={styles.actions}>
          <Link href="/digital-cards" className="btn btn-primary">
            Back to your card
          </Link>
        </div>
      </div>
    </div>
  );
}
