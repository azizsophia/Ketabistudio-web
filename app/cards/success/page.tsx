import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CardSuccessPage({
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
          background: "var(--forest)",
          color: "var(--cream)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          fontWeight: 700,
          margin: "0 auto 24px",
        }}
      >
        ✓
      </div>
      <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--forest)", fontSize: "1.9rem", marginBottom: 12 }}>
        Payment received — thank you
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.6, marginBottom: 8 }}>
        Your card is being printed and will be posted directly to your
        recipient in a kraft envelope — blind and white-label, with no Ketabi
        invoice and zero printer branding. It simply arrives, beautifully,
        from you.
      </p>
      <p style={{ color: "var(--sage)", fontWeight: 600, fontSize: "0.9rem", marginBottom: 28 }}>
        Printed to order and delivered direct.
      </p>
      {shortId && (
        <p style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: "0.85rem", marginBottom: 28 }}>
          Order {shortId}
        </p>
      )}
      <Link href="/" className="btn btn-outline">
        Back to home
      </Link>
    </main>
  );
}
