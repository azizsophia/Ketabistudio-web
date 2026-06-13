"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { item: string; status: "PASS" | "FAIL"; detail: string };
type Report = {
  generated_at: number;
  items: Item[];
  summary: { pass: number; fail: number; result: "PASS" | "FAIL" };
};
type Data = { report: Report; sheets: { name: string; url: string }[] };

export default function QcPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("ketabi-admin-key");
    if (saved) {
      setKey(saved);
      setAuthed(true);
    }
  }, []);

  const load = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/qc", { headers: { "x-admin-key": key } });
      if (r.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem("ketabi-admin-key");
        setErr("Key rejected.");
        return;
      }
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Failed to load");
        return;
      }
      setData(j);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  if (!authed) {
    return (
      <div className="wrap" style={{ maxWidth: 420, padding: 24 }}>
        <h1>QC Review</h1>
        <p>Enter your admin key</p>
        <input
          type="password"
          value={pin}
          placeholder="Admin key"
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pin.trim()) {
              setKey(pin.trim());
              sessionStorage.setItem("ketabi-admin-key", pin.trim());
              setAuthed(true);
            }
          }}
          style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 8 }}
          autoFocus
        />
        {err && <p style={{ color: "#c0392b" }}>{err}</p>}
      </div>
    );
  }

  const fails = data?.report.items.filter((i) => i.status === "FAIL") ?? [];
  const sum = data?.report.summary;

  return (
    <div className="wrap" style={{ maxWidth: 760, padding: 16, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>QC Review</h1>
        <button onClick={load} disabled={loading} style={{ padding: "8px 14px" }}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {err && <p style={{ color: "#c0392b" }}>{err}</p>}

      {sum && (
        <div
          style={{
            margin: "14px 0",
            padding: 16,
            borderRadius: 12,
            background: sum.result === "PASS" ? "#e8f6ec" : "#fdeaea",
            border: `1px solid ${sum.result === "PASS" ? "#3aa55d" : "#c0392b"}`,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: sum.result === "PASS" ? "#2e7d46" : "#c0392b" }}>
            {sum.result === "PASS" ? "✅ All checks passed" : `⚠️ ${sum.fail} check(s) failed`}
          </div>
          <div style={{ color: "#555", marginTop: 4 }}>
            {sum.pass} passed · {sum.fail} failed ·{" "}
            {data && new Date(data.report.generated_at * 1000).toLocaleString()}
          </div>
        </div>
      )}

      {fails.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h3>Failures</h3>
          {fails.map((f) => (
            <div key={f.item} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <strong style={{ color: "#c0392b" }}>{f.item}</strong>
              <div style={{ fontSize: 13, color: "#666" }}>{f.detail}</div>
            </div>
          ))}
        </div>
      )}

      {(data?.sheets ?? []).map((s) => (
        <div key={s.name} style={{ margin: "18px 0" }}>
          <h3 style={{ fontSize: 15, color: "#555" }}>{s.name.replace(/^sheet_|\.jpg$/g, "").replace(/_/g, " ")}</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.url} alt={s.name} style={{ width: "100%", borderRadius: 10, border: "1px solid #e3e0d9" }} />
        </div>
      ))}

      {data && data.sheets.length === 0 && <p>No contact sheets in the report.</p>}
    </div>
  );
}
