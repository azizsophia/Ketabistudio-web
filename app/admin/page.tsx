"use client";

import { useCallback, useEffect, useState } from "react";
import s from "./admin.module.css";

/* ── types ── */
type Order = {
  id: string;
  status: string;
  book_slug: string;
  child_name: string | null;
  skin: string | null;
  hair: string | null;
  hair_style: string | null;
  customer_email: string;
  shipping: Record<string, string> | null;
  interior_path: string | null;
  cover_path: string | null;
  qc_report: Record<string, unknown> | null;
  lulu_print_job_id: string | null;
  created_at: string;
  notes: string | null;
};

const SLUG_LABELS: Record<string, string> = {
  "her-beautiful-hijab": "Her Beautiful Hijab",
  "my-beautiful-duas": "My Beautiful Duas",
  "juha-and-the-enormous-pumpkin": "Juha and the Enormous Pumpkin",
  "maryam-is-kind-to-her-parents": "Maryam is Kind to Her Parents",
  "from-one-root-journal": "From One Root, 30-Day Journal (coil)",
};

const STATUS_ORDER = [
  "awaiting_approval",
  "pending",
  "generating",
  "qc_passed",
  "validated",
  "approved",
  "submitted",
  "printing",
  "shipped",
  "awaiting_payment",
  "payment_failed",
  "rejected",
  "failed",
];

