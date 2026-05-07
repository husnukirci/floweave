# AI workflow

This document captures how Claude (Anthropic's Claude Code) was used to build this project. It is a first-class deliverable per [CLAUDE.md §13](../CLAUDE.md).

## Approach

The project was scoped end-to-end as a contract first — `CLAUDE.md` (rules), `PLAN.md` (9 phases of build work with Tier 1/2/3 deliverables), `docs/decisions.md` (23 ADRs) — and then Claude Code worked through the phases against that contract. Each phase used a tight loop: propose a 5-7 bullet plan, get approval, implement commit-by-commit with explicit per-commit review (TDD red-then-green where the rules required strict TDD, test-after for React component layers), produce a self-review report after each phase, run live validation against the real Anthropic API where the contract demanded it, and only then open the PR. The user approved every commit before push and personally merged every PR — Claude Code never merged its own work.

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

Three real moments where human review caught things autonomous work would have missed.

### 1. Phase 6 commit 8 — CLAUDE.md §4 violation surfaced in self-review

After landing the agent loop in Phase 6 commit 5, the self-review's adversarial pass noticed the loop was calling per-tool store actions in a `for` loop:

> CLAUDE.md §4 says: _"LLM-driven mutations use `applyMutations()` as a single batched call. Never call individual actions in a loop from the agent loop."_ My impl in `src/llm/agentLoop.ts` calls `applyToolCall` (which calls store actions directly) once per `tool_use` block in a turn.

The blocker for batching was that `addNode` generated the new node's id internally, and `connect_nodes` issued in the same turn would need to reference that id. The fix required structural changes — extending `Mutation` to accept an optional pre-generated id, splitting the executor into a pure `buildToolMutations` builder + an applying wrapper, and routing every turn through one `store.applyMutations()` call. The user picked **"Fix now in this PR"** when offered the choice between a follow-up and an in-PR fix, and the result landed as commit 8 (`refactor(llm): batch tool calls via single applyMutations per turn`). Without the explicit "never" wording in CLAUDE.md driving the self-review prompt, this would have shipped as-is.

### 2. Phase 7 — `make dev-server` quietly failed despite the README

During Phase 7's live Playwright validation, `make dev-server` exited 1 with the structured `ANTHROPIC_API_KEY missing` log even though `.env` existed and the README documented `cp .env.example .env; make dev-server` as the canonical boot recipe. Root cause: Node's `--experimental-strip-types` runner doesn't auto-load `.env`, and the Phase 6 dev:server script had been silently relying on the developer to `set -a; source .env` first — something the README never asked for.

Fixed in commit 6 of Phase 7 (`fix(infra): load .env in dev:server / start:server scripts`) by adding `--env-file-if-exists=.env` to both Node invocations. The flag is a no-op when `.env` is absent so the proxy still starts cleanly under Docker / production where env vars come from the orchestrator. This bug couldn't have been caught by unit tests — only by running the documented quick-start path end-to-end, which is why live validation against the real environment is part of every phase that ships infrastructure.

### 3. Phase 8 commit 2 — mechanical refactor was wide but had to be one commit

Phase 8's per-instance store migration touched 27 files: every component that imported the workflowStore / useUiStore / useChatStore singletons flipped to context hooks; eight test files updated to use a new `renderWithStores` helper; entry points (`main.tsx`, `WorkflowEditorElement`) wrapped their trees in `<StoresProvider>`. The temptation was to split it across multiple commits to keep diffs small. The plan rejected that:

> The big mechanical risk is **commit 2**: every component file that imports `workflowStore` / `useUiStore` / `useChatStore` flips to hooks, plus every test file. Diff will be wide. Per-commit approval still recommended; I'll surface the file count when proposing commit 2.

Splitting would have left the codebase in a half-migrated state mid-commit (some files using singletons, some using context, the chat store stuck between two sets of dependencies). One logical change → one commit, even when the diff is wide. CLAUDE.md §11's _"One logical change per commit. Mixing concerns is a defect"_ pulled both ways; "wide diff for a coherent refactor" beats "many narrow commits leaving the tree broken between them."

## Reflection

What worked:

- **Three-document contract upfront**. CLAUDE.md + PLAN.md + decisions.md gave Claude Code enough context to do most phases autonomously while still landing predictable commits. When self-review caught a violation, the rule it pointed at was always already in CLAUDE.md.
- **Strict TDD on state/LLM/utils, test-after on components**. Per-action red bar before impl forced a clear contract; component tests-after kept render-shape exploration cheap. The Phase 6 sequence (test commit → impl commit) made the LLM agent loop's behavior boundaries explicit before any wire-format code shipped.
- **Self-review with adversarial pass on critical phases**. The §4 violation surfaced in Phase 6, the React.memo gap on `MessageItem` would have surfaced in Phase 7 (it was caught later by an external code-review skill instead). The discipline of "read your own diff cold as a reviewer" surfaces real issues, not just stylistic ones.
- **Per-commit approval cadence on phases that touched the LLM**. Slow but deliberate. The user's "approve" / "approved" cadence per commit caught two scope drifts and one wrong inferred plan before they shipped.
- **Live Playwright validation against the real Anthropic API**. Mocked tests aren't enough for the chat path; a single round-trip through the live proxy + the live model surfaced both the missing-`.env` bug (Phase 7) and the absent-CORS scenario (recovered for Phase 9 via same-origin Docker serving).

What didn't:

- **The `MessageItem` React.memo gap** in Phase 7 should have been caught by self-review. CLAUDE.md §3 explicitly names `ChatMessage` as a list-rendered component requiring memoization; my self-review missed it. Adding a literal "List components: each one wrapped in React.memo? grep for memo in the diff" rubric line to CLAUDE.md §10 would have caught it.
- **PR scope creep on small fixes**. The `--env-file-if-exists` fix piggybacked onto Phase 7's PR rather than going as its own focused commit on `main`. Acceptable since it was discovered during Phase 7 work, but a more disciplined author would have surfaced it as a separate hotfix PR.
- **Decisions.md updates lagged the work**. ADR-022's two-bundle split should have been promoted from "we'll figure this out in Phase 8" to a written ADR amendment as soon as Phase 8 commit 4 landed. Instead it shipped retroactively in Phase 9 commit 3. Decision-record drift is a real risk when the doc isn't touched commit-by-commit.

What would change next time:

- **Open the PR as draft at commit 1, not at the last commit of the phase**. Reviewers (and CI) get earlier visibility; commit-by-commit context lands progressively rather than as a single firehose at the end.
- **Cut a `.claude/skills/self-review.md` skill** that drives the Phase rubric automatically. Inlining it in each phase's "produce self-review report" step works, but pulling it into a callable skill would make the discipline mechanical.
- **Write the ADR amendment in the same commit as the work that drove it**, not in a docs-finalization phase later.

## Token usage

Cumulative token usage isn't precisely instrumented, but rough orders of magnitude across the build (Phases 0–9, ~70 commits, ~2,700 lines of source code in `src/` + ~270 lines in `server/` + 273 unit tests + the demo + the Docker stack):

- **~25–35M tokens of context** consumed across the project, distributed across roughly 200 conversation turns. Per-turn averages ranged from 5–15k tokens of context plus 2–8k tokens of output, climbing into the 30–50k range during multi-file refactor commits like Phase 8 commit 2 and the Phase 6 self-review.
- **~$50–80 of API spend** at the published rates for Claude Sonnet 4.6, plus negligible Anthropic API spend on the live-validation chat round-trips (each scenario in Phase 6 + Phase 7 + Phase 8 cost a few cents). Phase 6 commit 8's refactor and Phase 8 commit 2's migration were the two largest single-turn spends.
- **The CLAUDE.md / PLAN.md / decisions.md trio dominates per-turn input**. Together they're ~3,500 lines that load on every fresh session and inform every commit; pruning them would shorten turns but at a real cost in coherence with the contract.

These numbers are approximate (the harness exposes session-level totals, not project-wide aggregates). The point isn't precision — it's that a project of this scope is firmly within hobbyist budget and an order of magnitude cheaper than the equivalent contractor hours.
