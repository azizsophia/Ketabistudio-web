"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../hifz.module.css";

export default function HifzLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const site =
      process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${site}/auth/callback?next=/hifz`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className={styles.page}>
        <div className={styles.authWrap}>
          <p className={styles.eyebrow}>Ketabi Hifz</p>
          <h1 className={styles.title} style={{ fontSize: "2rem" }}>
            Sign in
          </h1>

          {sent ? (
            <div className={styles.success} style={{ marginTop: 22 }}>
              Check your email — we sent a sign-in link to{" "}
              <strong>{email}</strong>. Open it on this device to continue.
            </div>
          ) : (
            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.label} htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className={styles.input}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Sending…" : "Email me a link"}
              </button>
              {error && <p className={styles.error}>{error}</p>}
              <p className={styles.note}>
                No password needed — we&apos;ll email you a secure link to sign
                in.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