function badgeClass(status: string) {
  if (status === "awaiting_approval") return s.badgeAwait;
  if (status === "pending" || status === "generating") return s.badgePending;
  if (status === "approved" || status === "submitted" || status === "shipped")
    return s.badgeApproved;
  if (status === "rejected" || status === "failed" || status === "payment_failed")
    return s.badgeFailed;
  if (status === "awaiting_payment") return s.badgeDefault;
  return s.badgeDefault;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtStatus(st: string) {
  return st.replace(/_/g, " ");
}

/* Statuses where a stored failure is still relevant. Once an order recovers
   (submitted/printing/shipped), an old traceback left in qc_report is stale —
   the worker stores it on a transient submit error but doesn't clear it after a
   later retry succeeds — so we only surface it while the order is actually stuck. */
const PROBLEM_STATUSES = new Set(["failed", "payment_failed", "rejected"]);

/* ── QC report renderer ── */
function QcBlock({
  report,
  status,
}: {
  report: Record<string, unknown>;
  status: string;
}) {
  const spec = report.spec as Record<string, unknown> | undefined;
  const refRaw = report.reference as Record<string, unknown> | undefined;
  const lulu = report.lulu as Record<string, string> | undefined;
  // Only show a stored traceback if the order is still in a failed state.
  const failure = PROBLEM_STATUSES.has(status)
    ? (report.failure as string | undefined)
    : undefined;

  // Only the Hijab book has pixel-diff reference entries ({match_dist,
  // wrong_dist}); Duas/fixed books use other shapes — filter to the real ones
  // so we never call .toFixed on a non-number and crash the page.
  const matches = (
    refRaw && typeof refRaw === "object"
      ? Object.entries(refRaw).filter(
          ([, v]) =>
            v &&
            typeof v === "object" &&
            typeof (v as { match_dist?: number }).match_dist === "number"
        )
      : []
  ) as [string, { match_dist: number; wrong_dist: number }][];

  return (
    <div className={s.qc}>
      {spec && (
        <>
          <span className={s.qcOk}>Spec passed</span> ·{" "}
          {String(spec.interior_pages)} pages ·{" "}
          {spec.blank_scan === "ok" ? "No blanks" : "Blank warning"}
          <br />
        </>
      )}
      {matches.length > 0 && (
        <>
          Reference match:{" "}
          {matches.map(([k, v]) => (
            <span key={k}>
              {k}={v.match_dist.toFixed(1)}{" "}
              <span className={s.qcOk}>(ok, wrong={v.wrong_dist.toFixed(0)})</span>{" "}
            </span>
          ))}
          <br />
        </>
      )}
      {lulu && (
        <>
          Lulu:{" "}
          <span className={s.qcOk}>
            interior {lulu.interior}, cover {lulu.cover}
          </span>
        </>
      )}
      {failure && (
        <div className={s.failDetail}>
          {String(failure).slice(0, 500)}
        </div>
      )}
    </div>
  );
}

/* ── component ── */
export default function AdminDashboard() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [digestUrls, setDigestUrls] = useState<Record<string, string>>({});

  /* restore session */
  useEffect(() => {
    const saved = sessionStorage.getItem("ketabi-admin-key");
    if (saved) {
      setKey(saved);
      setAuthed(true);
    }
  }, []);

  /* fetch orders */
  const load = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/orders", {
        headers: { "x-admin-key": key },
      });
      if (r.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem("ketabi-admin-key");
        setPinErr("Key rejected. Try again.");
        return;
      }
      const data = await r.json();
      if (Array.isArray(data)) setOrders(data);
    } catch {
      setToast("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  /* load digest images for awaiting_approval orders */
  useEffect(() => {
    if (!authed || !key) return;
    orders
      .filter((o) => o.status === "awaiting_approval" && !digestUrls[o.id])
      .forEach(async (o) => {
        try {
          const r = await fetch(
            `/api/admin/pdf?order=${o.id}&type=digest`,
            { headers: { "x-admin-key": key } }
          );
          const { url } = await r.json();
          if (url) setDigestUrls((prev) => ({ ...prev, [o.id]: url }));
        } catch {
          /* silent */
        }
      });
  }, [orders, authed, key, digestUrls]);

  /* PIN gate */
  function handleLogin() {
    if (!pin.trim()) return;
    setKey(pin.trim());
    sessionStorage.setItem("ketabi-admin-key", pin.trim());
    setAuthed(true);
    setPinErr("");
  }

  /* open PDF in new tab */
  async function openPdf(orderId: string, type: "interior" | "cover") {
    try {
      const r = await fetch(
        `/api/admin/pdf?order=${orderId}&type=${type}`,
        { headers: { "x-admin-key": key } }
      );
      const { url } = await r.json();
      if (url) window.open(url, "_blank");
    } catch {
      setToast("Could not load PDF");
    }
  }

  /* approve / reject */
  async function handleAction(orderId: string, action: "approve" | "reject") {
    const label = action === "approve" ? "Approve" : "Reject";
    if (!confirm(`${label} this order?`)) return;

    setActing(orderId);
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": key,
        },
        body: JSON.stringify({ orderId, action }),
      });
      const data = await r.json();
      if (r.ok) {
        flash(`Order ${action}d`);
        load();
      } else {
        flash(data.error || "Action failed");
      }
    } catch {
      flash("Network error");
    } finally {
      setActing(null);
    }
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  /* ── render: PIN gate ── */
  if (!authed) {
    return (
      <div className={`wrap ${s.gate}`}>
        <h1>Ketabi Studio</h1>
        <p>Enter your admin key to continue</p>
        <div className={s.pinRow}>
          <input
            className={s.pinInput}
            type="password"
            placeholder="Admin key"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoFocus
          />
          <button className={s.pinBtn} onClick={handleLogin}>
            Enter
          </button>
        </div>
        {pinErr && <p className={s.error}>{pinErr}</p>}
      </div>
    );
  }

  /* ── group orders by status ── */
  const groups: Record<string, Order[]> = {};
  for (const o of orders) {
    (groups[o.status] ??= []).push(o);
  }
  const sortedStatuses = Object.keys(groups).sort(
    (a, b) =>
      (STATUS_ORDER.indexOf(a) === -1 ? 99 : STATUS_ORDER.indexOf(a)) -
      (STATUS_ORDER.indexOf(b) === -1 ? 99 : STATUS_ORDER.indexOf(b))
  );

  /* ── render: dashboard ── */
  return (
    <div className={`wrap ${s.dash}`}>
      <div className={s.topBar}>
        <h1>Orders</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/admin/qc" className={s.refresh} style={{ textDecoration: "none" }}>
            QC Review
          </a>
          <button className={s.refresh} onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {loading && orders.length === 0 && (
        <p className={s.loading}>Loading orders...</p>
      )}

      {!loading && orders.length === 0 && (
        <p className={s.empty}>No orders yet. Once a customer places an order, it will appear here.</p>
      )}

      {sortedStatuses.map((status) => (
        <div key={status} className={s.group}>
          <p className={s.groupLabel}>
            {fmtStatus(status)} ({groups[status].length})
          </p>

          {groups[status].map((o) => (
            <div key={o.id} className={s.card}>
              <div className={s.cardTop}>
                <div>
                  <div className={s.childName}>
                    {o.child_name || SLUG_LABELS[o.book_slug] || o.book_slug}
                  </div>
                </div>
                <span className={`${s.badge} ${badgeClass(o.status)}`}>
                  {fmtStatus(o.status)}
                </span>
              </div>

              <div className={s.meta}>
                <strong>Book:</strong>{" "}
                {SLUG_LABELS[o.book_slug] || o.book_slug}
                <br />
                {o.child_name && (
                  <>
                    <strong>Look:</strong> {o.skin} skin, {o.hair} {o.hair_style}
                    <br />
                  </>
                )}
                <strong>Email:</strong> {o.customer_email}
                <br />
                {o.shipping && (
                  <>
                    <strong>Ship to:</strong>{" "}
                    {o.shipping.name}, {o.shipping.street1},{" "}
                    {o.shipping.city} {o.shipping.state_code}{" "}
                    {o.shipping.postcode}
                    <br />
                  </>
                )}
                <strong>Ordered:</strong> {fmtDate(o.created_at)}
                {o.lulu_print_job_id && (
                  <>
                    <br />
                    <strong>Lulu job:</strong> {o.lulu_print_job_id}
                  </>
                )}
              </div>

              {/* QC report */}
              {o.qc_report && <QcBlock report={o.qc_report} status={o.status} />}

              {/* Digest image for awaiting_approval */}
              {o.status === "awaiting_approval" && digestUrls[o.id] && (
                <div className={s.digestWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={digestUrls[o.id]}
                    alt="Order digest preview"
                    className={s.digestImg}
                  />
                </div>
              )}

              {/* PDF links (show for any order that has paths) */}
              {o.interior_path && (
                <div className={s.pdfRow}>
                  <button
                    className={s.pdfLink}
                    onClick={() => openPdf(o.id, "interior")}
                  >
                    📖 Interior PDF
                  </button>
                  <button
                    className={s.pdfLink}
                    onClick={() => openPdf(o.id, "cover")}
                  >
                    🖼 Cover PDF
                  </button>
                </div>
              )}

              {/* Approve / Reject for awaiting_approval */}
              {o.status === "awaiting_approval" && (
                <div className={s.actionRow}>
                  <button
                    className={s.approveBtn}
                    onClick={() => handleAction(o.id, "approve")}
                    disabled={acting === o.id}
                  >
                    {acting === o.id ? "..." : "Approve"}
                  </button>
                  <button
                    className={s.rejectBtn}
                    onClick={() => handleAction(o.id, "reject")}
                    disabled={acting === o.id}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  );
}
