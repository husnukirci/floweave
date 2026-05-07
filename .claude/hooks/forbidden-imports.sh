#!/usr/bin/env bash
# Forbidden-imports check — PostToolUse hook for Edit/Write/MultiEdit.
# Blocks (exit 2) when a source file imports a library that CLAUDE.md §3 forbids.
# Reads the tool-call JSON from stdin to discover the edited file path.

set -euo pipefail

FORBIDDEN='bpmn-js|bpmn-react|react-flow|@xyflow/react|redux|@reduxjs/toolkit|mobx|jotai|recoil|valtio'

input=$(cat)

if command -v jq >/dev/null 2>&1; then
  file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
else
  file_path=$(echo "$input" \
    | grep -oE '"file_path"[^"]*"[^"]+"' \
    | head -1 \
    | sed -E 's/.*"file_path"[^"]*"([^"]+)".*/\1/')
fi

[ -z "${file_path}" ] && exit 0
[ ! -f "${file_path}" ] && exit 0

case "${file_path}" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

if grep -nE "from ['\"](${FORBIDDEN})(['\"]|/)" "${file_path}" >/dev/null 2>&1; then
  {
    echo "BLOCKED: ${file_path} contains a forbidden import."
    echo
    echo "Forbidden libraries (CLAUDE.md §3):"
    echo "  bpmn-js, bpmn-react, react-flow, @xyflow/react,"
    echo "  redux, @reduxjs/toolkit, mobx, jotai, recoil, valtio"
    echo
    echo "Rationale: docs/decisions.md (ADR-001 through ADR-012)."
  } >&2
  exit 2
fi

exit 0
