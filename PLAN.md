# PLAN.md

## Project: AI-Powered BPMN Workflow Editor

A reusable, embeddable Web Component implementing a minimal BPMN-like workflow editor with an integrated AI chatbot for natural-language workflow editing. The component is designed to be dropped into any host page — insurance back-office tools, claims dashboards, internal admin UIs — and edited via natural language using a domain-aware LLM.

This document is the source of truth for what we're building, in what order, and to what standard. Claude Code reads this at the start of every session alongside CLAUDE.md.

---

## 1. Hard constraints

- **Stack**: React + TypeScript
- **AI integration**: Real LLM API (Anthropic Claude via tool use)
- **No BPMN libraries**: built from scratch, no bpmn-js or similar
- **State management**: Zustand
- **Setup**: Automated, single-command (Makefile + Docker)
- **Commit history**: production-grade, conventional commits
- **Repository**: Git, with CI/CD and pre-commit hooks

---

## 2. Architecture summary

```
┌─────────────────────────────────────────────────────────────┐
│  Host page (any framework or plain HTML)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  <workflow-editor>  (Custom Element)                  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Shadow DOM                                     │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │  React app                               │   │  │  │
│  │  │  │  ├── Toolbar (add menu, import/export)   │   │  │  │
│  │  │  │  ├── Canvas (HTML nodes + SVG edges)     │   │  │  │
│  │  │  │  ├── Properties Panel (node editing)     │   │  │  │
│  │  │  │  └── Chat Panel (AI assistant)           │   │  │  │
│  │  │  │                                          │   │  │  │
│  │  │  │  State: workflow + ui + chat stores      │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ HTTPS POST /api/chat
                  ┌────────────────────────┐
                  │  Hono proxy server     │
                  │  (Anthropic SDK)       │
                  └────────────────────────┘
                            │
                            ▼
                  ┌────────────────────────┐
                  │  Claude Sonnet 4.5     │
                  │  (tool_use)            │
                  └────────────────────────┘
```

**Key architectural decisions** (full reasoning in `docs/decisions.md`):

- Native Custom Element wrapping React app inside Shadow DOM
- Three-store architecture: workflow (domain), ui (ephemeral), chat (async)
- Slice pattern within workflow store; Records over arrays; immer + devtools + persist + temporal + subscribeWithSelector middleware
- Hybrid HTML+SVG canvas (HTML divs for nodes, SVG overlay for edges)
- LLM via server-side proxy with structured tool_use; never browser-side SDK
- Atomic tool schema (1:1 with store actions) over freeform JSON patches
- Multi-instance support via store factory pattern from day one

---

## 3. Locked decisions (full reasoning in docs/decisions.md)

| #   | Decision                     | Choice                                                               |
| --- | ---------------------------- | -------------------------------------------------------------------- |
| 001 | Web Component interpretation | Native Custom Element wrapping React                                 |
| 002 | Store data structure         | Records keyed by ID                                                  |
| 003 | State architecture           | 3 stores (workflow / ui / chat) with slice pattern                   |
| 004 | Canvas rendering             | HTML + SVG hybrid                                                    |
| 005 | Connection interaction       | Drag-to-connect with pointer capture                                 |
| 006 | Viewport                     | Pan only (no zoom in v1)                                             |
| 007 | Style isolation              | Shadow DOM with constructable stylesheets                            |
| 008 | LLM API key handling         | Server-side proxy only                                               |
| 009 | LLM tool schema              | Atomic tools (1:1 with store actions)                                |
| 010 | Agent loop                   | Non-streaming, 5-iteration cap, batched mutations                    |
| 011 | React Query                  | Declined for v1                                                      |
| 012 | Zustand middleware           | immer + devtools + persist + temporal + subscribeWithSelector        |
| 013 | Testing strategy             | Tiered TDD: vitest + RTL + MSW + Playwright                          |
| 014 | Self-review                  | Structured rubric per phase, adversarial review on critical phases   |
| 015 | Visual design                | Lightweight tokens, Tailwind, no UI lib                              |
| 016 | Accessibility                | WCAG 2.2 AA target                                                   |
| 017 | Error handling               | Result types in store + ErrorBoundary + toast system                 |
| 018 | WC public API                | Attributes + properties + CustomEvents, fully documented             |
| 019 | Multi-instance               | Supported via store factory pattern (Tier 1)                         |
| 020 | Packaging                    | Vite library mode, single JS bundle                                  |
| 021 | Security                     | XSS via React defaults, JSON validation, prompt injection mitigation |
| 022 | Performance budget           | 200KB gzipped, ≤500ms TTI, 60fps drag@50 nodes                       |
| 023 | Responsive design            | Container queries, three breakpoints, ≥600px supported               |

