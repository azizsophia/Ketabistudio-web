"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./VoiceRecorder.module.css";

/* Records a short voice note and encodes it to MP3 *in the browser* (via a
   lazily-loaded encoder) so it plays on every device — including iPhones,
   where the native webm/opus recording format won't. Uploads the mp3 and hands
   the URL back to the builder. Max ~90s. */

const MAX_SECONDS = 90;

type Status = "idle" | "recording" | "processing" | "uploading" | "ready" | "error";

export default function VoiceRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [status, setStatus] = useState<Status>(value ? "ready" : "idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(44100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      procRef.current?.disconnect();
      srcRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
      }
    } catch {
      /* ignore */
    }
    procRef.current = null;
    srcRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }

  async function start() {
    setError("");
    chunksRef.current = [];
    setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      // iOS Safari can hand back a suspended context even inside a tap
      // gesture; without resume() onaudioprocess never fires and the take
      // records silence.
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      ctxRef.current = ctx;
      sampleRateRef.current = ctx.sampleRate;
      const src = ctx.createMediaStreamSource(stream);
      srcRef.current = src;
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      proc.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      src.connect(proc);
      proc.connect(ctx.destination);
      setStatus("recording");

      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      setStatus("error");
      setError(
        "We couldn't access your microphone. Please allow mic access and try again."
      );
      cleanup();
    }
  }

  async function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    const chunks = chunksRef.current;
    const sampleRate = sampleRateRef.current;
    // tear the mic down before the (synchronous-ish) encode
    try {
      procRef.current?.disconnect();
      srcRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }

    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total < sampleRate * 0.4) {
      // under ~0.4s — treat as a mis-tap
      setStatus(value ? "ready" : "idle");
      if (ctxRef.current && ctxRef.current.state !== "closed")
        ctxRef.current.close();
      return;
    }

    setStatus("processing");
    try {
      const blob = await encodeMp3(chunks, total, sampleRate);
      if (ctxRef.current && ctxRef.current.state !== "closed")
        ctxRef.current.close();

      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });

      setStatus("uploading");
      const fd = new FormData();
      fd.append("file", blob, "voice.mp3");
      const r = await fetch("/api/cards/voice", { method: "POST", body: fd });
      const data = await r.json();
      if (r.ok && data.url) {
        onChange(data.url);
        setStatus("ready");
      } else {
        setStatus("error");
        setError(data.error || "Could not save the recording. Please try again.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong encoding your recording. Please try again.");
    }
  }

  function remove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    onChange("");
    setStatus("idle");
    setError("");
    setElapsed(0);
  }

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const audioSrc = previewUrl || value;

  return (
    <div className={styles.wrap}>
      {status === "recording" ? (
        <div className={styles.recRow}>
          <button type="button" className={styles.stopBtn} onClick={stop}>
            <span className={styles.recDot} aria-hidden="true" />
            Stop · {mmss(elapsed)}
          </button>
          <span className={styles.recHint}>
            Recording… up to {MAX_SECONDS / 60} min
          </span>
        </div>
      ) : status === "processing" || status === "uploading" ? (
        <div className={styles.busy}>
          {status === "processing" ? "Preparing your recording…" : "Saving…"}
        </div>
      ) : (status === "ready" || audioSrc) && status !== "error" ? (
        <div className={styles.readyRow}>
          <audio className={styles.player} src={audioSrc} controls preload="metadata" />
          <div className={styles.readyActions}>
            <span className={styles.ok}>Voice note added ✓</span>
            <button type="button" className={styles.linkBtn} onClick={start}>
              Re-record
            </button>
            <button type="button" className={styles.linkBtn} onClick={remove}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.recordBtn} onClick={start}>
          <span className={styles.micDot} aria-hidden="true" />
          Record a voice note
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

/* Flatten the captured PCM and encode to a 128kbps mono MP3. */
async function encodeMp3(
  chunks: Float32Array[],
  total: number,
  sampleRate: number
): Promise<Blob> {
  const lamejs = await import("@breezystack/lamejs");
  const Mp3Encoder = lamejs.Mp3Encoder;

  const flat = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    flat.set(c, offset);
    offset += c.length;
  }
  const samples = new Int16Array(flat.length);
  for (let i = 0; i < flat.length; i++) {
    const s = Math.max(-1, Math.min(1, flat[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const enc = new Mp3Encoder(1, sampleRate, 128);
  const blockSize = 1152;
  const data: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const buf = enc.encodeBuffer(samples.subarray(i, i + blockSize));
    if (buf.length) data.push(new Uint8Array(buf));
  }
  const end = enc.flush();
  if (end.length) data.push(new Uint8Array(end));
  return new Blob(data as BlobPart[], { type: "audio/mpeg" });
}
