#!/bin/bash
# SessionStart hook for Ketabistudio-web (Claude Code on the web).
#
# Installs the dependencies needed to generate and preview the personalized
# "her-beautiful-hijab" book from the worker pipeline, plus the Next.js site
# deps. After this runs, rendering the book's interior pages from the Supabase
# art bases "just works" — provided the environment ALSO has:
#   * outbound network access to the Supabase host, and
#   * SUPABASE_URL + SUPABASE_SERVICE_KEY set as environment variables.
# Those are configured in the environment settings, not here — secrets must
# never live in a committed hook.
set -euo pipefail

# Only run inside the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# poppler-utils provides pdftoppm, used to rasterize generated PDFs for QC
# (worker/qc.py blank-page + reference checks) and for previewing pages.
if ! command -v pdftoppm >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y -qq poppler-utils
  else
    apt-get update -qq && apt-get install -y -qq poppler-utils
  fi
fi

# Worker Python deps live in an isolated venv. The venv ships a clean, modern
# pip/setuptools so legacy sdists (e.g. docopt, a psd-tools dependency) build
# correctly — the image's Debian-patched system setuptools fails to build them.
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install --quiet --upgrade pip setuptools wheel
.venv/bin/python -m pip install --quiet -r worker/requirements.txt

# Make the venv the session's default Python (idempotent across re-runs).
if ! grep -q "/.venv/bin" "$CLAUDE_ENV_FILE" 2>/dev/null; then
  {
    echo "export VIRTUAL_ENV=\"$CLAUDE_PROJECT_DIR/.venv\""
    echo "export PATH=\"$CLAUDE_PROJECT_DIR/.venv/bin:\$PATH\""
  } >> "$CLAUDE_ENV_FILE"
fi

# Node deps for the Next.js storefront + admin.
if [ -f package-lock.json ]; then
  npm install --no-audit --no-fund --silent
fi

echo "session-start: dependencies ready" >&2
