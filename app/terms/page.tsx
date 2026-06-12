import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function Terms() {
  return (
    <div className={`wrap ${styles.page}`}>
      <p className="eyebrow">Legal</p>
      <h1 className={styles.h1}>Terms of Service</h1>
      <p className={styles.updated}>Last updated June 11, 2026</p>

      <h2 className={styles.h2}>Overview</h2>
      <p>
        These terms govern your purchase of personalized printed books from
        Ketabi Studio through this website. By placing an order, you agree to
        these terms. If you do not agree, please do not place an order.
      </p>

      <h2 className={styles.h2}>Orders and personalization</h2>
      <p>
        When you order a personalized book, you provide details such as a
        child&apos;s name and character appearance. You are responsible for
        the accuracy of what you enter. We print what you submit, so please
        check the preview carefully before paying. We reserve the right to
        decline or cancel any order, including orders containing content that
        is unlawful, offensive, or that infringes the rights of others.
      </p>

      <h2 className={styles.h2}>Pricing and payment</h2>
      <p>
        Prices are shown in US dollars. The book price and shipping are
        displayed before you pay. Payment is processed securely by Stripe; we
        do not store your card details. Your order is confirmed once payment
        is successfully completed, after which we begin production and our
        manual review.
      </p>

      <h2 className={styles.h2}>Shipping and returns</h2>
      <p>
        Shipping estimates, delivery, our reprint guarantee for defective
        books, and our policy on personalized items are described in our{" "}
        <a className={styles.link} href="/refund-policy">
          Shipping &amp; Returns policy
        </a>
        , which forms part of these terms.
      </p>

      <h2 className={styles.h2}>Intellectual property</h2>
      <p>
        All book content, illustrations, characters, text, and designs are
        the property of Ketabi Studio and are protected by copyright. Your
        purchase grants you a personal copy of the finished book for personal,
        non-commercial use. You may not reproduce, resell, or distribute the
        book content or illustrations.
      </p>

      <h2 className={styles.h2}>Limitation of liability</h2>
      <p>
        Our products are provided for personal enjoyment. To the fullest
        extent permitted by law, Ketabi Studio&apos;s total liability for any
        order is limited to the amount you paid for that order. We are not
        liable for indirect or consequential losses.
      </p>

      <h2 className={styles.h2}>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The version in effect at
        the time you place an order applies to that order.
      </p>

      <h2 className={styles.h2}>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a className={styles.link} href="mailto:ketabistudio@gmail.com">
          ketabistudio@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
