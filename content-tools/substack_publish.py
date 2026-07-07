#!/usr/bin/env python3
# Load the month of posts into Substack as DRAFTS via the private API. Safe by
# design: it only creates drafts (never publishes, never emails your list). You
# open each draft, tweak if you like, and hit Substack's own Publish/Schedule.
#
# Auth: the private API uses your session cookie. NEVER paste it in chat or commit
# it. Set two environment variables before running:
#     SUBSTACK_SID        = the value of your connect.sid cookie
#     SUBSTACK_SUBDOMAIN  = your publication subdomain (e.g. "ketabi" for ketabi.substack.com)
#
# Usage:
#     python3 substack_publish.py --dry-run     # parse + preview, no network (default)
#     python3 substack_publish.py --create      # actually create drafts (needs env vars)
#
# The endpoint is unofficial and undocumented; if Substack changes it, --create
# fails harmlessly and nothing is sent. Rate limited to 1 request/sec.
import os, sys, re, json, time, argparse

D = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(D, "substack_month_posts.md")


def parse_posts(path):
    """Split the markdown into structured posts. Each '## POST n' block carries
    **SEO title:**, **Subtitle:**, and a body (everything after the metadata
    block up to the next '---')."""
    raw = open(path, encoding="utf-8").read()
    blocks = re.split(r"\n## POST \d+.*?\n", raw)[1:]  # drop the header preamble
    posts = []
    for b in blocks:
        # stop at the section divider that ends each post
        body_area = b.split("\n---", 1)[0]

        def field(name):
            m = re.search(rf"\*\*{re.escape(name)}:\*\*\s*(.+)", body_area)
            return m.group(1).strip() if m else ""

        title = field("SEO title")
        subtitle = field("Subtitle")
        if not title:
            continue
        # body = everything after the last metadata line (Tags:) to the divider
        after = body_area.split("**Tags:**", 1)
        body_md = after[1].split("\n", 1)[1].strip() if len(after) > 1 else ""
        paras = [p.strip() for p in re.split(r"\n\s*\n", body_md) if p.strip()]
        posts.append({"title": title, "subtitle": subtitle, "paragraphs": paras})
    return posts


def prosemirror(paragraphs):
    """Build a minimal valid ProseMirror doc: one paragraph node per paragraph,
    with a bold mark on a leading **...** span if present."""
    content = []
    for p in paragraphs:
        m = re.match(r"\*\*(.+?)\*\*\s*(.*)", p, re.S)
        if m:
            nodes = [{"type": "text", "marks": [{"type": "strong"}], "text": m.group(1)}]
            rest = m.group(2).strip()
            if rest:
                nodes.append({"type": "text", "text": " " + rest})
        else:
            nodes = [{"type": "text", "text": p}]
        content.append({"type": "paragraph", "content": nodes})
    return {"type": "doc", "content": content}


def create_draft(post, sid, subdomain):
    import requests
    url = f"https://{subdomain}.substack.com/api/v1/drafts"
    body = {
        "draft_title": post["title"],
        "draft_subtitle": post["subtitle"],
        "draft_body": json.dumps(prosemirror(post["paragraphs"])),
        "type": "newsletter",
        "audience": "everyone",
    }
    r = requests.post(url, json=body,
                      headers={"Cookie": f"connect.sid={sid}", "Content-Type": "application/json"},
                      timeout=60)
    return r.status_code, r.text[:200]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--create", action="store_true", help="actually create drafts (default is dry-run)")
    args = ap.parse_args()
    posts = parse_posts(MD)
    print(f"parsed {len(posts)} posts:\n")
    for i, p in enumerate(posts, 1):
        print(f"{i:>2}. {p['title']}")
        print(f"    sub: {p['subtitle']}")
        print(f"    paras: {len(p['paragraphs'])}\n")

    if not args.create:
        print("DRY RUN. No network calls made. Re-run with --create (and env vars set) to load drafts.")
        return

    sid = os.environ.get("SUBSTACK_SID")
    sub = os.environ.get("SUBSTACK_SUBDOMAIN")
    if not sid or not sub:
        print("ERROR: set SUBSTACK_SID and SUBSTACK_SUBDOMAIN env vars first. Aborting (nothing sent).")
        sys.exit(1)
    for i, p in enumerate(posts, 1):
        code, txt = create_draft(p, sid, sub)
        print(f"[{i}] {code}  {p['title'][:48]}  {txt[:80]}")
        time.sleep(1.2)  # stay under 1 req/sec
    print("\nDone. Open your Substack dashboard -> Drafts. Nothing was published or emailed.")


if __name__ == "__main__":
    main()
