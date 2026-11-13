#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: install npm dependencies so lint, tests and build work.
# Synchronous on purpose: the session only starts once dependencies are ready (no race with tests/linters).
set -euo pipefail

# Cloud (remote) sessions only
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Run the install only if a hashed file changed since the install last succeeded.
# The hash file lives in node_modules (git-ignored), so it disappears together with the packages.
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  # Delete the old hashes first, so a failed install runs again next time
  rm -f "$hashes"

  # npm install (not ci): the container state is cached, so incremental installs are fast
  npm install --no-audit --no-fund

  # This script plus every file that decides what gets installed
  sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi
