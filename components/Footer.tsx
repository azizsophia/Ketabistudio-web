import Link from "next/link";
import Image from "next/image";
import styles from "./Footer.module.css";

/* Brand-only footer — no location or personal details, ever. */

export default function Footer() {
  const year = 2026; // static: Date.now() is unavailable in this runtime
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Image
          src="/images/icon-cream.png"
          alt="Ketabi Studio"
          width={52}
          height={52}
          className={styles.brandMark}
        />
        <p className={`arabic ${styles.bismillah}`}>الْحَمْدُ لِلّٰهِ</p>

        <div className={styles.cols}>
          <div>
            <h4>Shop</h4>
            <Link href="/shop/keepsakes">Photo keepsakes</Link>
            <Link href="/books">Storybooks</Link>
            <Link href="/journal">The journal</Link>
            <Link href="/digital-cards">Digital cards</Link>
          </div>
          <div>
            <h4>Studio</h4>
            <Link href="/about">About</Link>
            <Link href="/app">Our app</Link>
            <Link href="/support">Support us</Link>
            <a href="mailto:ketabistudio@gmail.com">Contact</a>
          </div>
          <div>
            <h4>Gifts</h4>
            <Link href="/gifts/eid-gifts">Eid gifts</Link>
            <Link href="/gifts/gifts-for-muslim-mom">For Mama</Link>
            <Link href="/gifts/gifts-for-baba">For Baba</Link>
            <Link href="/gifts/new-baby-gifts">New baby</Link>
          </div>
          <div>
            <h4>Help</h4>
            <Link href="/refund-policy">Shipping &amp; returns</Link>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>

        <div className={styles.social}>
          <a href="https://www.tiktok.com/@ketabi.studio" target="_blank" rel="noreferrer">
            TikTok
          </a>
          <a href="https://www.youtube.com/@KetabiStudio" target="_blank" rel="noreferrer">
            YouTube
          </a>
        </div>

        <p className={styles.legal}>
          © {year} Ketabi Studio · Made to be kept · We ship worldwide
        </p>
      </div>
    </footer>
  );
}
