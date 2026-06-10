import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "About",
  description:
    "Ketabi Studio — personalized Islamic storybooks and the Ketabi app, made with intention.",
};

export default function About() {
  return (
    <div className={`wrap ${styles.page}`}>
      <p className="eyebrow">About</p>
      <h1 className={styles.h1}>Ketabi Studio</h1>
      <p className={styles.updated}>
        Stories and tools that help little hearts grow.
      </p>

      <h2 className={styles.h2}>Our Mission</h2>
      <p>
        We believe spiritual growth should be beautiful, seamless, and deeply
        woven into daily life. Ketabi (meaning &ldquo;My Book&rdquo; in Arabic)
        began as a daily companion app — a private space to track your
        prayers, maintain your daily Adhkar, and reflect on your spiritual
        journey — and has grown into a studio crafting personalized Islamic
        storybooks for children.
      </p>

      <h2 className={styles.h2}>Design Philosophy</h2>
      <p>
        We design with intent. Every book and every screen embraces a calming
        aesthetic, focusing on authentic sources, gentle storytelling, and the
        intrinsic reward of remembering Allah.
      </p>

      <h2 className={styles.h2}>The Ketabi App</h2>
      <p>
        Ketabi is built by an independent designer dedicated to keeping your
        spiritual space ad-free and distraction-free. Your data is stored
        securely with enterprise-grade encryption, and your prayers, journals,
        and reflections remain exclusively yours.
      </p>

      <h2 className={styles.h2}>Support &amp; Contact</h2>
      <p>
        For app support, questions about an order, or anything else, reach us
        at{" "}
        <a className={styles.link} href="mailto:ketabistudio@gmail.com">
          ketabistudio@gmail.com
        </a>
        . We read everything.
      </p>
    </div>
  );
}
