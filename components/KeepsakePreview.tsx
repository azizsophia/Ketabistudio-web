import KeepsakeFlipbook from "./KeepsakeFlipbook";
import styles from "./KeepsakePreview.module.css";

/** Storefront preview: flip through every page of the keepsake's design before
 *  making one. Pages are the committed web previews in
 *  /public/images/keepsake/<slug>/ (cover + page01..24). */
export default function KeepsakePreview({
  slug,
  title,
  subtitle,
}: {
  slug: string;
  title: string;
  subtitle: string;
}) {
  const pages = [
    `/images/keepsake/${slug}/cover.jpg`,
    ...Array.from(
      { length: 24 },
      (_, i) => `/images/keepsake/${slug}/page${String(i + 1).padStart(2, "0")}.jpg`
    ),
  ];
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>A Ketabi keepsake</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>
        <KeepsakeFlipbook pages={pages} />
        <p className={styles.scroll}>Make yours below ↓</p>
      </div>
    </section>
  );
}
