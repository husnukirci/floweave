import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { registerWorkflowEditor, WorkflowEditorElement } from './WorkflowEditorElement';

beforeAll(() => {
  registerWorkflowEditor();
});

describe('WorkflowEditorElement', () => {
  it('registers as the <workflow-editor> custom element', () => {
    expect(customElements.get('workflow-editor')).toBe(WorkflowEditorElement);
  });

  it('registerWorkflowEditor is idempotent — calling twice does not throw', () => {
    expect(() => {
      registerWorkflowEditor();
    }).not.toThrow();
  });

  it('attaches an open shadow root on construction', () => {
    const el = document.createElement('workflow-editor') as WorkflowEditorElement;

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.mode).toBe('open');
  });

  it('adopts a stylesheet into the shadow root for style isolation (ADR-007)', () => {
    const el = document.createElement('workflow-editor') as WorkflowEditorElement;

    // The adopted sheet is the shared Tailwind sheet, so its presence
    // is the contract; the exact content is verified at integration
    // time via Playwright in the demo page.
    expect(el.shadowRoot?.adoptedStyleSheets.length).toBeGreaterThan(0);
  });

  it('connectedCallback runs without error when the element is appended to the DOM', () => {
    const el = document.createElement('workflow-editor');

    expect(() => {
      document.body.appendChild(el);
    }).not.toThrow();

    document.body.removeChild(el);
  });

  it('disconnectedCallback runs without error when the element is removed', () => {
    const el = document.createElement('workflow-editor');
    document.body.appendChild(el);

    expect(() => {
      document.body.removeChild(el);
    }).not.toThrow();
  });

  it('two separate elements get distinct shadow roots', () => {
    const a = document.createElement('workflow-editor') as WorkflowEditorElement;
    const b = document.createElement('workflow-editor') as WorkflowEditorElement;

    expect(a.shadowRoot).not.toBe(b.shadowRoot);
  });

  describe('public API (ADR-018)', () => {
    let el: WorkflowEditorElement;

    beforeEach(() => {
      el = document.createElement('workflow-editor') as WorkflowEditorElement;
      document.body.appendChild(el);
    });

    afterEach(() => {
      el.remove();
    });

    it('getWorkflow returns the empty workflow on a fresh editor', () => {
      const wf = el.getWorkflow();
      expect(Object.keys(wf.nodes)).toHaveLength(0);
      expect(Object.keys(wf.edges)).toHaveLength(0);
    });

    it('addNode adds a node and returns its id', () => {
      const id = el.addNode({ kind: 'task', position: { x: 10, y: 20 } });
      expect(typeof id).toBe('string');
      expect(el.getWorkflow().nodes[id]).toBeDefined();
    });

    it('clear removes every node and edge', () => {
      const a = el.addNode({ kind: 'start', position: { x: 0, y: 0 } });
      const b = el.addNode({ kind: 'end', position: { x: 200, y: 0 } });
      expect(Object.keys(el.getWorkflow().nodes)).toHaveLength(2);

      el.clear();

      expect(Object.keys(el.getWorkflow().nodes)).toHaveLength(0);
      // and the ids are no longer reachable
      expect(el.getWorkflow().nodes[a]).toBeUndefined();
      expect(el.getWorkflow().nodes[b]).toBeUndefined();
    });

    it('setWorkflow round-trips a valid WorkflowState', () => {
      const id = el.addNode({ kind: 'task', position: { x: 5, y: 5 } });
      const snapshot = el.getWorkflow();
      el.clear();
      expect(Object.keys(el.getWorkflow().nodes)).toHaveLength(0);

      const result = el.setWorkflow(snapshot);

      expect(result.ok).toBe(true);
      expect(el.getWorkflow().nodes[id]).toBeDefined();
    });

    it('setWorkflow returns ok:false with an error string for malformed JSON', () => {
      const result = el.setWorkflow('{not valid');
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('the workflow property setter delegates to setWorkflow', () => {
      const id = el.addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const snapshot = el.workflow;
      el.clear();

      el.workflow = snapshot;

      expect(el.getWorkflow().nodes[id]).toBeDefined();
    });
  });

  describe('attributes', () => {
    it('initial-workflow attribute populates state at connect time', () => {
      const seed = JSON.stringify({
        nodes: {
          n1: {
            id: 'n1',
            kind: 'task',
            position: { x: 1, y: 2 },
            data: { label: 'T', variables: {} },
          },
        },
        edges: {},
      });

      const el = document.createElement('workflow-editor') as WorkflowEditorElement;
      el.setAttribute('initial-workflow', seed);
      document.body.appendChild(el);

      expect(el.getWorkflow().nodes.n1).toBeDefined();
      el.remove();
    });

    it('a malformed initial-workflow attribute fires an error CustomEvent', () => {
      const el = document.createElement('workflow-editor') as WorkflowEditorElement;
      el.setAttribute('initial-workflow', 'not json');

      const errors: unknown[] = [];
      el.addEventListener('error', (event) => {
        // 'error' on an HTMLElement is typed as ErrorEvent by lib.dom;
        // ours is a CustomEvent — narrow via unknown.
        errors.push((event as unknown as CustomEvent).detail);
      });

      document.body.appendChild(el);

      expect(errors.length).toBeGreaterThan(0);
      el.remove();
    });
  });

  describe('CustomEvents (ADR-018)', () => {
    let el: WorkflowEditorElement;

    beforeEach(() => {
      el = document.createElement('workflow-editor') as WorkflowEditorElement;
      document.body.appendChild(el);
    });

    afterEach(() => {
      el.remove();
    });

    it('workflow-change fires after addNode with the new workflow state', () => {
      const events: { nodes: Record<string, unknown> }[] = [];
      el.addEventListener('workflow-change', (event) => {
        const detail = (event as CustomEvent).detail as { nodes: Record<string, unknown> };
        events.push(detail);
      });

      el.addNode({ kind: 'task', position: { x: 0, y: 0 } });

      expect(events.length).toBeGreaterThan(0);
      const last = events[events.length - 1];
      expect(Object.keys(last?.nodes ?? {}).length).toBe(1);
    });

    // Note: node-selected, chat-message, and error events use the same
    // store-subscribe -> dispatchEvent pattern as workflow-change above.
    // The Phase 8 commit-6 multi-instance smoke covers them via an
    // integration scenario; here we trust the pattern via the
    // workflow-change unit test.

    it('disconnectedCallback removes subscriptions — no events fire after detach', () => {
      const events: unknown[] = [];
      el.addEventListener('workflow-change', () => {
        events.push(null);
      });
      el.addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const beforeDetach = events.length;

      // Snapshot the stores reference before detach so we can mutate
      // it post-detach to verify subscriptions are cleared.
      const wfStore = (
        el as unknown as {
          stores: {
            workflowStore: { getState: () => { addNode: (i: unknown) => unknown } };
          } | null;
        }
      ).stores?.workflowStore;
      el.remove();

      // Mutating via the captured store after detach should not fire
      // any further workflow-change events on the (detached) element.
      wfStore?.getState().addNode({ kind: 'end', position: { x: 1, y: 1 } });

      expect(events.length).toBe(beforeDetach);
    });
  });

  describe('multi-instance support (ADR-019)', () => {
    let a: WorkflowEditorElement;
    let b: WorkflowEditorElement;

    beforeEach(() => {
      a = document.createElement('workflow-editor') as WorkflowEditorElement;
      b = document.createElement('workflow-editor') as WorkflowEditorElement;
      document.body.appendChild(a);
      document.body.appendChild(b);
    });

    afterEach(() => {
      a.remove();
      b.remove();
    });

    it('two elements have fully independent workflow state', () => {
      const idA = a.addNode({ kind: 'task', position: { x: 0, y: 0 } });

      expect(a.getWorkflow().nodes[idA]).toBeDefined();
      expect(b.getWorkflow().nodes[idA]).toBeUndefined();
      expect(Object.keys(b.getWorkflow().nodes)).toHaveLength(0);

      const idB = b.addNode({ kind: 'end', position: { x: 100, y: 0 } });

      expect(a.getWorkflow().nodes[idB]).toBeUndefined();
      expect(b.getWorkflow().nodes[idB]).toBeDefined();
    });

    it('clearing one element does not affect the other', () => {
      a.addNode({ kind: 'task', position: { x: 0, y: 0 } });
      b.addNode({ kind: 'task', position: { x: 0, y: 0 } });

      a.clear();

      expect(Object.keys(a.getWorkflow().nodes)).toHaveLength(0);
      expect(Object.keys(b.getWorkflow().nodes)).toHaveLength(1);
    });

    it('disconnecting one element does not break the other', () => {
      b.addNode({ kind: 'task', position: { x: 0, y: 0 } });
      a.remove();

      // b stays fully functional
      expect(Object.keys(b.getWorkflow().nodes)).toHaveLength(1);
      const idB = b.addNode({ kind: 'end', position: { x: 200, y: 0 } });
      expect(b.getWorkflow().nodes[idB]).toBeDefined();
    });

    it('CustomEvents only fire on the element that produced the change', () => {
      const eventsA: number[] = [];
      const eventsB: number[] = [];
      a.addEventListener('workflow-change', () => {
        eventsA.push(1);
      });
      b.addEventListener('workflow-change', () => {
        eventsB.push(1);
      });

      a.addNode({ kind: 'task', position: { x: 0, y: 0 } });

      expect(eventsA.length).toBeGreaterThan(0);
      expect(eventsB.length).toBe(0);

      b.addNode({ kind: 'end', position: { x: 0, y: 0 } });

      expect(eventsB.length).toBeGreaterThan(0);
    });

    it('initial-workflow attributes are independent across instances', () => {
      a.remove();
      b.remove();

      const seedA = JSON.stringify({
        nodes: {
          alpha: {
            id: 'alpha',
            kind: 'task',
            position: { x: 0, y: 0 },
            data: { label: 'A', variables: {} },
          },
        },
        edges: {},
      });
      const seedB = JSON.stringify({
        nodes: {
          beta: {
            id: 'beta',
            kind: 'task',
            position: { x: 0, y: 0 },
            data: { label: 'B', variables: {} },
          },
        },
        edges: {},
      });

      a = document.createElement('workflow-editor') as WorkflowEditorElement;
      b = document.createElement('workflow-editor') as WorkflowEditorElement;
      a.setAttribute('initial-workflow', seedA);
      b.setAttribute('initial-workflow', seedB);
      document.body.appendChild(a);
      document.body.appendChild(b);

      expect(a.getWorkflow().nodes.alpha).toBeDefined();
      expect(a.getWorkflow().nodes.beta).toBeUndefined();
      expect(b.getWorkflow().nodes.beta).toBeDefined();
      expect(b.getWorkflow().nodes.alpha).toBeUndefined();
    });
  });

  describe('shadow-boundary event handling', () => {
    let el: WorkflowEditorElement;

    async function waitForTestId(testId: string, timeoutMs = 1000): Promise<Element> {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const node = el.shadowRoot?.querySelector(`[data-testid="${testId}"]`);
        if (node) return node;
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error(`[data-testid="${testId}"] never appeared in the shadow root`);
    }

    beforeEach(() => {
      el = document.createElement('workflow-editor') as WorkflowEditorElement;
      document.body.appendChild(el);
    });

    afterEach(() => {
      el.remove();
    });

    it('Toolbar Add menu items work despite event retargeting (regression: empty menu click)', async () => {
      // Before the composedPath fix, the document-level mousedown
      // handler saw event.target as the shadow host and treated every
      // menuitem click as "outside" — closing the menu before the
      // item's click handler fired.
      const addBtn = (await waitForTestId('toolbar-add-button')) as HTMLButtonElement;
      addBtn.click();
      const startBtn = (await waitForTestId('toolbar-add-start')) as HTMLButtonElement;

      const before = Object.keys(el.getWorkflow().nodes).length;
      startBtn.click();
      await new Promise((r) => setTimeout(r, 10));

      expect(Object.keys(el.getWorkflow().nodes).length).toBe(before + 1);
    });

    it('App root fills the host element, not the viewport (regression: w-screen spill)', async () => {
      // The App's outer div used to have `w-screen h-screen`, which
      // resolves to 100vw/100vh — full viewport — regardless of how
      // wide the WC element actually is. When a host page constrained
      // the WC (e.g. demo.html's grid column), the React tree overflowed
      // the shadow host's right edge and any LIGHT-DOM element next to
      // the WC visually covered the spillover (PropertiesPanel +
      // ChatPanel were rendered but hidden behind the demo sidebar).
      // Switching to `w-full h-full` ties the App to its parent
      // (the mountPoint inside the shadow root) instead.
      el.style.width = '500px';
      el.style.height = '400px';
      el.style.display = 'block';
      // Wait for React's first commit so the App root exists.
      await new Promise((r) => setTimeout(r, 30));
      const shadow = el.shadowRoot;
      if (!shadow) throw new Error('expected shadowRoot');
      const mount = shadow.firstElementChild;
      const appRoot = mount?.firstElementChild as HTMLElement | null;
      if (!appRoot) throw new Error('expected React app root');
      const elRect = el.getBoundingClientRect();
      const appRect = appRoot.getBoundingClientRect();
      expect(appRect.width).toBeLessThanOrEqual(elRect.width);
      expect(appRect.height).toBeLessThanOrEqual(elRect.height);
    });

    it('Canvas Delete handler skips form input focus despite activeElement retargeting', () => {
      // Before the getDeepActiveElement fix, document.activeElement
      // returned the shadow host (not the actual focused INPUT inside),
      // so the FORM_TAGS skip never triggered and Delete in a label
      // input would delete the selected edge.
      el.addNode({ kind: 'task', position: { x: 0, y: 0 } });
      el.addNode({ kind: 'task', position: { x: 100, y: 0 } });
      const ids = Object.keys(el.getWorkflow().nodes);
      const [a, b] = ids as [string, string];

      // Programmatically wire an edge so we have something to delete.
      const wfStore = (
        el as unknown as {
          stores: {
            workflowStore: { getState: () => { connectNodes: (i: unknown) => { ok: boolean } } };
          } | null;
        }
      ).stores?.workflowStore;
      wfStore?.getState().connectNodes({ source: a, target: b });
      expect(Object.keys(el.getWorkflow().edges).length).toBe(1);

      // Select the edge via the ui store so Canvas's Delete handler
      // has a target.
      const uiStore = (
        el as unknown as {
          stores: { uiStore: { getState: () => { selectEdge: (id: string) => void } } } | null;
        }
      ).stores?.uiStore;
      const edgeId = Object.keys(el.getWorkflow().edges)[0];
      if (!edgeId) throw new Error('expected at least one edge after setup');
      uiStore?.getState().selectEdge(edgeId);

      // Mount a synthetic INPUT inside the shadow root and focus it.
      const input = document.createElement('input');
      input.type = 'text';
      el.shadowRoot?.appendChild(input);
      input.focus();

      // Fire Delete on window. With the fix, getDeepActiveElement
      // resolves to the INPUT inside the shadow and the handler skips;
      // without the fix, document.activeElement is <workflow-editor>
      // (not a FORM_TAG) and the edge would be deleted.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));

      expect(Object.keys(el.getWorkflow().edges).length).toBe(1);

      input.remove();
    });
  });
});
