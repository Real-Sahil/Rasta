#!/usr/bin/env bash
# PostToolUse hook: typecheck after Claude edits a TS/TSX file under src/.
# Exit 2 feeds the compiler errors back to Claude.
set -u
input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
case "$file" in
  */src/*.ts|*/src/*.tsx|*/src/**/*.ts|*/src/**/*.tsx) ;;
  *) exit 0 ;;
esac
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -d node_modules ] || exit 0
out="$(npx --no-install tsc --noEmit 2>&1)" || { echo "$out" | head -30 >&2; exit 2; }
exit 0
