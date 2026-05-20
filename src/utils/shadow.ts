// Shadow DOM helpers for code that runs at document/window scope but
// needs to reason about elements inside the editor's shadow root.
//
// See docs/shadow-dom-gotchas.md for the full field guide (six
// retargeting traps plus a React SyntheticEvent quirk). Three of those
// motivate the helpers in this file:
//
//   1. Events fired inside a shadow root are retargeted to the shadow
//      host before they bubble up to document-level listeners. So
//      `event.target` on a document/window listener is the host
//      element (<workflow-editor>), not the actual clicked element.
//      Use `event.composedPath()` inline — it returns the full path
//      including elements inside shadow trees.
//
//   2. `document.activeElement` is similarly retargeted: when focus
//      is inside a shadow tree, document.activeElement is the host.
//      Walk the shadowRoot.activeElement chain to get the real one.
//
//   3. `document.elementFromPoint(x, y)` stops at the shadow host:
//      hit-testing returns the host element instead of the element
//      actually under the cursor inside the shadow tree. Recurse via
//      `shadowRoot.elementFromPoint(...)` to reach the real element.

/**
 * Returns the actual focused element, even if it lives inside one or
 * more nested shadow roots. Falls back to `document.activeElement`
 * when nothing is focused.
 */
export function getDeepActiveElement(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/**
 * Returns the deepest element at the given viewport coordinates, piercing
 * any shadow roots along the way. `document.elementFromPoint` halts at
 * a shadow host and returns the host itself; this helper recurses via
 * each host's shadowRoot.elementFromPoint until it reaches a non-host
 * element (or runs out of shadow roots).
 *
 * Used by drag-and-drop / hit-testing flows where the cursor lands on
 * an element inside the editor's shadow tree.
 */
export function getDeepElementFromPoint(x: number, y: number): Element | null {
  let element = document.elementFromPoint(x, y);
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
}
