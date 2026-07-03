/* One-time OAuth landing for connecting the Pinterest auto-poster.
   Pinterest redirects here after the owner approves; we simply surface the
   `code` so it can be exchanged for an access token. Public + allowlisted in
   middleware so the coming-soon gate doesn't strip the query string. No secret
   ever touches this page. */
export const dynamic = "force-dynamic";

export default async function PinterestCallback({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; state?: string; error?: string }>;
}) {
  const { code, state, error } = await searchParams;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        background: "#f6f1e9",
        color: "#2b2622",
      }}
    >
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        {error ? (
          <>
            <h1 style={{ fontSize: 22 }}>Pinterest returned an error</h1>
            <p style={{ marginTop: 12 }}>{error}</p>
            <p style={{ marginTop: 12, color: "#6b5f4e" }}>
              Please try the approval link again.
            </p>
          </>
        ) : code ? (
          <>
            <h1 style={{ fontSize: 22 }}>You&apos;re connected ✓</h1>
            <p style={{ marginTop: 12, color: "#6b5f4e" }}>
              Copy the whole code below and send it back in your chat.
            </p>
            <textarea
              readOnly
              value={code}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 14,
                fontSize: 15,
                fontFamily: "ui-monospace, monospace",
                borderRadius: 10,
                border: "1px solid #cdbf9f",
                background: "#fffdf8",
                wordBreak: "break-all",
                minHeight: 90,
              }}
            />
            {state ? (
              <p style={{ marginTop: 10, fontSize: 12, color: "#968d80" }}>
                state: {state}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22 }}>Nothing to show yet</h1>
            <p style={{ marginTop: 12, color: "#6b5f4e" }}>
              Open this page from the Pinterest approval link and the code will
              appear here.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
