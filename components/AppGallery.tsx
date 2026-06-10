import Image from "next/image";
import styles from "./AppGallery.module.css";

const screens = [
  { src: "/images/app-adhkar-ar.jpg", label: "Recite with audio" },
  { src: "/images/app-adhkar.jpg", label: "Morning & evening adhkar" },
  { src: "/images/app-checkin.jpg", label: "Daily check-in" },
  { src: "/images/app-journal.jpg", label: "Quran journal" },
];

export default function AppGallery() {
  return (
    <div className={styles.gallery} role="group" aria-label="App screenshots — swipe to browse">
      {screens.map((s) => (
        <figure key={s.src} className={styles.frame}>
          <Image
            src={s.src}
            alt={s.label}
            width={560}
            height={1065}
            className={styles.shot}
          />
          <figcaption className={styles.caption}>{s.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