Twenty-three locked decisions. Each has an ADR in `docs/decisions.md`.

---

## 4. Domain model

```typescript
type NodeKind = 'start' | 'end' | 'task' | 'custom';

type CustomNodeType =
  | 'createAccount'
  | 'createPolicy'
  | 'createDocument'
  | 'sendEmail'
  | 'verifyPolicy'
  | 'assessDamage'
  | 'calculatePayout'
  | 'approveClaim'
  | 'denyClaim';

interface WorkflowNode {
  id: string;
  kind: NodeKind;
  customType?: CustomNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    variables: Record<string, string | number | boolean>;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface WorkflowState {
  nodes: Record<string, WorkflowNode>;
  edges: Record<string, WorkflowEdge>;
}
```

**Connection validation rules** (enforced; return structured errors):

1. No self-loops
2. No duplicate edges
3. Start nodes cannot be a target
4. End nodes cannot be a source

---

## 5. Performance budget

| Metric                                   | Target  | Verified in |
| ---------------------------------------- | ------- | ----------- |
| Initial bundle (gzipped)                 | ≤ 200KB | Phase 9     |
| Time to interactive (demo page)          | ≤ 500ms | Phase 9     |
| Drag frame rate (50 nodes)               | 60fps   | Phase 2/9   |
| LLM perceived latency (simple request)   | ≤ 3s    | Phase 7     |
| Memory leak across 100 add/remove cycles | None    | Phase 9     |

Verification methodology: Chrome Performance tab + React Profiler. Numbers documented in `docs/performance.md` (Tier 2).

---

## 6. Build phases

Each phase ends with: tests passing, typecheck clean, lint clean, build succeeding, self-review report, commit. Phases are sequential — do not parallelize.

For each phase, **Tier 1** items are required to complete the phase. **Tier 2** items are added if time permits within the phase. **Tier 3** items deferred to appendix.

---

### Phase 0 — Repo foundation

**Goal:** All scaffolding, tooling, guardrails, and CI in place. No app code.

**Tier 1 deliverables:**

- Vite + React + TypeScript (strict) + Tailwind installed
- Zustand + immer + zundo installed
- ESLint with strict rules: `no-explicit-any`, `no-non-null-assertion`, `no-console`, `no-restricted-imports` (forbid bpmn-js, react-flow, redux)
- Prettier configured
- Husky + lint-staged + commitlint installed; pre-commit runs typecheck + lint + tests
- `.gitmessage` template, conventional commits enforced
- `.claude/settings.json` with permission allow/deny/ask lists, hooks for forbidden imports and post-edit typecheck
- GitHub Actions CI workflow: typecheck, lint, test, build
- Folder structure as specified in CLAUDE.md
- `.env.example` with `ANTHROPIC_API_KEY` and `VITE_API_ENDPOINT`
- `.gitignore` includes `.env`, `dist`, `node_modules`, `coverage`
- `Makefile` with: install, dev, test, build, docker-build, docker-run, up, clean
- `package.json` scripts: dev, build, preview, test, test:watch, test:cov, typecheck, lint, lint:fix, format, e2e
- README stub
- `docs/ai-workflow.md` and `docs/ai-prompts.md` skeletons

**Definition of done:**

- `make install && make test` runs and passes (no app code yet, but linters and config are exercised)
- `make build` produces an empty-but-valid bundle
- CI is green on first push
- Pre-commit hook blocks a deliberately broken commit
- `git log` shows conventional commits with proper scopes

**Tier 2 add-ons:** None. Foundation is foundation.

**Estimated time:** 1.0h realistic, 1.5h bad-day

**Commit sequence:**

1. `chore: scaffold vite + react + ts`
2. `chore(deps): add zustand, immer, zundo, tailwind`
3. `chore(tooling): add eslint, prettier with strict rules`
4. `chore(tooling): add husky, lint-staged, commitlint`
5. `chore(claude): add CLAUDE.md guardrails and .claude/settings.json`
6. `chore(ci): add github actions workflow`
7. `chore(infra): add Makefile and .env.example`
8. `docs: add PLAN.md, decisions.md, ai-workflow.md skeletons`

---

### Phase 1 — Domain model + Zustand stores

**Goal:** Three stores fully implemented with TDD. Store is the spec for the rest of the app.

**Tier 1 deliverables:**

