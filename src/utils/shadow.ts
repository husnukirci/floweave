// Shadow DOM helpers for code that runs at document/window scope but
// needs to reason about elements inside the editor's shadow root.
//
// Two retargeting quirks the editor hits:
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
