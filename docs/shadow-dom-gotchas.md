# Shadow DOM gotchas

Practical field guide for working on `<workflow-editor>` — the editor mounts
React inside a closed shadow tree (ADR-007), and several browser-level APIs
that "look global" silently change behavior at the shadow boundary. Every
entry below was a real bug; the workaround listed is the one in the
codebase.

This complements ADR-007 (the _decision_ to use Shadow DOM) with the
_operational consequences_ you have to keep in mind when writing canvas /
event / hit-testing code.

## Why this exists

The editor must work standalone (`npm run dev`, light DOM) **and** embedded
as a Custom Element (`dist-wc/workflow-editor.js`, shadow DOM). Anything
that assumes light DOM will pass tests, pass `make test`, render fine in
the SPA — and then break only in the embedded build. Most regressions
since v1.0.0 have been in this class.

The general rule: **whenever code reaches for `document.*`, ask whether
it's actually trying to query its own subtree.** If yes, prefer a
shadow-aware path.

## The six retargeting traps

### 1. `event.target` is retargeted to the shadow host

For listeners attached at document/window scope, `event.target` is the
shadow host (`<workflow-editor>`), not the actual element clicked inside
the shadow tree.

```ts
// ❌ Inside the WC, `event.target` is <workflow-editor> here.
document.addEventListener('mousedown', (e) => {
  if (e.target === menuRef.current) {
    /* never true */
  }
});

// ✅ composedPath() returns the full path through shadow boundaries.
document.addEventListener('mousedown', (e) => {
  if (e.composedPath().includes(menuRef.current)) {
    /* works */
  }
});
```

Applied in: `Toolbar.tsx` (outside-click for the Add menu),
`Canvas.tsx` (pan-vs-interactive detection).

### 2. `document.activeElement` is retargeted to the shadow host

When focus is inside a shadow tree, `document.activeElement` returns the
host. Walk the chain via `shadowRoot.activeElement` to reach the real
focused element.

```ts
// ✅ src/utils/shadow.ts
export function getDeepActiveElement(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}
```

Applied in: `Canvas.tsx` Delete-key handler (skip when focus is in a
form input).

### 3. `document.elementFromPoint` stops at the shadow host

Hit-testing returns the host element, not the element actually under
the cursor inside the tree. Recurse via `shadowRoot.elementFromPoint`.

```ts
// ✅ src/utils/shadow.ts
export function getDeepElementFromPoint(x: number, y: number): Element | null {
  let element = document.elementFromPoint(x, y);
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
}
```

Applied in: `Handle.tsx` drop-detection during drag-to-connect.

### 4. `document.querySelector` cannot reach into the shadow root

`document.querySelector('[data-testid="canvas-content"]')` returns `null`
when canvas-content lives inside a shadow tree. There's no global walker —
look up from an element you already have inside the tree.

```ts
// ❌ Returns null when running inside the WC.
const el = document.querySelector('[data-testid="canvas-content"]');

// ✅ Anchor the lookup on a known descendant — `.closest()` walks
//    up through the shadow root naturally.
const el = wrapperRef.current?.closest('[data-testid="canvas-content"]');
```

Applied in: `Handle.tsx` `getCanvasContentRect` for screen→world
coordinate conversion.

### 5. Viewport units (`vh` / `vw`) refer to the browser viewport, not the host

`h-screen` / `w-screen` (= `100vh` / `100vw`) make the React app fill the
entire browser viewport instead of the editor's host box, spilling past
the embedding container.

```tsx
// ❌ Editor escapes its host box.
<div className="h-screen w-screen">...</div>

// ✅ Fill the host element.
<div className="h-full w-full">...</div>
```

Applied in: `App.tsx`. The host page sizes `<workflow-editor>` (the demo
gives it `display: block; width: 100%; height: 100%` in its grid cell),
and the editor fills whatever box it's given.

### 6. Tailwind v4 `-translate-*` utilities resolve to `translate: none`

Tailwind v4's translate utilities compile to
`translate: var(--tw-translate-x) var(--tw-translate-y)` and rely on
`@property --tw-translate-x` / `--tw-translate-y` to provide initial
values. `@property` registration declared inside an adopted stylesheet
does not take effect in shadow trees, so `var(--tw-translate-x)` resolves
to nothing, the `translate` shorthand becomes invalid, and the rule
falls back to `none` — the element ends up un-translated. Centering
patterns like `top-1/2 -translate-y-1/2` silently fail.

```tsx
// ❌ -translate-y-1/2 → `translate: none` in Shadow DOM.
<div className="absolute top-1/2 -translate-y-1/2" />

// ✅ Arbitrary value writes the `transform` longhand directly,
//    bypassing the var-shorthand path.
<div className="absolute top-1/2 [transform:translateY(-50%)]" />
```

Applied in: `Handle.tsx` (vertical centering of the connection dot),
`ErrorBanner.tsx` (horizontal centering of the toast).

## Adjacent React quirk: `SyntheticEvent.currentTarget` is short-lived

Not a Shadow DOM issue per se, but it shows up at the same surface:
React nulls out `SyntheticEvent.currentTarget` after the dispatch
returns. Code that holds onto an event across an `await`, a
`requestAnimationFrame`, or any throttler closure will see
`currentTarget === null` later.

This breaks pairings like
`event.currentTarget.closest('[data-testid="canvas-content"]')` inside
a throttled `onDrag` handler — the lookup that worked in the original
`pointerdown` returns `null` on the subsequent rAF tick.

```ts
// ❌ wrapperRef would be null one frame later.
onDrag: (event) => {
  clientToWorld(event.clientX, event.clientY, event.currentTarget);
};

// ✅ Capture the element via a ref attached at render time.
const wrapperRef = useRef<HTMLDivElement>(null);
onDrag: (event) => {
  clientToWorld(event.clientX, event.clientY, wrapperRef.current);
};
```

Applied in: `Handle.tsx` (anchor element for the canvas-content
ancestor lookup used by drag-to-connect).

## Pre-flight checklist when touching canvas / event code

Before merging anything that touches `src/canvas/**`, `src/utils/pointer.ts`,
or any document/window listener:

- [ ] No `document.querySelector` / `document.getElementById` against
      elements that live inside the editor — use `.closest()` from a known
      descendant.
- [ ] No `document.elementFromPoint` for hit-testing inside the editor —
      use `getDeepElementFromPoint`.
- [ ] No reliance on `document.activeElement` for focus checks inside
      the editor — use `getDeepActiveElement`.
- [ ] No `event.target` checks at document/window scope — use
      `event.composedPath()`.
- [ ] No `100vh` / `100vw` (or `h-screen` / `w-screen`) — use `100%` of
      the host.
- [ ] No `-translate-*` / `translate-*` Tailwind utilities — use
      `[transform:translate*(...)]` arbitrary values until upstream fixes
      the `@property` interaction with adopted stylesheets.
- [ ] No `event.currentTarget` access inside a throttler / promise /
      rAF callback — capture the element via `useRef` at render time.

The unit test suite runs in light-DOM happy-dom and **will not catch
any of these**. Validate the WC build (`make build:wc`) against the
demo page after touching any of the above surfaces.