- `src/state/workflow/types.ts` — Node, Edge, State types
- `src/state/workflow/validators.ts` — `canConnect`, returns `{ ok: true } | { ok: false, reason: string }`
- `src/state/workflow/slices/nodesSlice.ts` — addNode, updateNode, moveNode, removeNode (cascade-aware)
- `src/state/workflow/slices/edgesSlice.ts` — connectNodes, removeEdge, removeEdgesForNode
- `src/state/workflow/slices/ioSlice.ts` — exportJSON, importJSON (with schema validation), applyMutations, clear
- `src/state/workflow/workflowStore.ts` — composes slices with middleware stack
- `src/state/workflow/factory.ts` — `createWorkflowStore()` for multi-instance support (ADR-019, Tier 1)
- `src/state/workflow/selectors.ts` — selectNodeById, selectNodeIds, selectEdgesForNode, selectEdgesByNode (useShallow)
- `src/state/ui/uiStore.ts` — selection, hover, viewport, isConnecting, panel open/close states
- `src/state/chat/chatStore.ts` — messages, status, error, abortController, sendMessage stub (no LLM yet), cancelInFlight
- `src/test/factories.ts` — buildNode, buildEdge, buildWorkflow helpers
- Test files for every slice, validator, selector, and IO operation
- JSON round-trip test (export → import → export produces identical output)
- Coverage: ≥90% on `src/state/workflow/**`

**Definition of done:**

- All store tests green
- All validators have tests for every rule (positive + negative cases)
- `removeNode` cascade-deletes edges in both directions, tested
- `connectNodes` returns structured errors for all four validation rules
- `importJSON` rejects malformed input with a structured error
- `applyMutations` batches multiple operations into a single store update
- Coverage threshold met
- Self-review rubric passed (state-specific rubric items)

**Tier 2 add-ons:**

- Adversarial diff review (this is a Tier 1+ critical phase per ADR-014)
- Selectors with memoization for derived data (reachable nodes, etc.)

**Estimated time:** 1.5h realistic, 2.5h bad-day

**Commit sequence (test commits separate from impl):**

1. `test(store): add tests for node CRUD and validators`
2. `feat(store): implement nodes slice`
3. `test(store): add tests for edge CRUD and cascade`
4. `feat(store): implement edges slice with cascade delete`
5. `test(store): add tests for JSON IO and applyMutations`
6. `feat(store): implement IO slice with schema validation`
7. `feat(store): compose store with middleware and factory`
8. `feat(state): add ui and chat stores`

---

### Phase 2 — Canvas + node rendering + drag

**Goal:** Visible, draggable nodes. No edges yet.

**Tier 1 deliverables:**

- `src/canvas/Canvas.tsx` — root container with pan via translate3d
- `src/canvas/Node.tsx` — React.memo'd node component, subscribes per-id
- `src/utils/geometry.ts` — coordinate transforms (screen ↔ world), with tests
- `src/utils/pointer.ts` — rAF-throttled pointer handler hook, with tests
- Node rendering: shape + color + icon per kind, hover state, selected ring
- 9 insurance custom node visuals with Lucide icons + accent bars
- Node drag with `setPointerCapture` and rAF throttling
- Pan (drag empty canvas) with translate3d
- Selection state in ui store, toggled on click
- Empty canvas state: centered text "Add a node from the toolbar to get started"
- **Minimal responsive layer** (Tier 1): editor works at any container width ≥600px; below 900px, properties panel becomes a bottom area instead of a side panel
- **WCAG core** (Tier 1): nodes are focusable (`tabindex=0`), arrow keys move focus between nodes, Delete key removes focused node, focus rings visible, `prefers-reduced-motion` respected, ARIA roles (canvas as `application`, nodes as `button` with aria-label describing kind+label)
- Component tests: Node renders correctly, isolated re-render verified
- Coverage on `src/utils/**`: ≥95%

**Definition of done:**

- All 12 node types (3 basic + 9 custom) visually distinct, polished
- Drag is 60fps on 50 nodes (verified)
- Selection works via mouse and keyboard
- Empty state visible until first node added
- Container reflow works at ≥600px width
- Self-review rubric passed (canvas-specific)

**Tier 2 add-ons:**

- Container queries with three breakpoints (compact / standard / spacious)
- Touch pointer adaptation (`data-pointer="coarse"`, larger handles)
- Animation: node appearance scale-fade (200ms, respects reduced-motion)
- AI-added node pulse highlight (set up the mechanism, used in Phase 7)

**Estimated time:** 2.0h realistic, 3.0h bad-day

**Commit sequence:**

