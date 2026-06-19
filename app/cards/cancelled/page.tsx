import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CardCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const shortId = id ? id.slice(0, 8) : null;

  return (
    <main className="wrap" style={{ textAlign: "center", padding: "80px 24px", maxWidth: 600, margin: "0 auto" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--cream)",
          color: "var(--forest)",
          border: "2px solid var(--forest)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          fontWeight: 700,
          margin: "0 auto 24px",
        }}
      >
        ×
      </div>
      <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--forest)", fontSize: "1.9rem", marginBottom: 12 }}>
        Payment cancelled
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.6, marginBottom: 28 }}>
        No worries, your card wasn&rsquo;t charged. Your design is safe, and you
        can pick up right where you left off whenever you&rsquo;re ready.
      </p>
      {shortId && (
        <p style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: "0.85rem", marginBottom: 28 }}>
          Order {shortId}
        </p>
      )}
      <Link href="/cards" className="btn btn-outline">
        Back to cards
      </Link>
    </main>
  );
}
