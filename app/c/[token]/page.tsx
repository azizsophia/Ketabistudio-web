import type { Metadata } from "next";
import Link from "next/link";
import { findCard } from "@/lib/cards";
import DigitalCardViewer, {
  type DigitalCardView,
} from "@/components/cards/DigitalCardViewer";
import styles from "./view.module.css";

export const metadata: Metadata = {
  title: "A card for you",
  robots: { index: false, follow: false },
};

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

/* A self-contained sample so /c/demo always shows the experience — useful as a
   "see a sample" link and never depends on the database. */
const DEMO: DigitalCardView = {
  itemId: "eid",
  accent: "#1f6b5a",
  message:
    "Wishing you and your family a joyful and blessed Eid. May your home be filled with light, laughter and barakah, today and always.",
  sender: "With love, the Ketabi family",
  recipientName: "Friend",
  photoUrl: undefined,
};

async function fetchCard(token: string): Promise<DigitalCardView | null> {
  if (token === "demo") return DEMO;
  if (!SB || !KEY) return null;
  const safe = encodeURIComponent(token);
  const r = await fetch(
    `${SB}/rest/v1/digital_card_orders?token=eq.${safe}&status=eq.paid&select=item_id,accent,message,sender,recipient_name,photo_url&limit=1`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY }, cache: "no-store" }
  );
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    itemId: String(row.item_id),
    accent: String(row.accent || findCard(String(row.item_id)).color),
    message: String(row.message || ""),
    sender: String(row.sender || ""),
    recipientName: String(row.recipient_name || ""),
    photoUrl: row.photo_url ? String(row.photo_url) : undefined,
  };
}

export default async function CardViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ theme?: string; scheme?: string }>;
}) {
  const { token } = await params;
  const { theme, scheme } = await searchParams;
  const card = await fetchCard(token);

  if (!card) {
    return (
      <div className={styles.missing}>
        <div className={styles.missingInner}>
          <p className={styles.missingMark} aria-hidden="true">☾</p>
          <h1 className={styles.missingTitle}>This card isn&apos;t ready yet</h1>
          <p className={styles.missingText}>
            The link may be incomplete, or the card hasn&apos;t been sent yet.
            Please check the link, or ask the sender to share it again.
          </p>
          <Link href="/digital-cards" className={styles.missingCta}>
            Make a card of your own →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DigitalCardViewer
      {...card}
      theme={theme || card.theme}
      scheme={scheme || card.scheme}
    />
  );
}
