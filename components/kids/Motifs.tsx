import styles from "@/app/kids/kids.module.css";

/** A four-point gold "sparkle" star. Purely decorative. */
function Star({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c.6 6.1 5.9 11.4 12 12-6.1.6-11.4 5.9-12 12-.6-6.1-5.9-11.4-12-12C6.1 11.4 11.4 6.1 12 0Z" />
    </svg>
  );
}

type Spot = {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  size: number;
  spin?: number;
  slow?: boolean;
};

const STARS: Spot[] = [
  { top: "14%", left: "6%", size: 26, spin: -12 },
  { top: "8%", right: "10%", size: 18, spin: 18, slow: true },
  { bottom: "18%", left: "12%", size: 16, spin: 8, slow: true },
  { top: "46%", right: "5%", size: 22, spin: -8 },
];

type BlobSpot = Spot & { color: string };

const BLOBS: BlobSpot[] = [
  { top: "20%", right: "16%", size: 120, color: "var(--sand)", slow: true },
  { bottom: "8%", left: "4%", size: 150, color: "rgba(88,180,173,0.16)" },
];

/** Floating, decorative cluster of gold stars + soft blobs (no moons). */
export default function Motifs() {
  return (
    <>
      {BLOBS.map((b, i) => (
        <span
          key={`blob-${i}`}
          aria-hidden="true"
          className={`${styles.motif} ${styles.blob} ${
            b.slow ? styles.floatSlow : styles.float
          }`}
          style={{
            top: b.top,
            bottom: b.bottom,
            left: b.left,
            right: b.right,
            width: b.size,
            height: b.size,
            background: b.color,
          }}
        />
      ))}
      {STARS.map((s, i) => (
        <span
          key={`star-${i}`}
          aria-hidden="true"
          className={`${styles.motif} ${styles.star} ${
            s.slow ? styles.floatSlow : styles.float
          }`}
          style={
            {
              top: s.top,
              bottom: s.bottom,
              left: s.left,
              right: s.right,
              "--spin": `${s.spin ?? 0}deg`,
            } as React.CSSProperties
          }
        >
          <Star size={s.size} />
        </span>
      ))}
    </>
  );
}
