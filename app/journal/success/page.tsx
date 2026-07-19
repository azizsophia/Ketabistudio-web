import Link from "next/link";
import Stripe from "stripe";
import styles from "./success.module.css";

/* Post-payment landing for the journal. Verifies the buyer's session
   server-side, then hands them their download immediately. The same link is
   emailed by the webhook, so losing this tab loses nothing. */

export const dynamic = "force-dynamic";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");

async function verify(sid: string) {
  if (!STRIPE_KEY || !/^cs_[a-zA-Z0-9_]+$/.test(sid)) return null;
  try {
    const stripe = new Stripe(STRIPE_KEY);
    const s = await stripe.checkout.sessions.retrieve(sid);
    if (s.payment_status === "paid" && s.metadata?.kind === "journal") return s;
  } catch {
    /* fall through */
  }
  return null;
}

export default async function JournalSuccess({
  searchParams,
}: {
  searchParams: Promise<{ sid?: string }>;
}) {
  const { sid = "" } = await searchParams;
  const session = await verify(sid);

  if (!session) {
    return (
      <main className={styles.wrap}>
        <h1 className={styles.h1}>We could not verify this purchase</h1>
        <p className={styles.p}>
          If you just paid, give it a few seconds and refresh this page. If the
          problem stays, email us and we will make it right:&nbsp;
          <a href="mailto:ketabistudio@gmail.com">ketabistudio@gmail.com</a>
        </p>
        <Link href="/journal" className={styles.ghost}>
          Back to the journal →
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <p className={styles.kick}>Jazakum Allahu khayran</p>
      <h1 className={styles.h1}>Your journal is ready.</h1>
      <p className={styles.p}>
        From One Root, all sixty-eight pages, is yours. Download it below,
        print it, or keep it on your phone. We also emailed this link to you,
        so you can come back to it anytime.
      </p>
      <a
        href={`/api/journal/download?sid=${encodeURIComponent(sid)}`}
        className={styles.cta}
      >
        Download your journal (PDF) →
      </a>
      <p className={styles.note}>
        May it bring you closer to every word you already say in prayer.
      </p>
      <Link href="/shop" className={styles.ghost}>
        See everything we make →
      </Link>
    </main>
  );
}
