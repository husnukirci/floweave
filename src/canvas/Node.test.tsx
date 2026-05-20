// Node component tests — verifies render shape, selection wiring, and
// that an unknown ID renders nothing. The singleton workflow + ui
// stores are reset between cases since these tests bind to the real
// instances rather than per-test factories (Phase 8 will switch to
// Context-injected stores at which point each test gets isolation
// for free).

import { fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { createUiStore, type UiStore } from '@/state/ui/uiStore';
import {
  createTestWorkflowStore,
  renderWithStores,
  type TestWorkflowStore,
} from '@/test/factories';

import { Node } from './Node';

describe('Node', () => {
  let workflowStore: TestWorkflowStore;
  let uiStore: UiStore;

  const renderNode = (ui: ReactElement) =>
    renderWithStores(ui, { stores: { workflowStore, uiStore } });

  beforeEach(() => {
    workflowStore = createTestWorkflowStore();
    uiStore = createUiStore();
  });

  it('renders the label, kind chip, and aria-label for a basic node', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 100, y: 200 },
      data: { label: 'Verify Coverage', variables: {} },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId, getByText } = renderNode(<Node id={result.value.id} />);
    const button = getByTestId(`node-${result.value.id}`);

    expect(getByText('Verify Coverage')).toBeInTheDocument();
    expect(button).toHaveAttribute('data-kind', 'task');
    expect(button).toHaveAttribute('aria-label', 'task node: Verify Coverage');
  });

  it('renders custom node kind chip from customType', () => {
    const result = workflowStore.getState().addNode({
      kind: 'custom',
      customType: 'verifyPolicy',
      position: { x: 0, y: 0 },
      data: { label: 'Check' },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderNode(<Node id={result.value.id} />);
    expect(getByTestId(`node-${result.value.id}`)).toHaveAttribute('data-kind', 'custom');
  });

  it('renders nothing when the id is not in the store', () => {
    const { container } = renderNode(<Node id="missing" />);
    expect(container.firstChild).toBeNull();
  });

  it('selects the node when clicked', () => {
    const result = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderNode(<Node id={result.value.id} />);
    fireEvent.click(getByTestId(`node-${result.value.id}`));

    expect(uiStore.getState().selectedNodeId).toBe(result.value.id);
  });

  it('does not select on pointerdown alone (selection waits for the click)', () => {
    const result = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderNode(<Node id={result.value.id} />);
    fireEvent.pointerDown(getByTestId(`node-${result.value.id}`), {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });

    expect(uiStore.getState().selectedNodeId).toBeNull();
  });

  it('reflects selection state via data-selected', () => {
    const result = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
    if (!result.ok) throw new Error('setup');
    uiStore.setState({ selectedNodeId: result.value.id });

    const { getByTestId } = renderNode(<Node id={result.value.id} />);
    expect(getByTestId(`node-${result.value.id}`)).toHaveAttribute('data-selected', 'true');
  });

  describe('keyboard', () => {
    it('removes the focused node on Delete', () => {
      const a = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok) throw new Error('setup');
      const { getByTestId } = renderNode(<Node id={a.value.id} />);

      fireEvent.keyDown(getByTestId(`node-${a.value.id}`), { key: 'Delete' });

      expect(workflowStore.getState().nodes[a.value.id]).toBeUndefined();
    });

    it('removes the focused node on Backspace', () => {
      const a = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok) throw new Error('setup');
      const { getByTestId } = renderNode(<Node id={a.value.id} />);

      fireEvent.keyDown(getByTestId(`node-${a.value.id}`), { key: 'Backspace' });

      expect(workflowStore.getState().nodes[a.value.id]).toBeUndefined();
    });

    it('focuses the next node on ArrowRight (wraps to the first)', () => {
      const a = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup');
      const { getByTestId } = renderNode(
        <>
          <Node id={a.value.id} />
          <Node id={b.value.id} />
        </>,
      );
      const first = getByTestId(`node-${a.value.id}`);
      first.focus();

      fireEvent.keyDown(first, { key: 'ArrowRight' });

      expect(document.activeElement).toBe(getByTestId(`node-${b.value.id}`));
    });

    it('focuses the previous node on ArrowLeft (wraps to the last)', () => {
      const a = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup');
      const { getByTestId } = renderNode(
        <>
          <Node id={a.value.id} />
          <Node id={b.value.id} />
        </>,
      );
      const first = getByTestId(`node-${a.value.id}`);
      first.focus();

      fireEvent.keyDown(first, { key: 'ArrowLeft' });

      expect(document.activeElement).toBe(getByTestId(`node-${b.value.id}`));
    });
  });

  describe('keyboard connection mode', () => {
    it("'c' on a focused node enters connecting state", () => {
      const a = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok) throw new Error('setup');
      const { getByTestId } = renderNode(<Node id={a.value.id} />);

      fireEvent.keyDown(getByTestId(`node-${a.value.id}`), { key: 'c' });

      expect(uiStore.getState().isConnecting).toBe(true);
      expect(uiStore.getState().connectingFromNodeId).toBe(a.value.id);
    });

    it('Escape during connecting cancels', () => {
      const a = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok) throw new Error('setup');
      uiStore.setState({ isConnecting: true, connectingFromNodeId: a.value.id });
      const { getByTestId } = renderNode(<Node id={a.value.id} />);

      fireEvent.keyDown(getByTestId(`node-${a.value.id}`), { key: 'Escape' });

      expect(uiStore.getState().isConnecting).toBe(false);
      expect(uiStore.getState().connectingFromNodeId).toBeNull();
    });

    it('Enter on a target node while connecting creates the edge', () => {
      const a = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = workflowStore.getState().addNode({ kind: 'task', position: { x: 200, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup');
      uiStore.setState({ isConnecting: true, connectingFromNodeId: a.value.id });
      const { getByTestId } = renderNode(<Node id={b.value.id} />);

      fireEvent.keyDown(getByTestId(`node-${b.value.id}`), { key: 'Enter' });

      const edges = Object.values(workflowStore.getState().edges);
      expect(edges).toHaveLength(1);
      expect(edges[0]?.source).toBe(a.value.id);
      expect(edges[0]?.target).toBe(b.value.id);
      expect(uiStore.getState().isConnecting).toBe(false);
    });
  });

  it('positions the node via style.left/top from node.position', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 234, y: 567 },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderNode(<Node id={result.value.id} />);
    const button = getByTestId(`node-${result.value.id}`);
    expect(button.style.left).toBe('234px');
    expect(button.style.top).toBe('567px');
  });
});
