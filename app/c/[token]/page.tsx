import type { Metadata } from "next";
import Link from "next/link";
import { findCard } from "@/lib/cards";
import { cardHeadline } from "@/lib/digitalCard";
import DigitalCardViewer, {
  type DigitalCardView,
} from "@/components/cards/DigitalCardViewer";
import styles from "./view.module.css";

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
    `${SB}/rest/v1/digital_card_orders?token=eq.${safe}&status=eq.paid&select=item_id,accent,theme,scheme,message,sender,recipient_name,photo_url&limit=1`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY }, cache: "no-store" }
  );
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    itemId: String(row.item_id),
    accent: String(row.accent || findCard(String(row.item_id)).color),
    theme: row.theme ? String(row.theme) : undefined,
    scheme: row.scheme ? String(row.scheme) : undefined,
    message: String(row.message || ""),
    sender: String(row.sender || ""),
    recipientName: String(row.recipient_name || ""),
    photoUrl: row.photo_url ? String(row.photo_url) : undefined,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const card = await fetchCard(token);
  const title = card
    ? cardHeadline(card.itemId, card.recipientName)
    : "A card for you 🌙";
  const description =
    "Someone sent you a personalized card from Ketabi Studio. Tap to open it.";

  return {
    title,
    description,
    // Private links: shareable by anyone who has them, but never indexed.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Ketabi Studio",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
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
      token={token}
      theme={theme || card.theme}
      scheme={scheme || card.scheme}
    />
  );
}
