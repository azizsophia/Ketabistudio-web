import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import CopyField from "@/components/cards/CopyField";
import PixelEvent from "@/components/PixelEvent";
import styles from "./success.module.css";

export const metadata: Metadata = {
  title: "Your card is ready",
  robots: { index: false, follow: false },
};

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

async function fetchOrder(id: string) {
  if (!SB || !KEY) return null;
  const safe = encodeURIComponent(id);
  const r = await fetch(
    `${SB}/rest/v1/digital_card_orders?id=eq.${safe}&select=token,deliver_email,recipient_email,recipient_name,scheduled_at&limit=1`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY }, cache: "no-store" }
  );
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : null;
}

export default async function DigitalCardSuccess({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const order = id ? await fetchOrder(id) : null;

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_SITE_URL || "https://www.ketabistudio.com";

  const link = order?.token ? `${origin}/c/${order.token}` : "";

  return (
    <div className={styles.wrap}>
      <PixelEvent event="Purchase" id={id} />
      <div className={styles.card}>
        <div className={styles.check}>✓</div>
        <h1 className={styles.title}>Your card is ready</h1>

        {link ? (
          <>
            <p className={styles.lede}>
              Here&apos;s your private card link. Share it by text, WhatsApp, or
              anywhere you like. It opens to a beautiful animated card.
            </p>
            <CopyField url={link} recipientName={order.recipient_name} />

            {order?.deliver_email && order?.recipient_email && (
              <p className={styles.emailed}>
                {order.scheduled_at && new Date(order.scheduled_at) > new Date() ? (
                  <>
                    It will also be emailed to{" "}
                    <strong>{order.recipient_email}</strong> on{" "}
                    {new Date(order.scheduled_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                    })}
                    {order.recipient_name ? ` for ${order.recipient_name}` : ""}.
                  </>
                ) : (
                  <>
                    We&apos;ve also emailed it to{" "}
                    <strong>{order.recipient_email}</strong>
                    {order.recipient_name ? ` for ${order.recipient_name}` : ""}.
                  </>
                )}
              </p>
            )}

            <div className={styles.actions}>
              <Link href={`/c/${order.token}`} className="btn btn-primary">
                Preview your card
              </Link>
              <Link href="/digital-cards" className="btn btn-outline">
                Make another
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className={styles.lede}>
              Your payment is confirmed. If you don&apos;t see your card link,
              check your email for the receipt, or reply to it and we&apos;ll
              send your link right away.
            </p>
            <div className={styles.actions}>
              <Link href="/digital-cards" className="btn btn-primary">
                Make another card
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
