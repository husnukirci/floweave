# CLAUDE.md

This file is read by Claude Code at the start of every session. It is the contract for how work happens in this repo. Read it fully. When in doubt, defer to PLAN.md for what to build and decisions.md for why.

---

## 0. Commands

| Action                                 | Command        |
| -------------------------------------- | -------------- |
| Install + git hooks                    | `make install` |
| Dev server                             | `make dev`     |
| Local gates (typecheck + lint + tests) | `make test`    |
| Production build                       | `make build`   |
| List all targets                       | `make help`    |

Run from the repo root. `make help` is the canonical list — anything below is a convenience cross-reference.

---

## 1. Project context

This is a reusable, embeddable Web Component implementing a BPMN-like workflow editor with an integrated AI chatbot for natural-language workflow editing. Target use case: insurance back-office tools, claims dashboards, internal admin UIs where non-technical users describe processes and the editor materializes them.

The standards bar is production-grade: clean component architecture, rigorous state management, well-engineered AI integration, complete documentation. Quality and discipline are first-class concerns, not afterthoughts.

---

## 2. Source-of-truth documents

Read these in this order at session start:

1. **CLAUDE.md** (this file) — rules, invariants, working agreement
2. **PLAN.md** — phase-by-phase build plan with scope, deliverables, definition-of-done per phase
3. **docs/decisions.md** — full reasoning behind every locked decision (23 ADRs)

When user instructions conflict with these documents, ask before proceeding.

Beyond these three, durable per-user feedback lives in `~/.claude/projects/-Users-<user>-Developer-floweave/memory/` — preferences captured across sessions. When in conflict, CLAUDE.md wins; memory captures user preferences not codified here.

---

## 3. Hard rules (non-negotiable)

These are absolute. Violating them is a defect, not a stylistic preference.

### Forbidden

- **No bpmn-js, bpmn-react, react-flow, @xyflow/react, redux, redux-toolkit, mobx, jotai, recoil, valtio.** This project does not use BPMN libraries (we build the editor from scratch) and uses Zustand exclusively for state.
- **No `dangerouslyAllowBrowser: true`** on the Anthropic SDK. The SDK is server-only; the client uses fetch.
- **No `any` type.** Use `unknown` and narrow, or define the type.
- **No non-null assertions (`!`)** without an inline comment justifying why null is impossible at that point.
- **No `as` casts** without a comment justifying. `as unknown as T` is a code smell that needs a comment.
- **No `// @ts-ignore` or `// @ts-expect-error`** without an inline comment explaining.
- **No default exports** except the Web Component class registered at the entry point.
- **No barrel re-exports** (`index.ts` files that just re-export). They break tree-shaking and obscure dependencies.
- **No `console.log`** in source. Use `console.warn` or `console.error` for genuine errors. Dev-only logs gated behind `import.meta.env.DEV`.
- **No `dangerouslySetInnerHTML`.** React's default escaping is mandatory.
- **No inline styles** in components. Use Tailwind classes or design tokens.
- **No new dependencies** outside the pre-approved list (§6) without asking first.
- **No TODO/FIXME comments** committed. Either fix it now or open an issue link.
- **No commented-out code** committed. Use git history.
- **No `.skip` or `.only`** in tests committed.
- **No empty `catch` blocks.** Either handle or rethrow with context.
- **No process.env reads in client code.** Vite uses `import.meta.env.VITE_*`. Server reads `process.env`.

### Required