1. `feat(canvas): add canvas container with pan`
2. `test(utils): add geometry and pointer hook tests`
3. `feat(utils): add geometry helpers and rAF pointer hook`
4. `feat(canvas): render basic nodes with selection`
5. `feat(canvas): node drag with pointer capture`
6. `feat(nodes): add insurance custom node variants with icons`
7. `feat(a11y): keyboard navigation and ARIA on nodes`

---

### Phase 3 — Edges + connection drag

**Goal:** Build connected workflows visually.

**Tier 1 deliverables:**

- `src/canvas/Edge.tsx` — React.memo'd edge component, subscribes to source+target positions only
- `src/canvas/ConnectionLayer.tsx` — SVG overlay layer
- `src/canvas/GhostEdge.tsx` — in-progress connection rendering during drag
- Bezier path generation with cubic curves
- Connection handles on nodes (input left, output right; only output for start, only input for end)
- Drag-to-connect: pointerdown on output handle starts drag, pointerup on input handle calls `connectNodes`, escape cancels
- Edge selection (click) and deletion (Delete key on selected edge)
- Edge cleanup on node delete (verified via cascade test from Phase 1)
- Component test: Edge re-renders only when source or target moves, not on unrelated state changes
- **WCAG core** (Tier 1): keyboard alternative for connection — focus source node, press 'C' to enter connect mode, focus target, press Enter to connect; ARIA description on edges via `aria-describedby` on connected nodes
- Validation errors during connection drag show toast or inline message

**Definition of done:**

- Drag-to-connect works smoothly with no dropped frames
- Ghost edge follows cursor during drag
- All four validation rules surface to UI when violated
- Keyboard connection alternative works
- Edge re-render isolation verified
- Self-review rubric passed

**Tier 2 add-ons:**

- Animated edge appearance (stroke-dasharray reveal)
- Edge hover state with thicker stroke

**Estimated time:** 1.5h realistic, 2.5h bad-day

**Commit sequence:**

1. `test(canvas): add edge component tests`
2. `feat(canvas): render edges with bezier paths`
3. `feat(canvas): drag-to-connect with ghost edge`
4. `feat(canvas): edge selection and deletion`
5. `feat(a11y): keyboard connection mode`

---

### Phase 4 — Toolbar + node palette

**Goal:** Add menu and import/export controls.

**Tier 1 deliverables:**

- `src/panels/Toolbar.tsx` — top bar layout
- Add menu (dropdown): Start, End, Task divider, then 9 insurance custom nodes with icons
- Import button: opens file picker, calls `importJSON`, shows toast on error
- Export button: downloads JSON file
- Clear button: confirm dialog, calls `clear`
- **WCAG core** (Tier 1): toolbar role, keyboard menu navigation (Tab to button, Enter/Space to open, arrow keys to navigate items, Escape to close), focus management
- Component tests for Toolbar interactions

**Definition of done:**

- All 12 node types addable from menu
- Import/export round-trip works for a multi-node workflow
- Keyboard fully operates the toolbar
- Self-review rubric passed

**Tier 2 add-ons:**

- Toast system for transient errors (used for import failures, validation errors)
- Undo/redo buttons (leveraging temporal middleware)

**Estimated time:** 0.75h realistic, 1.0h bad-day

**Commit sequence:**

1. `feat(panels): toolbar with add menu and io buttons`
2. `feat(a11y): toolbar keyboard navigation and ARIA`

---

### Phase 5 — Properties panel

**Goal:** Edit node label and variables.

**Tier 1 deliverables:**

- `src/panels/PropertiesPanel.tsx` — right-side panel (Tier 1) or bottom area (compact mode)
- Shown when a node is selected; hidden otherwise
- Label input: text field bound to `updateNode`
- Variables editor: list of rows with key input, type select (string/number/boolean), value input, delete button, "+ Add variable" button
- Local component state for in-progress edits, sync to store on blur
- **WCAG core** (Tier 1): visible labels (not placeholder-only), focus moves to label input on panel open, errors announced via aria-describedby
- Component tests for variables editor (the trickiest UI in the app)

**Definition of done:**

- Selecting a node opens the panel; deselecting closes it
- Label edits persist
- Variables can be added, edited, deleted
- Type change converts the value sensibly (or clears it)
- Keyboard fully operates the panel
- Self-review rubric passed

**Tier 2 add-ons:**

- Bottom-drawer animation in compact mode
- Form validation feedback (e.g., duplicate variable keys)

**Estimated time:** 1.0h realistic, 1.5h bad-day

