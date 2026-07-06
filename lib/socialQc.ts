// Internal QC gate for auto-published social posts. Layered so nothing
// garbled, off-brand, or Islamically questionable ever goes out on its own.
//
// Deterministic checks always run. If ANTHROPIC_API_KEY is set, a Claude
// proofread also runs, focused on Modern Standard Arabic correctness, English
// accuracy, translation fidelity, and false/unverifiable Islamic claims.

export type QcCheck = { name: string; pass: boolean; detail?: string };
export type QcVerdict = { pass: boolean; checks: QcCheck[]; reviewedByAi: boolean };

const IG_CAPTION_MAX = 2200;
const HASHTAG_MAX = 30;

// Six-pointed star / Star of David must never appear (standing brand rule).
const FORBIDDEN: RegExp[] = [
  /star of david/i,
  /hexagram/i,
  /✡/, // ✡ star of david
  /\u{1F52F}/u, // 🔯 six pointed star with middle dot
];

function arabicLooksValid(text: string): { pass: boolean; detail?: string } {
  if (/�/.test(text)) {
    return { pass: false, detail: "contains a replacement character (garbled/mojibake text)" };
  }
  const arabic = [...text].filter((c) => {
    const cp = c.codePointAt(0) ?? 0;
    return (
      (cp >= 0x0600 && cp <= 0x06ff) ||
      (cp >= 0x0750 && cp <= 0x077f) ||
      (cp >= 0x08a0 && cp <= 0x08ff) ||
      (cp >= 0xfb50 && cp <= 0xfdff) ||
      (cp >= 0xfe70 && cp <= 0xfeff)
    );
  });
  if (arabic.length > 0 && arabic.length < 2) {
    return { pass: false, detail: "an isolated Arabic glyph, likely broken shaping" };
  }
  return { pass: true };
}

async function aiReview(
  caption: string,
  key: string
): Promise<{ pass: boolean; issues: string[] }> {
  const prompt = `You are a strict proofreader for an Islamic gifts brand's social media. Review the caption below and flag ANY of these problems:
- Arabic that is not correct Modern Standard Arabic (spelling, grammar, wrong or broken letters, wrong diacritics)
- English that is misspelled or clearly awkward
- An English translation that does not faithfully match its Arabic
- Any Qur'an or hadith quoted that is not verbatim/accurate, or any false or unverifiable Islamic claim
- Anything Islamically disrespectful or inappropriate
- Any Star of David or six-pointed-star reference
Reply with ONLY compact JSON of the form {"pass": true|false, "issues": ["..."]}. Set pass to false if there is ANY issue.

CAPTION:
"""${caption}"""`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error("anthropic http " + r.status);
  const data = (await r.json()) as { content?: { text?: string }[] };
  const text = (data.content?.[0]?.text || "").trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON in AI reply");
  const parsed = JSON.parse(m[0]) as { pass?: boolean; issues?: unknown };
  return {
    pass: !!parsed.pass,
    issues: Array.isArray(parsed.issues) ? (parsed.issues as string[]) : [],
  };
}

export async function runSocialQc(
  caption: string,
  imageUrl: string
): Promise<QcVerdict> {
  const checks: QcCheck[] = [];

  checks.push({ name: "caption-present", pass: !!caption.trim() });
  checks.push({
    name: "caption-length",
    pass: caption.length <= IG_CAPTION_MAX,
    detail: `${caption.length}/${IG_CAPTION_MAX}`,
  });

  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  checks.push({ name: "hashtag-count", pass: tags <= HASHTAG_MAX, detail: `${tags}` });

  const forbidden = FORBIDDEN.some((re) => re.test(caption));
  checks.push({ name: "no-forbidden-symbols", pass: !forbidden });

  const ar = arabicLooksValid(caption);
  checks.push({ name: "arabic-integrity", pass: ar.pass, detail: ar.detail });

  // Media asset (image OR reel video). image_url may be a comma-separated list
  // for a carousel, so check EACH url, not the joined string. HEAD first; some
  // CDNs answer HEAD with 405, so fall back to a tiny ranged GET.
  // Carousel image_url is a whitespace-separated list (matches the poster's
  // mediaUrls()); tolerate commas too so the two never disagree.
  const mediaUrls = imageUrl.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
  checks.push({
    name: "media-https",
    pass: mediaUrls.length > 0 && mediaUrls.every((u) => /^https:\/\//.test(u)),
  });
  async function isReachable(u: string): Promise<boolean> {
    try {
      const r = await fetch(u, { method: "HEAD" });
      if (r.ok) return true;
      const g = await fetch(u, { headers: { Range: "bytes=0-1023" } });
      return g.ok;
    } catch {
      return false;
    }
  }
  const reach = await Promise.all(mediaUrls.map(isReachable));
  const reachable = mediaUrls.length > 0 && reach.every(Boolean);
  checks.push({ name: "media-reachable", pass: reachable });

  let reviewedByAi = false;
  const anthKey = process.env.ANTHROPIC_API_KEY;
  if (anthKey) {
    try {
      const v = await aiReview(caption, anthKey);
      reviewedByAi = true;
      checks.push({
        name: "ai-arabic-english-islam",
        pass: v.pass,
        detail: v.issues.join("; ") || undefined,
      });
    } catch (e) {
      checks.push({
        name: "ai-arabic-english-islam",
        pass: false,
        detail: "AI review errored: " + (e instanceof Error ? e.message : "unknown"),
      });
    }
  }

  return { pass: checks.every((c) => c.pass), checks, reviewedByAi };
}
