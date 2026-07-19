"use client";

import { useState } from "react";

/* Buy button for the journal — creates the Stripe session on our own API and
   sends the buyer straight to payment. No Etsy reroute (owner, 2026-07-19). */

export default function JournalBuy({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function buy() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/journal/checkout", { method: "POST" });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      setErr("Something went wrong. Please try again.");
    } catch {
      setErr("Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className={className} onClick={buy} disabled={busy}>
        {busy ? "One moment…" : children}
      </button>
      {err && <p role="alert" style={{ color: "#a05a44", marginTop: 8 }}>{err}</p>}
    </>
  );
}