**Commit sequence:**

1. `test(panels): add properties panel and variables editor tests`
2. `feat(panels): properties panel with label editing`
3. `feat(panels): variables editor with type select`
4. `feat(a11y): properties panel labels and focus management`

---

### Phase 6 — LLM proxy + executor + tools

**Goal:** Natural language modifies the workflow end-to-end (testable via curl, no chat UI yet).

**Tier 1 deliverables:**

- `server/proxy.ts` — Hono server with one POST `/api/chat` endpoint
- Reads `ANTHROPIC_API_KEY` from env, uses `@anthropic-ai/sdk`
- Forwards request to Claude Sonnet 4.5 with tools and system prompt
- Returns response unchanged
- Structured logging (timestamp, request ID, status, duration, NOT content)
- `src/llm/tools.ts` — five tool schemas: add_node, connect_nodes, update_node, remove_node, insert_between
- `src/llm/systemPrompt.ts` — system prompt with insurance domain context, current workflow state injection, tool usage guidelines, prompt injection mitigation (workflow state in `<workflow_state>` tags with delimiter instruction)
- `src/llm/executor.ts` — `applyToolCall(toolCall, store)` returns `{ ok: true, ... }` or `{ ok: false, error }`
- `src/llm/agentLoop.ts` — iterates LLM calls until no tool_use blocks or 5 iterations, applies tool calls via store, sends tool_results back
- `src/llm/client.ts` — fetch wrapper, AbortController support
- MSW handlers for the proxy in `src/test/handlers.ts`
- Tests: every tool execution path, agent loop iteration cap, abort handling, error paths
- Coverage on `src/llm/**`: ≥90%
- A debug button or curl recipe in README to test before chat UI exists

**Definition of done:**

- Test request via curl modifies the workflow as expected
- All tool execution paths tested with MSW
- Agent loop terminates cleanly (success, error, abort, iteration cap)
- API key never appears in client bundle (verified with grep on dist/)
- Self-review rubric passed
- Adversarial diff review completed (this is a critical phase per ADR-014)

**Tier 2 add-ons:**

- Auto-layout for AI-added nodes (simple horizontal cascade based on existing positions)
- Token cost logging in proxy logs

**Estimated time:** 1.5h realistic, 2.5h bad-day

**Commit sequence:**

1. `test(llm): add tool executor and validator tests`
2. `feat(llm): tool schemas and system prompt`
3. `feat(llm): tool executor mapping to store actions`
4. `test(llm): add agent loop tests with MSW`
5. `feat(llm): agent loop with iteration cap and abort`
6. `feat(server): hono proxy with structured logging`
7. `docs(llm): add curl test recipe to README`

---

### Phase 7 — Chat panel + integration

**Goal:** End-to-end natural language workflow editing through UI.

**Tier 1 deliverables:**

- `src/panels/ChatPanel.tsx` — floating bottom-right panel (Tier 1) or bottom-sheet (compact mode)
- Message list rendering: user, assistant, system messages
- Tool-call summaries inline ("✓ Added 3 nodes", "✓ Connected Verify Policy → Send Email")
- Input field + send button
- Pending state: spinner + disabled input during LLM call
- Cancel button during pending state
- Error states: network errors, iteration cap, LLM errors all surfaced as system messages
- AI-added node visual feedback (pulse highlight per Phase 2 mechanism)
- **WCAG core** (Tier 1): aria-live="polite" region for assistant messages, focus stays in input after send, Escape closes panel, ARIA labels on all controls
- Integration test: full happy-path with mocked LLM (chat input → tool calls → workflow modified → message rendered)

**Definition of done:**

- All three canonical insurance scenarios work end-to-end:
  - "Add steps for a denied claim due to policy expiration"
  - "What are the tasks needed to process a standard car accident claim?"
  - "Insert a Task to 'Verify Policy Coverage' right after the Start event"
- Errors are user-visible and actionable
- Cancel works mid-request
- Self-review rubric passed

**Tier 2 add-ons:**

- Bottom-sheet animation in compact mode
- Persisted chat history in localStorage (cleared on workflow reset)
- Token usage shown in chat for transparency

**Estimated time:** 1.0h realistic, 1.5h bad-day

**Commit sequence:**

1. `test(panels): add chat panel tests with mocked llm`
2. `feat(panels): chat panel with message rendering`
3. `feat(panels): chat input with cancel and error states`
4. `feat(canvas): pulse highlight for ai-added nodes`
5. `feat(a11y): chat live region and focus management`

---

### Phase 8 — Web Component wrapper

