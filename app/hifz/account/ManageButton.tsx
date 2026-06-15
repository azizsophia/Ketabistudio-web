"use client";

import { useState } from "react";

export default function ManageButton({ hasCustomer }: { hasCustomer: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/hifz/portal", { method: "POST" });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.error || "Could not open billing portal.");
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasCustomer) return null;

  return (
    <>
      <button className="btn btn-primary" onClick={open} disabled={loading}>
        {loading ? "Opening…" : "Manage subscription"}
      </button>
      {error && (
        <p style={{ color: "var(--gold-deep)", fontSize: "0.88rem", width: "100%" }}>
          {error}
        </p>
      )}
    </>
  );
}
