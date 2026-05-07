// Toolbar component tests — exercises the Add menu, the IO buttons, and
// outside-click dismissal. Bound to the singleton workflow store as the
// rest of the canvas-level tests; per-test isolation via clear() in
// beforeEach.

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toolbar } from './Toolbar';
import { workflowStore } from '@/state/workflow/instance';
import { useUiStore } from '@/state/ui/uiStore';

describe('Toolbar', () => {
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
      connectingCursor: null,
      panels: { properties: false, chat: false },
      notification: null,
    });
  });

  afterEach(() => {
    workflowStore.getState().clear();
  });

  it('renders the four primary buttons', () => {
    const { getByTestId } = render(<Toolbar />);

    expect(getByTestId('toolbar-add-button')).toBeInTheDocument();
    expect(getByTestId('toolbar-import-button')).toBeInTheDocument();
    expect(getByTestId('toolbar-export-button')).toBeInTheDocument();
    expect(getByTestId('toolbar-clear-button')).toBeInTheDocument();
  });

  it('opens the add menu on click and closes again on a second click', () => {
    const { getByTestId, queryByTestId } = render(<Toolbar />);
    const addButton = getByTestId('toolbar-add-button');

    expect(queryByTestId('toolbar-add-menu')).toBeNull();

    fireEvent.click(addButton);
    expect(queryByTestId('toolbar-add-menu')).toBeInTheDocument();
    expect(addButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(addButton);
    expect(queryByTestId('toolbar-add-menu')).toBeNull();
    expect(addButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('adds a basic node when its menu item is clicked', () => {
    const { getByTestId } = render(<Toolbar />);

    fireEvent.click(getByTestId('toolbar-add-button'));
    fireEvent.click(getByTestId('toolbar-add-task'));

    const nodes = Object.values(workflowStore.getState().nodes);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.kind).toBe('task');
  });

  it('adds a custom node carrying the customType discriminant', () => {
    const { getByTestId } = render(<Toolbar />);

    fireEvent.click(getByTestId('toolbar-add-button'));
    fireEvent.click(getByTestId('toolbar-add-verifyPolicy'));

    const node = Object.values(workflowStore.getState().nodes)[0];
    expect(node?.kind).toBe('custom');
    if (node?.kind !== 'custom') return;
    expect(node.customType).toBe('verifyPolicy');
  });

  it('closes the menu after an add', () => {
    const { getByTestId, queryByTestId } = render(<Toolbar />);
    fireEvent.click(getByTestId('toolbar-add-button'));
    fireEvent.click(getByTestId('toolbar-add-start'));

    expect(queryByTestId('toolbar-add-menu')).toBeNull();
  });

  it('closes the menu when a click lands outside', () => {
    const { getByTestId, queryByTestId } = render(<Toolbar />);
    fireEvent.click(getByTestId('toolbar-add-button'));
    expect(queryByTestId('toolbar-add-menu')).toBeInTheDocument();

    // Click somewhere outside — body itself
    fireEvent.mouseDown(document.body);

    expect(queryByTestId('toolbar-add-menu')).toBeNull();
  });

  it('clear button calls workflowStore.clear when confirmed', () => {
    const original = window.confirm;
    window.confirm = vi.fn(() => true);
    workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });

    const { getByTestId } = render(<Toolbar />);
    fireEvent.click(getByTestId('toolbar-clear-button'));

    expect(Object.keys(workflowStore.getState().nodes)).toHaveLength(0);
    window.confirm = original;
  });

  it('clear button is a no-op when the user cancels the confirm', () => {
    const original = window.confirm;
    window.confirm = vi.fn(() => false);
    workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });

    const { getByTestId } = render(<Toolbar />);
    fireEvent.click(getByTestId('toolbar-clear-button'));

    expect(Object.keys(workflowStore.getState().nodes)).toHaveLength(1);
    window.confirm = original;
  });
});