**Goal:** `<workflow-editor>` works embedded in any HTML page, supports multiple instances.

**Tier 1 deliverables:**

- `src/web-component/WorkflowEditorElement.ts` — extends HTMLElement
- Shadow DOM with constructable stylesheets (Tailwind CSS imported via Vite `?inline` and adopted)
- `connectedCallback`: create React root, mount App with a fresh store from `createWorkflowStore()`
- `disconnectedCallback`: unmount React root, clean up subscriptions
- `observedAttributes`: `initial-workflow`, `api-endpoint`, `theme` (future)
- Public properties (with getter/setter): `workflow` (gets/sets full workflow state)
- Public methods: `getWorkflow()`, `setWorkflow(json)`, `clear()`, `addNode(input)`
- CustomEvents emitted: `workflow-change`, `node-selected`, `chat-message`, `error`
- `customElements.define('workflow-editor', WorkflowEditorElement)`
- `demo.html` (Tier 1): plain HTML page with one `<workflow-editor>`, an event log panel showing emitted events, two buttons (programmatic getWorkflow, programmatic addNode)
- Vite library mode build config: `vite build --mode wc` produces `dist/workflow-editor.js`
- `docs/api.md` (Tier 1 minimum): table of attributes, properties, methods, events with one-line descriptions and a usage example
- Smoke test: WC mounts in jsdom, fires connected/disconnected callbacks, multi-instance test (two elements, independent state)

**Definition of done:**

- demo.html opens in a browser and works without React or any build step on the host page
- Two `<workflow-editor>` elements on demo.html have independent state (verified)
- Public API exercised in demo.html buttons
- Events fire and are caught by demo's event log
- Build outputs a single JS file consumable via `<script>`
- Self-review rubric passed
- Adversarial diff review completed (critical phase per ADR-014)

**Tier 2 add-ons:**

- Resizable splitter on demo.html showing live reflow
- Two side-by-side editors at different widths on demo.html
- WC-level accessibility verified (ARIA works across shadow DOM boundary)
- API examples in `docs/api.md` for common consumer scenarios

**Estimated time:** 1.5h realistic, 3.0h bad-day

**Commit sequence:**

1. `feat(wc): web component class with shadow dom`
2. `feat(wc): mount react app with per-instance store`
3. `feat(wc): public api - attributes, properties, events`
4. `feat(wc): vite library mode build config`
5. `feat(demo): demo.html with event log and api buttons`
6. `test(wc): multi-instance smoke tests`
7. `docs(api): web component public api reference`

---

### Phase 9 — Polish, docker, docs, release

**Goal:** Release-ready v1.

**Tier 1 deliverables:**

- `Dockerfile`: multi-stage, builds proxy + serves static bundle
- `docker-compose.yml` (or single Dockerfile): proxy + static server in one command
- `make up` runs everything cleanly from a fresh clone
- README finalized:
  - What it is, screenshot or short GIF
  - Quick start: `git clone`, set `ANTHROPIC_API_KEY`, `make up`, open URL
  - Architecture summary (one paragraph + diagram)
  - Tech choices justified briefly
  - Cross-links to `docs/decisions.md`, `docs/ai-workflow.md`, `docs/ai-prompts.md`, `docs/api.md`
  - Browser support, responsive scope, accessibility scope
  - Performance summary (numbers)
  - Roadmap / "what's next"
  - AI usage notes
  - Repo orientation guide (where to find what)
- `docs/ai-workflow.md` finalized:
  - Approach summary
  - Planning phase
  - Guardrails
  - 2-3 specific intervention examples
  - What could be done differently
  - Token usage notes
- `docs/ai-prompts.md` finalized:
  - Full system prompt with annotations
  - Full tool schemas with rationale per tool
  - 2-3 sanitized example transcripts
- `docs/decisions.md` finalized: 23 ADRs
- Final pass: `make up` from a fresh clone, follow README, verify it works
- Final commit hygiene: clean log, no fixup commits, all conventional

**Definition of done:**

- Anyone can `git clone`, `make up`, open URL, use editor and chat — verified
- All Tier 1 items from prior phases ship
- Docs cross-linked and consistent
- Repo is release-ready: README, docs, working setup
- Self-review rubric passed

**Tier 2 add-ons:**

- `docs/accessibility.md` (keyboard map, SR notes, WCAG conformance summary)
- `docs/performance.md` (budget, achieved numbers, methodology)
- `docs/security.md` (threat model, mitigations, gaps)
- `docs/self-reviews/` directory with phase reports
- axe-core in CI (vitest-axe component tests across components)
- Manual keyboard pass documented
- Manual SR spot-check documented
- Touch device test documented (if available)

