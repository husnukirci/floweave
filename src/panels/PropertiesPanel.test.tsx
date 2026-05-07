// PropertiesPanel tests — exercises the panel's render shape, label
// editing, and kind/customType chips. Bound to the singleton workflow
// store; per-test isolation via clear() in beforeEach.

import { fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createUiStore, type UiStore } from '@/state/ui/uiStore';
import {
  createTestWorkflowStore,
  renderWithStores,
  type TestWorkflowStore,
} from '@/test/factories';

import { PropertiesPanel } from './PropertiesPanel';

describe('PropertiesPanel', () => {
  let workflowStore: TestWorkflowStore;
  let uiStore: UiStore;

  const renderPanel = (ui: ReactElement) =>
    renderWithStores(ui, { stores: { workflowStore, uiStore } });

  beforeEach(() => {
    workflowStore = createTestWorkflowStore();
    uiStore = createUiStore();
  });

  afterEach(() => {
    workflowStore.getState().clear();
  });

  it('renders the panel with the node label as the input value', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 0, y: 0 },
      data: { label: 'Verify Coverage', variables: {} },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderPanel(<PropertiesPanel nodeId={result.value.id} />);
    const input = getByTestId('properties-label-input') as HTMLInputElement;

    expect(input.value).toBe('Verify Coverage');
  });

  it('renders the kind chip', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 0, y: 0 },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderPanel(<PropertiesPanel nodeId={result.value.id} />);
    expect(getByTestId('properties-kind')).toHaveTextContent(/task/i);
  });

  it('renders the custom-type chip for custom nodes', () => {
    const result = workflowStore.getState().addNode({
      kind: 'custom',
      customType: 'verifyPolicy',
      position: { x: 0, y: 0 },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderPanel(<PropertiesPanel nodeId={result.value.id} />);
    expect(getByTestId('properties-custom-type')).toHaveTextContent('Verify Policy');
  });

  it('renders nothing when the node id is unknown', () => {
    const { container } = renderPanel(<PropertiesPanel nodeId="missing" />);
    expect(container.firstChild).toBeNull();
  });

  it('commits label edits to the store on blur', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 0, y: 0 },
      data: { label: 'Initial', variables: {} },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderPanel(<PropertiesPanel nodeId={result.value.id} />);
    const input = getByTestId('properties-label-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Updated' } });
    // Edit is local until blur
    expect(workflowStore.getState().nodes[result.value.id]?.data.label).toBe('Initial');

    fireEvent.blur(input);
    expect(workflowStore.getState().nodes[result.value.id]?.data.label).toBe('Updated');
  });

  it('focuses the label input when the panel mounts', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 0, y: 0 },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderPanel(<PropertiesPanel nodeId={result.value.id} />);
    expect(document.activeElement).toBe(getByTestId('properties-label-input'));
  });

  it('commits label edits on Enter as well as on blur', () => {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 0, y: 0 },
      data: { label: 'Initial', variables: {} },
    });
    if (!result.ok) throw new Error('setup');

    const { getByTestId } = renderPanel(<PropertiesPanel nodeId={result.value.id} />);
    const input = getByTestId('properties-label-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Submitted' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(workflowStore.getState().nodes[result.value.id]?.data.label).toBe('Submitted');
  });
});
