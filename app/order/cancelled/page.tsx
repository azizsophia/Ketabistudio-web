import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CancelledPage() {
  return (
    <main className="wrap" style={{ textAlign: "center", padding: "80px 24px", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--forest)", fontSize: "1.8rem", marginBottom: 12 }}>
        Checkout cancelled
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.6, marginBottom: 28 }}>
        No payment was taken. Your book design is safe. Head back to the
        book and you can pick up right where you left off.
      </p>
      <Link href="/books/her-beautiful-hijab" className="btn btn-primary">
        Return to the book
      </Link>
    </main>
  );
}