**Estimated time:** 1.5h realistic, 2.5h bad-day

**Commit sequence:**

1. `chore(infra): add Dockerfile and docker-compose`
2. `docs: finalize README with quick start and architecture`
3. `docs: finalize decisions.md with all ADRs`
4. `docs: finalize ai-workflow.md with examples`
5. `docs: finalize ai-prompts.md with transcripts`
6. `chore: final cleanup for v1 release`

---

### Phase 10 — Vercel deployment

**Goal:** The demo page live on a Vercel URL, chat working end-to-end, API key server-side only.

**Tier 1 deliverables:**

- `api/chat.ts`: Vercel serverless entry — builds the Anthropic client and logger from `process.env`, calls `createApp()` (no `staticRoot`; the CDN serves static files), exports `handle(app)` via Hono's `hono/vercel` adapter. `server/proxy.ts`, Docker, and local dev remain untouched.
- `vercel.json`: build command runs `npm run build:wc` and stages `dist-vercel/` (demo.html copied as `index.html`, `dist-wc/` alongside so the relative script path keeps working); `outputDirectory: dist-vercel`; `maxDuration` raised on `api/chat.ts` (the agent loop makes up to 5 sequential model calls — the 10s default would cut real chats off).
- `demo.html`: `api-endpoint` changed from `http://localhost:3001/api/chat` to same-origin `/api/chat`; header blurb reworded. Improves the Docker image too (already same-origin).
- `.gitignore`: `dist-vercel/` added.
- README: "Deploy to Vercel" section — import repo, set `ANTHROPIC_API_KEY`, bound abuse exposure (Deployment Protection or provider spend cap, per ADR-024 as amended), push to main.
- One-time dashboard setup (user-performed, documented not scripted): import `husnukirci/floweave`, framework preset "Other", env var, abuse-exposure choice.

**Definition of done:**

- Preview or production deploy verified: page loads, chat round-trip completes, `/api/chat` returns structured errors on bad input
- `ANTHROPIC_API_KEY` absent from the client bundle (grep post-build, per ADR-021)
- Abuse exposure bounded: deployment protection enabled, or open deployment accepted with a provider-side spend cap (ADR-024 amendment)
- Push to `main` auto-deploys; PRs get preview deploys; CI stays the merge gate
- Self-review rubric passed

**Tier 2 add-ons:**

