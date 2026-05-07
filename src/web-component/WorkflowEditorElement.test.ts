import { beforeAll, describe, expect, it } from 'vitest';

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
});
