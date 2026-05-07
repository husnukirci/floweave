// WorkflowEditorElement — the <workflow-editor> Custom Element
// (ADR-001 native CE wrapping React, ADR-018 public API surface,
// ADR-019 multi-instance support).
//
// Each instance creates its own workflow / ui / chat stores via
// createStores() and provides them through StoresProvider so the React
// tree mounted inside the shadow root is fully isolated from any other
// instance on the page. connectedCallback mounts; disconnectedCallback
// unmounts and aborts any in-flight chat request.

import { createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { App } from '@/App';
import { createStores, type CreatedStores } from '@/state/createStores';
import { StoresProvider } from '@/state/StoresProvider';
import tailwindCss from '@/styles/globals.css?inline';

const TAILWIND_STYLESHEET = new CSSStyleSheet();
TAILWIND_STYLESHEET.replaceSync(tailwindCss);

export class WorkflowEditorElement extends HTMLElement {
  // Mount container inside the shadow root. React is mounted into this
  // <div> rather than directly into the shadow root so any non-React
  // children (future portals, debug overlays) can live alongside.
  private mountPoint: HTMLDivElement;
  private root: Root | null = null;
  private stores: CreatedStores | null = null;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [TAILWIND_STYLESHEET];
    this.mountPoint = document.createElement('div');
    // Mirror the SPA's outer wrapper so the editor fills its host box.
    this.mountPoint.style.height = '100%';
    this.mountPoint.style.width = '100%';
    shadow.appendChild(this.mountPoint);
  }

  connectedCallback(): void {
    // connectedCallback can fire more than once if the element is
    // moved in the DOM. Bail if we've already mounted to keep the
    // instance idempotent.
    if (this.root) return;

    this.stores = createStores({ persistEnabled: false });
    this.root = createRoot(this.mountPoint);
    this.root.render(
      createElement(
        StrictMode,
        null,
        createElement(StoresProvider, this.stores, createElement(App)),
      ),
    );
  }

  disconnectedCallback(): void {
    // Abort any in-flight chat request before unmounting so its
    // resolution doesn't write into a destroyed React tree.
    this.stores?.chatStore.getState().cancelInFlight();
    this.root?.unmount();
    this.root = null;
    this.stores = null;
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
