"use client";

import { useState } from "react";
import styles from "./coming-soon.module.css";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState("error");
      setMsg("Please enter a valid email.");
      return;
    }
    setState("loading");
    setMsg("");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source: "coming-soon" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      setState("done");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (state === "done") {
    return (
      <div className={styles.waitDone}>
        <span className={styles.waitTick} aria-hidden="true">
          ✓
        </span>
        Jazāk Allāhu khayran — you&apos;re on the founding list. You&apos;ll get
        early access the moment we open, Inshallah.
      </div>
    );
  }

  return (
    <form className={styles.waitForm} onSubmit={submit} noValidate>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        className={styles.waitInput}
        placeholder="you@email.com"
        aria-label="Email address"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === "error") setState("idle");
        }}
      />
      <button
        type="submit"
        className={styles.waitBtn}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Adding…" : "Join the list"}
      </button>
      {state === "error" && <p className={styles.waitErr}>{msg}</p>}
    </form>
  );
}
