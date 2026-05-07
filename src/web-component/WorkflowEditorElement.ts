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
import type { ChatMessage } from '@/state/chat/chatStore';
import { createStores, type CreatedStores } from '@/state/createStores';
import { StoresProvider } from '@/state/StoresProvider';
import type { AddNodeInput, StoreError, WorkflowState } from '@/state/workflow/types';
import tailwindCss from '@/styles/globals.css?inline';

const TAILWIND_STYLESHEET = new CSSStyleSheet();
TAILWIND_STYLESHEET.replaceSync(tailwindCss);

export interface SetWorkflowResult {
  ok: boolean;
  error?: string;
}

const NOT_CONNECTED_ERROR = 'Editor is not connected — call setWorkflow after appendChild.';

export class WorkflowEditorElement extends HTMLElement {
  // observedAttributes drives attributeChangedCallback. Per ADR-018:
  //   - initial-workflow: JSON string applied once at connect
  //   - api-endpoint: chat proxy URL, captured at connect
  static observedAttributes = ['initial-workflow', 'api-endpoint'] as const;

  private mountPoint: HTMLDivElement;
  private root: Root | null = null;
  private stores: CreatedStores | null = null;
  // Subscriptions registered in connectedCallback that translate store
  // changes into CustomEvents on the host element. Cleared in
  // disconnectedCallback to avoid emitting events from a torn-down
  // instance.
  private unsubscribers: (() => void)[] = [];

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

  // Public properties (ADR-018) =====================================

  /** Full workflow state. Setter delegates to setWorkflow. */
  get workflow(): WorkflowState {
    if (!this.stores) return { nodes: {}, edges: {} };
    const state = this.stores.workflowStore.getState();
    return { nodes: state.nodes, edges: state.edges };
  }

  set workflow(value: WorkflowState) {
    this.setWorkflow(value);
  }

  // Public methods (ADR-018) ========================================

  getWorkflow(): WorkflowState {
    return this.workflow;
  }

  setWorkflow(json: WorkflowState | string): SetWorkflowResult {
    if (!this.stores) return { ok: false, error: NOT_CONNECTED_ERROR };
    const serialized = typeof json === 'string' ? json : JSON.stringify(json);
    const result = this.stores.workflowStore.getState().importJSON(serialized);
    if (result.ok) return { ok: true };
    return { ok: false, error: `${result.error.code}: ${result.error.message}` };
  }

  clear(): void {
    this.stores?.workflowStore.getState().clear();
  }

  /**
   * Programmatically add a node. Returns the new node's id on success;
   * throws on validation failure (caller should construct a valid
   * AddNodeInput).
   */
  addNode(input: AddNodeInput): string {
    if (!this.stores) {
      throw new Error(NOT_CONNECTED_ERROR);
    }
    const result = this.stores.workflowStore.getState().addNode(input);
    if (!result.ok) {
      throw new Error(`addNode failed: ${result.error.code} ${result.error.message}`);
    }
    return result.value.id;
  }

  // Lifecycle ========================================================

  connectedCallback(): void {
    // connectedCallback can fire more than once if the element is
    // moved in the DOM. Bail if we've already mounted to keep the
    // instance idempotent.
    if (this.root) return;

    const apiEndpoint = this.getAttribute('api-endpoint') ?? undefined;
    this.stores = createStores({
      persistEnabled: false,
      ...(apiEndpoint !== undefined && { endpoint: apiEndpoint }),
    });

    // Apply the initial-workflow attribute, if any. Set BEFORE mount so
    // the first React render sees populated state and there's no
    // empty-state flash.
    const initialWorkflow = this.getAttribute('initial-workflow');
    if (initialWorkflow !== null && initialWorkflow !== '') {
      const result = this.stores.workflowStore.getState().importJSON(initialWorkflow);
      if (!result.ok) {
        this.dispatchErrorEvent(result.error);
      }
    }

    this.subscribeToStores();

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
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    // Abort any in-flight chat request before unmounting so its
    // resolution doesn't write into a destroyed React tree.
    this.stores?.chatStore.getState().cancelInFlight();
    this.root?.unmount();
    this.root = null;
    this.stores = null;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    // Attributes set declaratively before connect are read directly in
    // connectedCallback. attributeChangedCallback only matters for
    // post-connect updates. Both observed attributes are
    // connect-time-only by design (ADR-018) — endpoint changes mid-life
    // would require re-creating the chat store. Live updates to
    // initial-workflow are honored as a convenience for hosts that set
    // it after appendChild.
    if (!this.stores) return;
    if (name === 'initial-workflow' && newValue !== null && newValue !== '') {
      this.setWorkflow(newValue);
    }
  }

  // Event dispatch ===================================================

  private subscribeToStores(): void {
    if (!this.stores) return;
    const { workflowStore, uiStore, chatStore } = this.stores;

    // workflow-change: any change to nodes or edges
    this.unsubscribers.push(
      workflowStore.subscribe((state, prevState) => {
        if (state.nodes !== prevState.nodes || state.edges !== prevState.edges) {
          this.dispatchEvent(
            new CustomEvent<WorkflowState>('workflow-change', {
              detail: { nodes: state.nodes, edges: state.edges },
            }),
          );
        }
      }),
    );

    // node-selected: selection change including null
    this.unsubscribers.push(
      uiStore.subscribe((state, prevState) => {
        if (state.selectedNodeId !== prevState.selectedNodeId) {
          this.dispatchEvent(
            new CustomEvent<string | null>('node-selected', { detail: state.selectedNodeId }),
          );
        }
      }),
    );

    // chat-message: any new message appended
    this.unsubscribers.push(
      chatStore.subscribe((state, prevState) => {
        if (state.messages.length > prevState.messages.length) {
          const last = state.messages[state.messages.length - 1];
          if (last) {
            this.dispatchEvent(new CustomEvent<ChatMessage>('chat-message', { detail: last }));
          }
        }
      }),
    );

    // error: chat store flipped its error field to a non-null value
    this.unsubscribers.push(
      chatStore.subscribe((state, prevState) => {
        if (state.error !== null && state.error !== prevState.error) {
          this.dispatchErrorEvent(state.error);
        }
      }),
    );
  }

  private dispatchErrorEvent(error: StoreError): void {
    this.dispatchEvent(new CustomEvent<StoreError>('error', { detail: error }));
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
