import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Shipping & Returns",
};

export default function RefundPolicy() {
  return (
    <div className={`wrap ${styles.page}`}>
      <p className="eyebrow">Legal</p>
      <h1 className={styles.h1}>Shipping &amp; Returns</h1>
      <p className={styles.updated}>Last updated June 11, 2026</p>

      <h2 className={styles.h2}>Printed to order</h2>
      <p>
        Every Ketabi Studio book is personalized and printed individually
        for each order through our print partner. Because each book is made
        uniquely for your child, we begin production once payment is
        received and your order has been reviewed.
      </p>

      <h2 className={styles.h2}>Production and review</h2>
      <p>
        After you pay, we generate your book and review it by hand before it
        is sent to print. This review step is why our books arrive correct.
        Production and review typically take one to three business days
        before your book is handed to the printer.
      </p>

      <h2 className={styles.h2}>Shipping times</h2>
      <p>
        Once printed, books are shipped directly from the printing facility.
        Estimated delivery after production:
      </p>
      <p>
        United States: typically 5 to 10 business days.
        <br />
        International: typically 10 to 21 business days, depending on
        destination and customs.
      </p>
      <p>
        Shipping is charged separately at checkout: a flat rate for domestic
        orders and a flat international rate for orders outside the United
        States. International customers are responsible for any customs
        duties or import taxes levied by their country.
      </p>

      <h2 className={styles.h2}>If something is wrong with your book</h2>
      <p>
        We stand behind every book. If your book arrives with a printing
        defect, a manufacturing error, or damage in transit, contact us
        within 30 days of delivery with a photo and your order number, and
        we will reprint and reship it at no cost to you.
      </p>

      <h2 className={styles.h2}>Personalized items and cancellations</h2>
      <p>
        Because each book is personalized and printed to order, we cannot
        accept returns or offer refunds for buyer error, such as a misspelled
        name or an unintended character selection, once production has begun.
        Please review your personalization carefully on the preview before
        paying.
      </p>
      <p>
        If you need to correct or cancel an order, contact us as soon as
        possible. If we have not yet sent your book to print, we will gladly
        correct it or cancel and refund it in full.
      </p>

      <h2 className={styles.h2}>Refunds</h2>
      <p>
        Approved refunds are issued to your original payment method. Once
        processed, refunds typically appear within 5 to 10 business days
        depending on your bank or card issuer.
      </p>

      <h2 className={styles.h2}>Contact</h2>
      <p>
        For any order issue, email{" "}
        <a className={styles.link} href="mailto:ketabistudio@gmail.com">
          ketabistudio@gmail.com
        </a>{" "}
        with your order number and we will help.
      </p>
    </div>
  );
}