- **TypeScript strict mode** — `strict: true`, `noUncheckedIndexedAccess: true`, `noFallthroughCasesInSwitch: true`, `noImplicitReturns: true`, `noUnusedLocals: true`, `noUnusedParameters: true`.
- **Named exports only** (with the one default-export exception above).
- **Explicit return types** on exported functions and non-trivial internal functions.
- **All store actions return** `Result<T, Error>` shape (`{ ok: true, value }` or `{ ok: false, error }`) where the result is non-trivial. Never throw from store actions.
- **All LLM tool executors** return structured Result objects, never throw. Errors are sent back to the LLM as tool_result content.
- **`React.memo`** on every component that renders inside a list or that subscribes to per-item store data (Node, Edge, ChatMessage, etc.).
- **Zustand selectors** subscribe to the minimum slice. Never `useStore(s => s)`. Use `useShallow` for derived data.
- **Pointer events**, not mouse/touch events. Single code path for all input devices.
- **`setPointerCapture`** for any drag interaction. Never document-level listeners.
- **rAF throttling** on any handler that fires from pointermove or scroll/resize.
- **`AbortController`** for every fetch call; respect cancellation.
- **All async functions handle errors** explicitly. Unhandled promise rejections are bugs.
- **Never commit to `main`.** Always work on a feature branch and open a PR (`gh pr create`). Never run `git merge` or `gh pr merge` — merging is the user's call, not Claude's.
- **No `Co-Authored-By: Claude ...` trailers** on commit messages or PR bodies. Project-level AI usage is documented in `docs/ai-workflow.md`; per-commit attribution is not wanted.
- **No external positioning.** No company names, no "challenge"/"assignment"/"evaluation"/"interview"/"submission"/"reimbursement" framing in code, docs, comments, commit messages, or PR bodies. The repo reads as a real product.

---

## 4. Architecture invariants

These define the structure. Changing them requires a new ADR.

### State

