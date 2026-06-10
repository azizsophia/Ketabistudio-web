import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPolicy() {
  return (
    <div className={`wrap ${styles.page}`}>
      <p className="eyebrow">Legal</p>
      <h1 className={styles.h1}>Privacy Policy</h1>
      <p className={styles.updated}>Last updated May 6, 2026</p>

      <h2 className={styles.h2}>Introduction</h2>
      <p>
        At Ketabi Studio, we respect your privacy and are committed to
        protecting your personal data. This policy explains how we handle your
        information when you use Ketabi.
      </p>
      <p>
        Your spiritual journey is a deeply personal matter. We want to be
        completely transparent: while your data is securely stored in a cloud
        database to allow syncing across your devices, it remains entirely
        private to you.
      </p>

      <h2 className={styles.h2}>Data Collection &amp; Storage</h2>
      <p>
        We collect only the information necessary to provide the Ketabi
        experience: account data (encrypted email and password) via
        Authentication, and usage data (prayers logged, adhkar completions,
        journal entries).
      </p>
      <p>
        All user data is securely stored and encrypted at rest using Supabase,
        a trusted, industry-standard cloud provider. This ensures your data is
        protected against unauthorized access.
      </p>
      <p>
        We do not sell your personal data to third parties, advertising
        networks, or data brokers.
      </p>

      <h2 className={styles.h2}>Data Access &amp; Privacy</h2>
      <p>
        We want to be perfectly clear: we do not read your journal entries,
        prayer logs, or any personal spiritual reflections. Your data belongs
        to you.
      </p>
      <p>
        If you choose to delete your account, all associated personal data —
        including journal entries and prayer logs, will be permanently erased
        from our servers.
      </p>

      <h2 className={styles.h2}>Contact</h2>
      <p>
        For any questions regarding this policy, data deletion requests, or
        our privacy practices, please contact us directly at{" "}
        <a className={styles.link} href="mailto:ketabistudio@gmail.com">
          ketabistudio@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
