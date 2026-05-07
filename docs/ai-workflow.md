# AI workflow

This document captures how Claude (Anthropic's Claude Code) was used to build this project. It is a first-class deliverable per CLAUDE.md §13.

## Approach

> One-paragraph summary — finalized in Phase 9 once the full picture is in.

## Planning phase

Before any code was written, the project was scoped through three planning artifacts:

- **[CLAUDE.md](../CLAUDE.md)** (~500 lines) — the working agreement: hard rules, architecture invariants, file/folder conventions, code style, testing strategy, commit conventions, self-review process. Read by Claude Code at the start of every session as a contract for how work happens in this repo.
- **[PLAN.md](../PLAN.md)** — the build plan: 9 phases, each with Tier 1/2/3 deliverables, definition-of-done, time estimates, and a prescribed conventional-commit sequence. Includes a risk register, time-discipline checkpoints, an explicit out-of-scope list, and per-phase documentation obligations.
- **[docs/decisions.md](./decisions.md)** — 23 ADRs (Michael Nygard format) covering every load-bearing technical choice: native Custom Element wrapping React, Records over arrays, three-store Zustand architecture, hybrid HTML+SVG canvas, Shadow DOM with constructable stylesheets, server-side LLM proxy, atomic tool schema, agent-loop iteration cap, performance budget, security threat model, accessibility scope, container-query responsive design.

These three documents are the source of truth. When work conflicts with them, the document wins; when work uncovers something they didn't anticipate, the document is updated rather than the rule silently bent.

## Guardrails

Mechanical reinforcement of the rules captured in CLAUDE.md and PLAN.md:

- **`.claude/settings.json`** — permissions allow/deny/ask lists block dangerous flags (`--no-verify`, `--no-gpg-sign`, `git merge`, `gh pr merge`) and gate destructive ops (`rm -rf`, `git reset --hard`, force pushes).
- **`.claude/hooks/forbidden-imports.sh`** — PostToolUse hook on Edit/Write/MultiEdit; greps the changed file for any of the 10 forbidden libraries from CLAUDE.md §3 and exits non-zero with a clear message pointing to the relevant ADR.
- **ESLint flat config** — `no-explicit-any`, `no-non-null-assertion`, `no-restricted-imports` (full forbidden list), `no-console` (allow warn/error only), `consistent-type-imports`, `no-floating-promises`, `no-misused-promises`.
- **commitlint** — conventional commits with scope-enum locked to the names PLAN.md uses.
- **husky pre-commit** — lint-staged (eslint --fix + prettier --write on staged files).
- **GitHub Actions CI** — typecheck, lint, test, build on every push and PR.

## Interventions

> Placeholder — entries land per-phase. Each entry: the situation, what Claude proposed, what was corrected/adjusted, and why.

## Reflection

> Placeholder — finalized in Phase 9. What worked, what didn't, what would change next time.

## Token usage

> Placeholder — finalized in Phase 9 with cumulative token counts and cost.
