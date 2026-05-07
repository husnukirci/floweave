# `<workflow-editor>` API reference

Public surface of the `<workflow-editor>` Custom Element ([ADR-018](./decisions.md)). Each element instance owns its own workflow / ui / chat state and is fully isolated from any other instance on the page ([ADR-019](./decisions.md)).

## Loading

The bundle at `dist-wc/workflow-editor.js` self-contains React, Zustand, Tailwind, and the `<workflow-editor>` registration. Drop in one `<script type="module">` tag and the element is ready:

```html
<script type="module" src="/path/to/workflow-editor.js"></script>
<workflow-editor api-endpoint="/api/chat"></workflow-editor>
```

A live LLM proxy is required for the chat panel to work — see [README.md](../README.md#running-the-llm-proxy).

## Attributes

String-valued, declarative. Set before `appendChild` or via `element.setAttribute(...)`.

| Attribute          | Default     | Description                                                                                                                           |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `initial-workflow` | _(none)_    | JSON string with `{ nodes, edges }` shape. Applied at connect time and on subsequent attribute changes. Malformed JSON fires `error`. |
| `api-endpoint`     | `/api/chat` | URL of the LLM proxy. Captured at connect; later changes are not honored — to switch endpoints, replace the element.                  |

## Properties

| Property   | Type            | Description                                                                                                                             |
| ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow` | `WorkflowState` | Getter returns the current `{ nodes, edges }` snapshot. Setter delegates to `setWorkflow` (returns void; see `setWorkflow` for errors). |

```js
const editor = document.querySelector('workflow-editor');
console.log(editor.workflow.nodes);
editor.workflow = { nodes: {}, edges: {} }; // clear via property
```

## Methods

| Method              | Returns             | Description                                                                                                                                            |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getWorkflow()`     | `WorkflowState`     | Snapshot of the current `{ nodes, edges }` state. Safe to call after `appendChild`.                                                                    |
| `setWorkflow(json)` | `SetWorkflowResult` | Replaces state with the supplied JSON. Accepts `WorkflowState` object or its string form. Returns `{ ok: true }` on success or `{ ok: false, error }`. |
| `clear()`           | `void`              | Removes every node and edge.                                                                                                                           |
| `addNode(input)`    | `string`            | Appends a node and returns its generated id. Throws on validation failure (e.g. `customType` missing when `kind === 'custom'`).                        |

```ts
type SetWorkflowResult = { ok: true } | { ok: false; error: string };

interface AddNodeInput {
  kind: 'start' | 'end' | 'task' | 'custom';
  customType?: 'createAccount' | 'createPolicy' | /* ... 9 insurance variants ... */;
  position: { x: number; y: number };
  data?: { label?: string; variables?: Record<string, string | number | boolean> };
}
```

## Events

All four events are `CustomEvent` instances dispatched on the host element. Subscribe with `element.addEventListener('event-name', handler)`.

| Event             | `event.detail`                      | Fires when                                                                                      |
| ----------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `workflow-change` | `{ nodes, edges }`                  | Any change to nodes or edges (including AI-driven mutations).                                   |
| `node-selected`   | `string \| null`                    | Selection changes; `null` when nothing is selected.                                             |
| `chat-message`    | `ChatMessage`                       | A new message lands in the chat panel — user, assistant, or system.                             |
| `error`           | `{ code: string, message: string }` | Chat hits a non-cancel failure (proxy 5xx, network, iteration cap), or an attribute load fails. |

```js
editor.addEventListener('workflow-change', (e) => {
  console.log('graph now has', Object.keys(e.detail.nodes).length, 'nodes');
});
editor.addEventListener('error', (e) => {
  console.error(`[${e.detail.code}] ${e.detail.message}`);
});
```

## Usage examples

### Declarative — drop-in

```html
<workflow-editor
  api-endpoint="/api/chat"
  initial-workflow='{"nodes":{"a":{"id":"a","kind":"start","position":{"x":0,"y":0},"data":{"label":"Claim Received","variables":{}}}},"edges":{}}'
></workflow-editor>
```

### Programmatic — typed wiring

```ts
const editor = document.querySelector<WorkflowEditorElement>('workflow-editor');
if (!editor) throw new Error('mount the element first');

const startId = editor.addNode({
  kind: 'start',
  position: { x: 0, y: 0 },
  data: { label: 'Claim Received' },
});
const taskId = editor.addNode({
  kind: 'custom',
  customType: 'verifyPolicy',
  position: { x: 220, y: 0 },
});

editor.addEventListener('workflow-change', (e) => {
  // Persist server-side, sync to your app, etc.
  myApp.saveWorkflow(e.detail);
});
```

### Multi-instance

```html
<workflow-editor id="claim-flow" api-endpoint="/api/chat"></workflow-editor>
<workflow-editor id="onboarding" api-endpoint="/api/chat"></workflow-editor>

<script type="module">
  document.getElementById('claim-flow').addNode({ kind: 'start', position: { x: 0, y: 0 } });
  // Adding to the first editor leaves the second untouched.
</script>
```

## Lifecycle

| Phase                      | What happens                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `connectedCallback`        | Constructs per-instance workflow / ui / chat stores, applies `initial-workflow`, registers store→event subscriptions, mounts React. |
| `disconnectedCallback`     | Aborts any in-flight chat request, tears down subscriptions, unmounts React, drops store references.                                |
| `attributeChangedCallback` | Live updates to `initial-workflow` re-import state. `api-endpoint` is captured once at connect.                                     |

Re-attaching a removed element creates a fresh state internally — moving the same element around the DOM is supported, but state does not survive a `remove()` followed by a later `appendChild()`.

## What this element does _not_ expose

- The internal Zustand stores. Tools that need direct store access should run inside the React tree via `useWorkflowStore`/`useUiStore`/`useChatStore` from `@/state/StoresProvider`, not against the element.
- `workflow-change` does not differentiate user actions from AI actions. The `chat-message` event is the signal to detect AI-driven changes.
- The chat panel cannot be disabled via attribute. To remove it from the UI, host pages can rely on the toolbar's chat-toggle button (closed by default) — opening the panel is a user action.
