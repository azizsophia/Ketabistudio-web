import { NextRequest, NextResponse } from "next/server";
import {
  loadThreadsCreds,
  refreshedThreadsCreds,
  publishThreadsTextChain,
  deleteThreadsPost,
} from "@/lib/threads";

// Posts a multi-part text thread to Threads as one connected reply chain.
// Reels/photos never come here, so this can never put a reel on Threads.
// Trigger: GET /api/social/thread?key=CRON_SECRET  (posts the journal thread)
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

// The "biggest fear" journal thread. Each part is under 500 chars.
const JOURNAL_THREAD = [
  `You pray five times a day.\n\nBut if someone asked you what "ar-Rahman" actually means, word for word, could you answer?\n\nMost of us can't. And it quietly scares us. We say the most important words of our lives and feel nothing, because no one ever taught us what they mean.`,
  `Here is the mercy in it: you do not need to become a scholar. You need one word a day.\n\nTake rahma. It means mercy. Its root is also the word for the womb, rahim.\n\nThe very first mercy you ever knew was named after His. (Sahih al-Bukhari 5988)`,
  `Or fitra: your original nature. The faith you were born already knowing.\n\n"Every child is born upon the fitra." (Sahih al-Bukhari 1358)\n\nSo when iman feels far, you are not failing to build something. You are being asked to remember it.`,
  `This is the whole reason I made From One Root.\n\nOne Arabic word a day for 30 days. Each traced to its meaning, every source cited, with room to reflect.\n\nNot one more thing to do. Just the words you already say, finally understood.`,
  `If you have ever felt like a stranger to your own prayers, I made this for you.\n\nFrom One Root. On Etsy now, link in my bio.\n\nOr comment "root" and I will send you the link myself. 🌙`,
];

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!CRON_SECRET || key !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let creds = await loadThreadsCreds();
  if (!creds) {
    return NextResponse.json({ error: "threads not connected" }, { status: 500 });
  }
  creds = await refreshedThreadsCreds(creds);

  // ?delete=id1,id2,... removes posts (used to undo a duplicate thread)
  const del = req.nextUrl.searchParams.get("delete");
  if (del) {
    const results = [];
    for (const id of del.split(",").map((s) => s.trim()).filter(Boolean)) {
      results.push({ id, ...(await deleteThreadsPost(creds, id)) });
    }
    return NextResponse.json({ ok: true, deleted: results });
  }

  try {
    const ids = await publishThreadsTextChain(creds, JOURNAL_THREAD);
    return NextResponse.json({ ok: true, posted: ids.length, ids });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
