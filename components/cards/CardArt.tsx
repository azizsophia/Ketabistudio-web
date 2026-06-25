import type { CardItem } from "@/lib/cards";
import styles from "./CardArt.module.css";

/* Presentational card visuals shared by the digital card builder preview and
   the animated viewer (/c/[token]). Kept separate from the physical CardMaker
   so that flow is untouched. No hooks — usable from server or client. */

export function CardFront({
  card,
  accent,
  photoUrl,
}: {
  card: CardItem;
  accent: string;
  photoUrl?: string;
}) {
  const big = card.group === "occasion" ? card.words[0]?.ar : card.word.ar;
  const translit =
    card.group === "occasion" ? card.words[0]?.translit : card.word.translit;
  const line2 = card.group === "occasion" ? card.en : card.headlineEn;
  const type = (
    <div className={styles.pfType}>
      <span className={styles.pfEyebrow}>{card.eyebrow.toUpperCase()}</span>
      <span className={styles.pfBig} dir="rtl" lang="ar">
        {big}
      </span>
      {translit && <span className={styles.pfTranslit}>{translit}</span>}
      <span className={styles.pfRule} aria-hidden="true" />
      <span className={styles.pfLine2}>{line2}</span>
    </div>
  );
  if (photoUrl) {
    return (
      <div
        className={`${styles.coverFront} ${styles.coverPhoto}`}
        style={{ backgroundImage: `url(${photoUrl})` }}
      >
        <div className={styles.photoScrim} />
        {type}
      </div>
    );
  }
  return (
    <div
      className={`${styles.coverFront} ${styles.coverSolid}`}
      style={{ backgroundColor: accent || "#1f6b5a" }}
    >
      {type}
    </div>
  );
}

export function CardInside({
  card,
  message,
  sender,
  recipientName,
  accent,
}: {
  card: CardItem;
  message: string;
  sender: string;
  recipientName: string;
  accent: string;
}) {
  const to = recipientName.trim();
  const msg = message.trim();
  return (
    <div className={styles.inside}>
      {to && <p className={styles.insideTo}>Dear {to},</p>}
      <p className={styles.insideMsg}>
        {msg || "Your message will appear here…"}
      </p>
      <span
        className={styles.insideRule}
        style={{ backgroundColor: accent || undefined }}
        aria-hidden="true"
      />
      <p className={styles.insideDua}>{card.dua}</p>
      {sender.trim() && <p className={styles.insideSender}>{sender.trim()}</p>}
    </div>
  );
}