- **Three stores**: workflow (domain), ui (ephemeral), chat (async). They never merge.
- **Workflow store uses the slice pattern**: nodesSlice, edgesSlice, ioSlice. New domain logic goes in the appropriate slice or a new one — never a monolithic store.
- **Workflow store data structures are Records keyed by ID**, never arrays. Iterate via `Object.values()` only at render boundaries.
- **All workflow mutations go through actions.** No direct `set()` calls outside the slice files. No store mutations from components.
- **LLM-driven mutations use `applyMutations()`** as a single batched call. Never call individual actions in a loop from the agent loop.
- **Workflow store is created via `createWorkflowStore()` factory.** Each Web Component instance gets its own store. Never module-level singletons for domain state.
- **UI store and chat store are module-level singletons** (one editor instance per page is the common case; multi-instance support is workflow-state-only). If multi-instance becomes a constraint for ui/chat too, escalate.
- **Cross-store communication uses one of three patterns** (no others):
  1. Direct `getState()` reads (one-shot, no subscription)
  2. Action delegation (one store calls another's actions)
  3. Selective subscription via `subscribeWithSelector` (rare)

### Rendering

- **Hybrid HTML+SVG canvas**: HTML divs for nodes (absolute positioned), SVG overlay for edges. No canvas/WebGL.
- **Pan via `transform: translate3d(...)` with `will-change: transform`** on the canvas content layer. Never `top`/`left` for pan.
- **Edges are React-rendered** but each Edge component subscribes only to its source and target node positions. Moving an unrelated node never re-renders unrelated edges.
- **Connection handles are pointer-event targets** with hit-padding. Visual size differs from hit size.
- **No third-party drag/canvas libraries.** All interaction is hand-rolled with pointer events.

### Web Component

- **Native Custom Element** extending `HTMLElement`, registered as `<workflow-editor>`.
- **Shadow DOM with constructable stylesheets**. Tailwind CSS imported via Vite `?inline` and adopted.
- **`connectedCallback` mounts; `disconnectedCallback` unmounts.** Symmetric. Every resource created in connect is destroyed on disconnect.
- **Public API surface** (locked in ADR-018): attributes (`initial-workflow`, `api-endpoint`), properties (getter/setter for workflow), methods (`getWorkflow`, `setWorkflow`, `clear`, `addNode`), events (`workflow-change`, `node-selected`, `chat-message`, `error`).
- **No global state escape**. Each instance is fully encapsulated.

### LLM

- **Anthropic SDK only on the server** (`server/`). Never imported into `src/`.
- **API key only in server `.env`.** Never in client bundle, never in logs.
- **Atomic tool schema**: 1:1 mapping between tools and store actions. No "modify_workflow" mega-tool.
- **System prompt structure**: domain context → workflow state in `<workflow_state>` tags → tool guidelines. Workflow state is delimited explicitly to mitigate prompt injection.
- **Agent loop** caps at 5 iterations. Hard limit.
- **All tool inputs validated** before applying to store. Validation errors return as structured tool_results so the LLM can recover.

### Performance

- **Drag handlers rAF-throttled.** No raw 120Hz pointermove writes to the store.
- **Selectors return primitives or stable references.** Returning new objects/arrays defeats memoization.
- **`useShallow` for derived collections**, not custom equality functions.
- **No inline objects or arrays** passed as props to memoized components.
- **Stable keys** in lists. Always node/edge ID, never array index.

### Accessibility

- **WCAG 2.2 AA target.** Every PR touching UI considers a11y.
- **All interactive elements keyboard-reachable.** No mouse-only paths.
- **Visible focus rings** on every focusable element. Never `outline: none` without replacement.
- **Color is never the only state signal.** Pair with shape, icon, or text.
- **`aria-live="polite"`** for assistant chat messages.
- **`prefers-reduced-motion`** respected. All animations gated.

---

## 5. File and folder conventions

The structure is locked in PLAN.md. New files go in the appropriate folder; do not invent new top-level folders without asking.

```
src/
├── web-component/    # Custom Element wrapper (thin)
├── app/              # React entry (App, main)
├── state/            # Three stores
│   ├── workflow/     # Slices, factory, selectors, validators, types
│   ├── ui/
│   └── chat/
├── canvas/           # Canvas, Node, Edge, ConnectionLayer, GhostEdge
├── panels/           # Toolbar, PropertiesPanel, ChatPanel
├── llm/              # client, tools, systemPrompt, executor, agentLoop
├── nodes/            # Node type registry, insurance node specs
├── utils/            # geometry, pointer, id
├── styles/           # tokens, globals
└── test/             # factories, handlers, server, setup

server/               # Hono proxy
docs/                 # decisions, ai-workflow, ai-prompts, api, etc.
.claude/              # settings.json, hooks
```

### Naming

- **Files**: PascalCase for components (`Node.tsx`), camelCase for utilities (`geometry.ts`), kebab-case for config files (`vite.config.ts`).
- **Folders**: lowercase, no separators (`canvas`, not `Canvas` or `canvas-components`).
- **Hooks**: `use*` prefix, one hook per file when non-trivial.
- **Types**: `PascalCase`, suffix with what they are (`WorkflowNode`, not `Workflow`). Interface vs. type: prefer `type` for unions and primitives, `interface` for object shapes that may be extended.
- **Test files**: colocated `*.test.ts` or `*.test.tsx` next to the source file.

### Imports

Order:

1. External (React, Zustand, etc.)
2. Internal alias (`@/state/...`, `@/canvas/...`)
3. Relative (`./Node`, `../utils/geometry`)

Never deep-import across module boundaries. If `panels/` needs something from `canvas/`, the canvas module exports it explicitly.

---

## 6. Pre-approved dependencies

These can be installed without asking:

**Runtime (client):**

- `react`, `react-dom`
- `zustand`, `immer`, `zundo`
- `lucide-react`, `clsx`, `nanoid`

**Runtime (server):**

- `hono`, `@hono/node-server`
- `@anthropic-ai/sdk`
- `pino` (or just console for simpler logging)

**Build:**

- `vite`, `@vitejs/plugin-react`, `typescript`
- `tailwindcss` (v4 — CSS-first; no `tailwind.config.js`, no `postcss.config.js`, no `autoprefixer`)
- `@tailwindcss/vite` (Tailwind v4's official Vite plugin)

**Tooling:**

- `eslint`, `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`
- `prettier`
- `husky`, `lint-staged`
- `@commitlint/cli`, `@commitlint/config-conventional`

**Testing:**

- `vitest` (v4+), `@vitest/coverage-v8` (matches vitest version)
- `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`
- `happy-dom` (v20+ — DOM env, lighter than jsdom)
- `msw`
- `vitest-axe`
- `@playwright/test` (Tier 2/3 only)

Anything else: **ask before installing.** Justify the choice in a comment in the PR.

### Version pins worth knowing

- **ESLint** stays on `^9.x` (NOT v10) until `eslint-plugin-jsx-a11y` ships a v10-compatible peer.
- **Tailwind** is v4 (CSS-first config). No `tailwind.config.js`, no `postcss.config.js` — they should not be added.
- **TypeScript** is v6+. The deprecated `baseUrl` is removed; path aliases use `"./src/*"` form (with leading `./`) and resolve relative to the tsconfig file.
- **lint-staged** ≥ 17 requires Git ≥ 2.32 — non-issue on CI; may bite contributors with old local git binaries (e.g. legacy `/usr/local/bin/git` symlinks shadowing modern Apple/brew git).

---

## 7. Code style

### TypeScript

- Strict mode enforced via tsconfig.
- Prefer `type` for unions, primitives, function signatures. Prefer `interface` for object shapes that benefit from declaration merging or extension.
- Generic constraints: name single-letter types `T`, `U`, `V`. Multi-letter only when meaning matters (`TNode`, `TEdge`).
- Discriminated unions over flag fields. (`{ kind: 'success', value } | { kind: 'error', error }` over `{ ok, value?, error? }` — but the agreed convention for store actions is `Result` with `ok: boolean`, see §3.)
- Avoid `enum`. Use string literal unions or `const` objects with `as const`.
- Avoid `namespace`. Use modules.

### React

- Functional components only.
- Hooks order: state, refs, derived state, effects, callbacks, render. Consistent across components.
- Custom hooks for non-trivial logic; one hook per file when ≥30 lines.
- `useCallback` only when (a) passed to a memoized child, or (b) referenced in another hook's deps. Otherwise it adds noise.
- `useMemo` only when the computation is measurably expensive or the reference identity matters for memoization downstream.
- Props destructured at the top of the component body, not in the signature, when there are >4 props.
- Children prop typed as `React.ReactNode`.

### Comments

- Comments explain _why_, never _what_. The code shows what.
- JSDoc on exported public APIs (Web Component methods, store action signatures).
- No block comments for "section headers" inside files. If a file has sections, it should probably be multiple files.

---

## 8. Performance rules (concrete)

In addition to invariants in §4:

- **Profile before optimizing.** Don't add memoization speculatively.
- **Verify isolation with React Profiler** for any new component rendered in a list or grid. The Profiler should show only the dragged/changed item re-rendering.
- **Drag, pan, and any 60Hz hot path** uses rAF throttling pattern in `src/utils/pointer.ts`. Don't reinvent.
- **Bulk store mutations from LLM** go through `applyMutations()`. Calling actions in a for-loop is a defect.
- **SVG paths use viewport coordinates derived from store positions**, not pre-computed absolute paths. This makes pan/resize free.
- **`will-change: transform`** on the panned container, nowhere else by default.

---

## 9. Testing rules

Per ADR-013:

### Test-first (strict TDD) for:

- All Zustand store actions, slices, validators, selectors
- All LLM tool executors and the agent loop
- All utility functions (geometry, pointer, id)
- All JSON import/export logic

For these layers, **write the test file first, watch it fail, then implement.** Coverage thresholds enforced.

### Test-after (pragmatic) for:

- React component rendering and interaction
- Web Component lifecycle (smoke tests in jsdom)

Component tests cover: renders correctly, key interactions work, re-render isolation verified. Not exhaustive coverage.

### Don't test:

- Trivial passthrough components
- CSS / styling
- Third-party library internals
- Real LLM API (always mocked at MSW boundary)

### Coverage thresholds (vitest.config.ts):

- `src/state/**`: 90% lines, 85% branches
- `src/llm/**`: 90% lines, 85% branches
- `src/utils/**`: 95% lines, 90% branches
- Components and WC wrapper: no threshold (focus on meaningful tests)

### Test conventions:

- Files colocated as `*.test.ts` / `*.test.tsx` next to source
- Use factories from `src/test/factories.ts`, never inline object literals for test data
- MSW for network mocking, never `jest.mock('fetch')` or equivalent
- One assertion-per-test ideal; group related assertions when they prove one behavior
- Test names describe behavior, not implementation: `'cascades edge deletion when source node is removed'`, not `'calls removeEdgesForNode'`

---

## 10. Self-review process

After every implementation chunk, before committing, produce a self-review report.

### Universal rubric (every chunk)

**Compilation & quality gates**

- [ ] `npm run typecheck` — zero errors, zero warnings
- [ ] `npm run lint` — zero errors, zero warnings (warnings hide real issues)
- [ ] `npm test` — all pass, no `.skip` or `.only`
- [ ] `npm run build` — production build succeeds

**Forbidden patterns scan**

- [ ] No `any`, `as unknown as`, non-null assertions without justification
- [ ] No `dangerouslyAllowBrowser`, `dangerouslySetInnerHTML`
- [ ] No `console.log` in source (only `.warn`/`.error` or dev-gated)
- [ ] No `// @ts-ignore` or `.skip`/`.only` in tests
- [ ] No imports from forbidden libraries
- [ ] No new dependencies outside pre-approved list
- [ ] No TODO/FIXME/commented-out code

**Architecture invariants**

- [ ] Store mutations only via actions
- [ ] LLM batches via `applyMutations`
- [ ] Cross-store communication follows one of three patterns
- [ ] Records, not arrays, for keyed collections
- [ ] State that should be local is local (not in Zustand)

**Performance**

- [ ] List components are `React.memo`'d
- [ ] No inline objects/arrays passed to memoized components
- [ ] Selectors subscribe to minimum slice
- [ ] Hot paths rAF-throttled

**Tests**

- [ ] New store actions have tests
- [ ] New validators have tests
- [ ] New LLM tools have executor tests
- [ ] New utilities have unit tests
- [ ] Coverage thresholds still pass

**Accessibility**

- [ ] New interactive elements keyboard-reachable
- [ ] Focus rings visible
- [ ] ARIA roles/labels on new components
- [ ] Color not the only state signal
- [ ] `prefers-reduced-motion` respected on new animations

**Commit hygiene**

- [ ] Diff contains only files relevant to this chunk
- [ ] No `.env`, `.DS_Store`, IDE configs
- [ ] Conventional commit message with valid scope
- [ ] Body explains _why_ if non-obvious

### Phase-specific rubric

See PLAN.md for each phase's additional checklist (e.g., cascade delete tested, ghost edge cancellable, agent loop iteration cap tested, multi-instance verified).

### Critical-phase adversarial review

Phases 1, 6, 8 require an additional pass: re-read the diff as a senior engineer reviewing this PR for the first time. List specific concerns and suggested improvements. Examples:

- Is the abstraction at the right level?
- Are there untested edge cases? List them.
- Is there duplication suggesting an extraction?
- Is naming clear without context?
- Are functions doing too much?
- Are error messages useful to consumers (or LLM)?

### Output format

Produce a markdown report:

```markdown
## Self-Review: <phase or chunk name>

### Universal rubric

- ✅ typecheck: clean
- ✅ lint: clean (0 warnings)
- ⚠️ tests: 47 pass, 0 fail (added 12 new tests for cascade delete)
- ✅ no forbidden patterns
- ...

### Phase-specific rubric

- ✅ cascade delete tested in both directions
- ✅ all 4 connection validation rules surfaced as structured errors
- ...

### Adversarial review (if applicable)

- Concern: `applyMutations` doesn't validate the mutation kind before dispatching. Risk: invalid mutations from LLM crash the store. Suggest: add validation at the entry point.
- ...

### Notes

- Skipped: animated edge appearance (Tier 2). Will revisit in Phase 9.
- Discovered: ResizeObserver fires twice on initial mount. Investigated, expected behavior, no action needed.
```

After the report: **wait for explicit approval before committing.** If any rubric item is FAIL, propose a fix. If you waived an item, justify it.

---

## 11. Commit conventions

### Format

Conventional Commits, enforced by commitlint:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`.

**Scopes:** `store`, `canvas`, `panels`, `llm`, `wc`, `infra`, `deps`, `a11y`, `nodes`, `utils`, `state`, `server`, `demo`, `tooling`, `claude`, `ci`. Empty scope is allowed (e.g. `chore: scaffold ...`). The full enforced list lives in `commitlint.config.js`.

**Subject:** imperative mood, lowercase, no period, ≤72 chars. "add cascade delete to nodes slice" not "Added Cascade Delete to Nodes Slice."

**Body** (optional): why, not what. Wrap at 80. Reference rubric verification (`verified: typecheck/lint/tests pass`).

**Footer** (optional): `BREAKING CHANGE: ...`, `Refs: #N`.

### Rules

- One logical change per commit. Mixing concerns is a defect.
- Tests and implementation often go in separate commits when TDD: `test(store): ...` then `feat(store): ...`.
- No "WIP" or "fix typo" commits in the final history. Squash before push.
- No `git add .`. Stage deliberately.

---

## 12. Working agreement

### Before implementing

- For any phase or multi-file change, **summarize the implementation plan in 5-7 bullets first.** Wait for explicit approval before writing code.
- For TDD layers, **show the failing tests first.** Wait for approval before implementing.
- If a request conflicts with PLAN.md, CLAUDE.md, or decisions.md, **ask for clarification rather than guess.**
- If the request is underspecified, **list the assumptions you'd make and ask which apply.**

### During implementation

- Stay within scope of the current phase. Do not preemptively implement Tier 2/3 work unless explicitly approved.
- If you discover a problem outside the current scope, note it in the self-review report's "Notes" section. Do not silently fix.
- Do not add dependencies without asking (unless on the pre-approved list in §6).
- Do not modify CLAUDE.md, PLAN.md, or decisions.md without explicit instruction.
- If a hook or quality gate fails, **fix the underlying issue.** Do not bypass with `--no-verify`, `--no-check`, etc.

### After implementation

- Run all quality gates locally before claiming done.
- Produce the self-review report per §10.
- Wait for approval before committing.
- After commit, summarize what was done and what's next.

### When stuck

- After two failed attempts at the same problem, **stop and report.** Describe what you tried, what failed, and propose alternatives. Do not keep trying variations.
- Never lower standards to make code "work." If tests are flaky, find the cause. If types resist, design out the resistance. Don't reach for `any` or `.skip`.

---

## 13. AI workflow documentation

This project is built with extensive AI assistance and the process is documented as a first-class deliverable.

After significant interventions (course corrections, prompt iterations, decisions made during a session), the user may add an entry to `docs/ai-workflow.md`. You do not write this file unless explicitly asked — it captures the user's perspective on how AI was used.

You may write to `docs/ai-prompts.md` (system prompts, tool schemas, sanitized example transcripts) when those artifacts are produced as part of phase work.

---

## 14. What "done" means

A phase or task is done when:

- All Tier 1 deliverables for the phase are implemented (per PLAN.md)
- All quality gates pass (typecheck, lint, tests, build) with zero warnings
- Test coverage thresholds met
- Self-review report produced and approved
- Conventional commits made with proper scopes
- Documentation obligations for the phase completed (per PLAN.md table)
- No TODOs, no commented-out code, no `.skip`/`.only` in tests
- README updated if user-facing behavior changed

"Mostly works" is not done. "Tests pass on my machine" is not done. The CI must be green.

---

## 15. Escalation

Ask the user when:

- A locked decision in decisions.md seems wrong for the current task
- An invariant in this file conflicts with making the code work
- A new dependency is needed and isn't pre-approved
- Scope is ambiguous between Tier 1 and Tier 2
- A test is unfixable without changing the spec
- The product requirements seem to demand something the plan didn't account for

Do not ask when:

- Choosing between two equivalent implementations within the rules
- Routine style decisions covered by linter
- Routine naming decisions covered by §5

---

## End of CLAUDE.md