- Custom domain
- Rate limiting in the Hono app (narrows ADR-021's known gap for the public deployment)

**Estimated time:** 1h realistic, 2h bad-day

**Commit sequence:**

1. `docs: add phase 10 vercel deployment plan and ADR-024`
2. `feat(server): add vercel serverless entry for the llm proxy`
3. `chore(infra): add vercel build config and output staging`
4. `fix(demo): use same-origin api endpoint in demo page`
5. `docs: add vercel deployment section to README`

---

## 7. Tier 3 (stretch) appendix

Pursue only if Phase 9 finishes with substantial time remaining. Listed in priority order:

1. **Playwright E2E tests** — 1-2 happy paths (manual workflow build, chatbot insert)
2. **demo.html resizable splitter** — show responsive reflow live
3. **Workflow templates** — 2-3 example workflows loadable from a "Load example" menu
4. **Auto-layout for AI-generated nodes** — simple cascade, not full dagre
5. **Visual flourishes** — pulse on AI-added nodes (if not already in Tier 1), animated edge dashes, subtle micro-interactions
6. **Undo/redo UI** — toolbar buttons (Cmd+Z works without UI via temporal)
7. **Token usage display** — show cumulative cost in chat
8. **2-minute Loom walkthrough** — narrated demo

None of these are required. Each is "nice if shipped, invisible if absent."

---

## 8. Risk register

Risks identified upfront with mitigations:

| Risk                                      | Likelihood | Impact | Mitigation                                                                                             |
| ----------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Tailwind + Shadow DOM friction            | High       | High   | Vite `?inline` CSS pattern; constructable stylesheets; documented fallback to light DOM with reasoning |
| Drag-to-connect math edge cases           | Medium     | Medium | Pointer capture, escape-cancels, comprehensive component tests                                         |
| LLM tool-use returning malformed input    | Medium     | Medium | Validate tool inputs before applying; structured errors back to LLM as tool_results                    |
| Agent loop runaway                        | Low        | High   | Hard 5-iteration cap with surfaced error                                                               |
| Multi-instance state leakage              | Medium     | High   | Store factory from day one; multi-instance smoke test in Phase 8                                       |
| Performance degradation at 50+ nodes      | Low        | Medium | Selector isolation by design; React Profiler verification in Phase 9                                   |
| Time overrun                              | High       | Medium | Tier 1/2/3 cut list; checkpoint at hours 4, 8, 11                                                      |
| Shadow DOM portal issues (toasts, modals) | Medium     | Low    | Render portal targets inside shadow root; document                                                     |

---

## 9. Out of scope (explicit)

State these in the README under "Scope":

- Phone-class viewports (<600px); recommend dedicated full-screen view instead
- Zoom (only pan in v1)
- Multi-user collaboration / real-time sync
- Server-side workflow persistence
- Authentication / authorization
- Internationalization (English only)
- Streaming chat responses
- Dark mode / theming
- Workflow execution / runtime engine (this is an editor, not an orchestrator)
- BPMN 2.0 XML compatibility (we model BPMN-like, not BPMN-strict)
- Mobile-specific gestures

---

## 10. Documentation obligations per phase

| Phase | Doc obligation                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| 0     | PLAN.md, CLAUDE.md, decisions.md skeleton, README stub committed                                                          |
| 1     | ADRs 002, 003, 010, 012 finalized                                                                                         |
| 2     | ADR 004 finalized                                                                                                         |
| 3     | ADR 005 finalized                                                                                                         |
| 4     | (none)                                                                                                                    |
| 5     | (none)                                                                                                                    |
| 6     | ADRs 008, 009, 010, 021 finalized; ai-prompts.md initial draft                                                            |
| 7     | ADR 010 polish; ai-prompts.md transcripts added                                                                           |
| 8     | ADRs 001, 007, 018, 019, 020 finalized; api.md (Tier 1 minimum)                                                           |
| 9     | All remaining ADRs finalized; ai-workflow.md complete; README finalized; performance/accessibility/security docs (Tier 2) |
| 10    | ADR-024 finalized; README deploy section                                                                                  |

---

## 11. Self-review process

After every implementation chunk, before commit:

1. Run `make test` (typecheck + lint + tests + build). All green, zero warnings.
2. Produce self-review report against:
   - **Universal rubric** (see CLAUDE.md): compilation, code style, performance, architecture invariants, commit hygiene
   - **Phase-specific rubric** (this document, per phase)
3. For Phases 1, 6, 8 (critical phases): produce adversarial diff review as if a senior engineer were seeing the diff for the first time.
4. Wait for explicit approval before committing.
5. Failed rubric items: address or explicitly waive with justification.

Tier 1 minimum: rubric verification mentioned in commit message body (`verified: typecheck/lint/tests pass; cascade delete tested; ARIA roles verified`).
Tier 2 add-on: full reports stored in `docs/self-reviews/phase-N.md`.

---

## 12. Time discipline

| Hour | Checkpoint                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------- |
| 4    | End of Phase 2: store + canvas + drag working. If behind, drop Tier 3 entirely.                   |
| 8    | End of Phase 6: LLM working end-to-end via curl. If behind, start cutting Tier 2 from the bottom. |
| 11   | Stop building features. Whatever's done is done. Polish, document, ship.                          |
| 14   | Hard ceiling. Submit what you have.                                                               |

Cut order if behind, in priority sequence:

1. Loom walkthrough video
2. Workflow templates
3. Auto-layout for AI-generated nodes
4. Visual flourishes / animations
5. Undo/redo UI
6. demo.html splitter (static demo only)
7. `docs/security.md` (briefly mention in README instead)
8. Playwright E2E
9. Performance measurement (claim "verified manually")
10. Container-query responsive sheets (single drawer pattern instead)
11. Touch pointer adaptation
12. `docs/accessibility.md` (cover briefly in README instead)
13. Toast system (inline errors only)

Do not cut: Tier 1 items, store/LLM tests, decisions.md ADRs, WCAG keyboard core, WC public API doc.

---

## 13. Repository deliverables

The repo at v1 contains:

- `README.md` as entry point with quick start, architecture, scope
- `docs/decisions.md` (23 ADRs)
- `docs/ai-workflow.md` (narrative on AI-assisted development process)
- `docs/ai-prompts.md` (system prompt, tool schemas, transcripts)
- `docs/api.md` (Web Component public API reference)
- Tier 2: `docs/accessibility.md`, `docs/performance.md`, `docs/security.md`, `docs/self-reviews/`
- Tier 3: short walkthrough video

---

## End of PLAN.md
