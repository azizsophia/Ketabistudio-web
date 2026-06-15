import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.inner}`}>
        <p className={`arabic ${styles.bismillah}`}>
          الْحَمْدُ لِلّٰهِ
        </p>
        <nav className={styles.links} aria-label="Footer">
          <Link href="/#watch">Watch</Link>
          <Link href="/books">Children's books</Link>
          <Link href="/kids">Kids Corner</Link>
          <Link href="/cards">Cards</Link>
          <Link href="/app">App</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund-policy">Shipping &amp; Returns</Link>
        </nav>
        <div className={styles.social}>
          <a
            href="https://www.tiktok.com/@ketabi.studio"
            target="_blank"
            rel="noopener noreferrer"
          >
            TikTok
          </a>
          <a
            href="https://www.youtube.com/@KetabiStudio"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube
          </a>
          <a href="mailto:ketabistudio@gmail.com">Contact</a>
        </div>
        <p className={styles.legal}>
          © {new Date().getFullYear()} Ketabi Studio. Made with intention.
        </p>
      </div>
    </footer>
  );
}
