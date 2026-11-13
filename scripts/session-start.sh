#!/usr/bin/env bash
# SessionStart hook: install dependencies in cloud (remote) sessions so lint/test/build work immediately.
set -e
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund >/dev/null 2>&1 || npm install --legacy-peer-deps --no-audit --no-fund >/dev/null 2>&1
fi
exit 0
