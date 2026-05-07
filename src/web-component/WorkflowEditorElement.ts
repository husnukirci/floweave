// WorkflowEditorElement — the <workflow-editor> Custom Element
// (ADR-001 native CE wrapping React, ADR-018 public API surface).
//
// Phase 8 commit 1: structural skeleton only.
//   - Open Shadow DOM
//   - Tailwind CSS adopted via Constructable Stylesheets (ADR-007)
//   - connectedCallback / disconnectedCallback are empty hooks
//
// Commit 2 wires per-instance stores + React mount; commit 3 lands
// the public attribute / property / method / event surface.

import tailwindCss from '@/styles/globals.css?inline';

const TAILWIND_STYLESHEET = new CSSStyleSheet();
TAILWIND_STYLESHEET.replaceSync(tailwindCss);

export class WorkflowEditorElement extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [TAILWIND_STYLESHEET];
  }

  connectedCallback(): void {
    // Phase 8 commit 2: create per-instance workflow / ui / chat stores
    // and mount the React app with <StoresProvider> inside the shadow.
  }

  disconnectedCallback(): void {
    // Phase 8 commit 2: unmount the React root, abort any in-flight
    // chat request, drop store references.
  }
}

const TAG_NAME = 'workflow-editor';

/**
 * Idempotently register the Custom Element. Safe to call from the
 * library bundle entry, the dev SPA, and tests — second and later
 * calls no-op if the tag is already defined (HMR + multi-import).
 */
export function registerWorkflowEditor(): void {
  if (typeof customElements === 'undefined') return;
  if (customElements.get(TAG_NAME)) return;
  customElements.define(TAG_NAME, WorkflowEditorElement);
}
