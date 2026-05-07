# floweave

Embeddable Web Component for building BPMN-style workflows visually or by chatting with an AI assistant. Insurance-domain focus.

> 🚧 **In active development.** See [PLAN.md](./PLAN.md) for phase-by-phase progress and definition-of-done. The full `make up` flow lands in Phase 9.

## What it is

`<workflow-editor>` is a native Custom Element wrapping a React app inside Shadow DOM. It renders a pannable canvas of BPMN-like nodes (Start, Task, End, plus 9 insurance-specific custom node types) connected by curved edges. Users can drag nodes, draw connections, edit per-node properties (label and typed variables), import/export the workflow as JSON, and — through an integrated chat panel — describe changes in natural language and have the LLM materialize them as tool-driven workflow mutations.

## Quick start

```bash
nvm use            # Node 22 LTS via .nvmrc
make install       # npm ci + git hooks
make dev           # Vite dev server (Phase 2 onwards)
make dev-server    # Hono LLM proxy on :3001 — needed for the chat panel
make test          # typecheck + lint + tests
make build         # production bundle
```

`make dev` and `make dev-server` run side-by-side in two terminals during local development. Vite proxies `/api` to the Hono server, so `VITE_API_ENDPOINT` stays as the same-origin `/api/chat`.

The full demo (`make up`) is a Phase 9 deliverable — it will run the LLM proxy server alongside a static-served `demo.html` via Docker compose, so `git clone` + setting `ANTHROPIC_API_KEY` + `make up` is enough.

Run `make help` to list all available targets.

## Running the LLM proxy

The Hono server in `server/` is the only place an Anthropic API key is read. It exposes `POST /api/chat` (the agent-loop entry point) and `GET /healthz`. Source layout: `server/proxy.ts` (entry), `server/app.ts` (factory), `server/handlers/chat.ts` (handler), `server/logger.ts` (structured JSON logging).

### Set up

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
make dev-server      # logs to stdout as one JSON line per event
```

Optional environment variables:

| Var                 | Default             | Purpose                                                |
| ------------------- | ------------------- | ------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | _(required)_        | Server exits 1 with a structured error log if missing. |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6` | Override the model the proxy passes to the SDK.        |
| `PORT`              | `3001`              | Bind port. The Vite dev proxy expects `3001`.          |

### Smoke test with `curl`

Health check:

```bash
curl -s http://localhost:3001/healthz
# {"ok":true}
```

Single-turn chat (no tools — the simplest end-to-end check that the API key is valid):

```bash
curl -s http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{ "role": "user", "content": "Reply with exactly: pong" }]
  }'
```

Expected response shape (subset of Anthropic's Messages API):

```json
{
  "content": [{ "type": "text", "text": "pong" }],
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 14, "output_tokens": 4 }
}
```

Tool-use turn (asks the model to plan a workflow change — tool schemas come from `src/llm/tools.ts`):

```bash
curl -s http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{ "role": "user", "content": "Add a start node at (0, 0) and a task node at (220, 0)." }],
    "system": "You are a workflow editor assistant. Use the provided tools to make changes.",
    "tools": [
      {
        "name": "add_node",
        "description": "Add a new node.",
        "input_schema": {
          "type": "object",
          "properties": {
            "kind": { "type": "string", "enum": ["start", "end", "task", "custom"] },
            "position": {
              "type": "object",
              "properties": { "x": { "type": "number" }, "y": { "type": "number" } },
              "required": ["x", "y"]
            }
          },
          "required": ["kind", "position"]
        }
      }
    ]
  }'
```

Expected: `stop_reason: "tool_use"` with one or more `tool_use` blocks the client agent loop in `src/llm/agentLoop.ts` would apply via `applyToolCall`.

### Common errors

| Status                                     | Cause                                                                                  | Fix                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `400 invalid JSON body`                    | malformed request body                                                                 | check `-d` payload is valid JSON                                            |
| `400 'messages' must be a non-empty array` | empty or missing `messages`                                                            | include at least one user message                                           |
| `400 each message 'role' must be ...`      | unsupported role (`system` is sent via the top-level `system` field, not as a message) | use `user` or `assistant`                                                   |
| `502 upstream Anthropic API error`         | SDK call failed (bad key, rate limit, model id)                                        | check the proxy's `anthropic_error` log line and verify `ANTHROPIC_API_KEY` |
| Server exits with `startup_failed`         | `ANTHROPIC_API_KEY` missing or empty                                                   | set it in `.env` and restart                                                |

## Architecture

A native Custom Element registered as `<workflow-editor>`, mounting a React app inside a Shadow DOM. State is split across three Zustand stores (workflow / ui / chat). The canvas is HTML divs for nodes plus an SVG overlay for edges. The AI integration runs through a server-side Hono proxy that holds the Anthropic API key and orchestrates an iteration-capped tool-use loop.

Full reasoning behind each load-bearing choice lives in [docs/decisions.md](./docs/decisions.md) (23 ADRs in Michael Nygard format). The architecture diagram and component breakdown is in [PLAN.md §2](./PLAN.md#2-architecture-summary).

## Tech choices

| Area            | Choice                                                 | Rationale                                                                                              |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Component model | Native Custom Element wrapping React                   | True embeddability in any host page ([ADR-001](./docs/decisions.md))                                   |
| State           | Zustand × 3 stores, slice pattern, Records over arrays | O(1) lookup, fine-grained subscriptions, separate lifecycles ([ADR-002, ADR-003](./docs/decisions.md)) |
| Canvas          | HTML divs + SVG edges (hybrid)                         | Rich node content + clean bezier paths ([ADR-004](./docs/decisions.md))                                |
| Style isolation | Shadow DOM + constructable stylesheets, Tailwind v4    | Host CSS can't break the editor ([ADR-007, ADR-015](./docs/decisions.md))                              |
| LLM             | Server-side Hono proxy + Anthropic SDK + atomic tools  | API key never in the bundle, granular error recovery ([ADR-008, ADR-009](./docs/decisions.md))         |
| Build           | Vite library mode, single JS bundle                    | Drop-in `<script>` tag in any HTML page ([ADR-020](./docs/decisions.md))                               |

## Scope

**In:** pan-only canvas (no zoom), pointer-based interaction, drag-to-connect, JSON import/export, multi-instance support, container-query responsive design ≥600px container width, WCAG 2.2 AA, structured LLM tool use with iteration cap.

**Out** (deliberately, see [PLAN.md §9](./PLAN.md#9-out-of-scope-explicit)): phone-class viewports, zoom, multi-user collaboration, server-side persistence, auth, i18n, streaming chat, dark mode, BPMN 2.0 XML compatibility, workflow execution.

## Repo layout

```
src/
├── web-component/    # Custom Element wrapper (thin)
├── app/              # React entry (App, main)
├── state/            # Three Zustand stores
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
docs/                 # decisions, ai-workflow, ai-prompts, api
.claude/              # settings.json, hooks
.github/workflows/    # CI
```

The [CLAUDE.md](./CLAUDE.md) file (read by Claude Code at session start) covers the rules and invariants in detail.

## AI usage

This project is built with extensive AI assistance and the process is documented as a first-class deliverable:

- [docs/ai-workflow.md](./docs/ai-workflow.md) — narrative on how Claude was used, including planning phase, guardrails, interventions, and reflection.
- [docs/ai-prompts.md](./docs/ai-prompts.md) — the LLM system prompt, tool schemas, and sanitized example transcripts (filled out in Phase 6/7).

## License

MIT — see [LICENSE](./LICENSE).
