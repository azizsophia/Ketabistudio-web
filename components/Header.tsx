import Link from "next/link";
import Image from "next/image";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <Image src="/icon.png" alt="" width={38} height={38} className={styles.kaf} />
          <span className={styles.name}>Ketabi Studio</span>
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <Link href="/#learn">Watch</Link>
          <Link href="/#books">Books</Link>
          <Link href="/#app">App</Link>
          <Link href="/#kids">Kids Corner</Link>
          <Link href="/about">About</Link>
        </nav>
        <Link href="/#books" className={`btn btn-primary ${styles.cta}`}>
          Shop books
        </Link>
      </div>
    </header>
  );
}
