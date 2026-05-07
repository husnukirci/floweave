// Toolbar component tests — exercises the Add menu, the IO buttons, and
// outside-click dismissal. Bound to the singleton workflow store as the
// rest of the canvas-level tests; per-test isolation via clear() in
// beforeEach.

import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUiStore, type UiStore } from '@/state/ui/uiStore';
import {
  createTestWorkflowStore,
  renderWithStores,
  type TestWorkflowStore,
} from '@/test/factories';

import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  let workflowStore: TestWorkflowStore;
  let uiStore: UiStore;

  const renderToolbar = () => renderWithStores(<Toolbar />, { stores: { workflowStore, uiStore } });

  beforeEach(() => {
    workflowStore = createTestWorkflowStore();
    uiStore = createUiStore();
  });

  afterEach(() => {
    workflowStore.getState().clear();
  });

  it('renders the four primary buttons', () => {
    const { getByTestId } = renderToolbar();

    expect(getByTestId('toolbar-add-button')).toBeInTheDocument();
    expect(getByTestId('toolbar-import-button')).toBeInTheDocument();
    expect(getByTestId('toolbar-export-button')).toBeInTheDocument();
    expect(getByTestId('toolbar-clear-button')).toBeInTheDocument();
    expect(getByTestId('toolbar-chat-button')).toBeInTheDocument();
  });

  it('opens the add menu on click and closes again on a second click', () => {
    const { getByTestId, queryByTestId } = renderToolbar();
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
    const { getByTestId } = renderToolbar();

    fireEvent.click(getByTestId('toolbar-add-button'));
    fireEvent.click(getByTestId('toolbar-add-task'));

    const nodes = Object.values(workflowStore.getState().nodes);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.kind).toBe('task');
  });

  it('adds a custom node carrying the customType discriminant', () => {
    const { getByTestId } = renderToolbar();

    fireEvent.click(getByTestId('toolbar-add-button'));
    fireEvent.click(getByTestId('toolbar-add-verifyPolicy'));

    const node = Object.values(workflowStore.getState().nodes)[0];
    expect(node?.kind).toBe('custom');
    if (node?.kind !== 'custom') return;
    expect(node.customType).toBe('verifyPolicy');
  });

  it('closes the menu after an add', () => {
    const { getByTestId, queryByTestId } = renderToolbar();
    fireEvent.click(getByTestId('toolbar-add-button'));
    fireEvent.click(getByTestId('toolbar-add-start'));

    expect(queryByTestId('toolbar-add-menu')).toBeNull();
  });

  it('closes the menu when a click lands outside', () => {
    const { getByTestId, queryByTestId } = renderToolbar();
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

    const { getByTestId } = renderToolbar();
    fireEvent.click(getByTestId('toolbar-clear-button'));

    expect(Object.keys(workflowStore.getState().nodes)).toHaveLength(0);
    window.confirm = original;
  });

  it('clear button is a no-op when the user cancels the confirm', () => {
    const original = window.confirm;
    window.confirm = vi.fn(() => false);
    workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });

    const { getByTestId } = renderToolbar();
    fireEvent.click(getByTestId('toolbar-clear-button'));

    expect(Object.keys(workflowStore.getState().nodes)).toHaveLength(1);
    window.confirm = original;
  });

  it('toggles the chat panel on click', () => {
    const { getByTestId } = renderToolbar();
    expect(uiStore.getState().panels.chat).toBe(false);

    fireEvent.click(getByTestId('toolbar-chat-button'));
    expect(uiStore.getState().panels.chat).toBe(true);
    expect(getByTestId('toolbar-chat-button')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(getByTestId('toolbar-chat-button'));
    expect(uiStore.getState().panels.chat).toBe(false);
  });

  describe('keyboard navigation', () => {
    it('focuses the first item when the menu opens', async () => {
      const { getByTestId } = renderToolbar();
      fireEvent.click(getByTestId('toolbar-add-button'));

      // useEffect runs after render — wait a microtask
      await Promise.resolve();
      expect(document.activeElement).toBe(getByTestId('toolbar-add-start'));
    });

    it('ArrowDown moves focus to the next menu item', async () => {
      const { getByTestId } = renderToolbar();
      fireEvent.click(getByTestId('toolbar-add-button'));
      await Promise.resolve();

      fireEvent.keyDown(getByTestId('toolbar-add-menu'), { key: 'ArrowDown' });
      expect(document.activeElement).toBe(getByTestId('toolbar-add-task'));
    });

    it('ArrowUp from the first item wraps to the last', async () => {
      const { getByTestId } = renderToolbar();
      fireEvent.click(getByTestId('toolbar-add-button'));
      await Promise.resolve();

      fireEvent.keyDown(getByTestId('toolbar-add-menu'), { key: 'ArrowUp' });
      // Last menu item is the 9th custom node — denyClaim
      expect(document.activeElement).toBe(getByTestId('toolbar-add-denyClaim'));
    });

    it('Escape closes the menu and returns focus to the Add button', async () => {
      const { getByTestId, queryByTestId } = renderToolbar();
      fireEvent.click(getByTestId('toolbar-add-button'));
      await Promise.resolve();

      fireEvent.keyDown(getByTestId('toolbar-add-menu'), { key: 'Escape' });

      expect(queryByTestId('toolbar-add-menu')).toBeNull();
      expect(document.activeElement).toBe(getByTestId('toolbar-add-button'));
    });

    it('Home jumps to the first item; End jumps to the last', async () => {
      const { getByTestId } = renderToolbar();
      fireEvent.click(getByTestId('toolbar-add-button'));
      await Promise.resolve();

      fireEvent.keyDown(getByTestId('toolbar-add-menu'), { key: 'End' });
      expect(document.activeElement).toBe(getByTestId('toolbar-add-denyClaim'));

      fireEvent.keyDown(getByTestId('toolbar-add-menu'), { key: 'Home' });
      expect(document.activeElement).toBe(getByTestId('toolbar-add-start'));
    });
  });
});
