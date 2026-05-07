// Node component tests — verifies render shape, selection wiring, and
// that an unknown ID renders nothing. The singleton workflow + ui
// stores are reset between cases since these tests bind to the real
// instances rather than per-test factories (Phase 8 will switch to
// Context-injected stores at which point each test gets isolation
// for free).

import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { Node } from './Node';
import { workflowStore } from '@/state/workflow/instance';
import { useUiStore } from '@/state/ui/uiStore';

describe('Node', () => {
  beforeEach(() => {
    workflowStore.getState().clear();
    useUiStore.setState({
      selectedNodeId: null,
      selectedEdgeId: null,
      hoveredNodeId: null,
      hoveredEdgeId: null,
      viewport: { x: 0, y: 0 },
      isConnecting: false,
      connectingFromNodeId: null,
      panels: { properties: false, chat: false },
    });
  });

  it('renders the label, kind chip, and aria-label for a basic node', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 100, y: 200 },
      data: { label: 'Verify Coverage', variables: {} },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId, getByText } = render(<Node id={result.value.id} />);
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

    const { getByTestId } = render(<Node id={result.value.id} />);
    expect(getByTestId(`node-${result.value.id}`)).toHaveAttribute('data-kind', 'custom');
  });

  it('renders nothing when the id is not in the store', () => {
    const { container } = render(<Node id="missing" />);
    expect(container.firstChild).toBeNull();
  });

  it('selects the node when clicked', () => {
    const result = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = render(<Node id={result.value.id} />);
    fireEvent.click(getByTestId(`node-${result.value.id}`));

    expect(useUiStore.getState().selectedNodeId).toBe(result.value.id);
  });

  it('reflects selection state via data-selected', () => {
    const result = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
    if (!result.ok) throw new Error('setup');
    useUiStore.setState({ selectedNodeId: result.value.id });

    const { getByTestId } = render(<Node id={result.value.id} />);
    expect(getByTestId(`node-${result.value.id}`)).toHaveAttribute('data-selected', 'true');
  });

  it('positions the node via style.left/top from node.position', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 234, y: 567 },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = render(<Node id={result.value.id} />);
    const button = getByTestId(`node-${result.value.id}`);
    expect(button.style.left).toBe('234px');
    expect(button.style.top).toBe('567px');
  });
});
