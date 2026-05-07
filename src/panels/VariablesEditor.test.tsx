// VariablesEditor tests — the trickiest UI in the app per PLAN.md §6
// Phase 5. Verifies row rendering per variable, add/delete, key/value
// edits committed on blur, and type-change conversion semantics.

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VariablesEditor } from './VariablesEditor';
import { workflowStore } from '@/state/workflow/instance';

describe('VariablesEditor', () => {
  beforeEach(() => {
    workflowStore.getState().clear();
  });

  afterEach(() => {
    workflowStore.getState().clear();
  });

  function setupNodeWithVariables(variables: Record<string, string | number | boolean>): string {
    const result = workflowStore.getState().addNode({
      kind: 'task',
      position: { x: 0, y: 0 },
      data: { label: 'T', variables },
    });
    if (!result.ok) throw new Error('setup');
    return result.value.id;
  }

  it('renders one row per existing variable', () => {
    const id = setupNodeWithVariables({ claimType: 'water', isUrgent: true, count: 3 });
    const { getAllByTestId } = render(<VariablesEditor nodeId={id} />);

    expect(getAllByTestId(/^variable-row-/).length).toBe(3);
  });

  it('renders an empty list when there are no variables', () => {
    const id = setupNodeWithVariables({});
    const { queryAllByTestId } = render(<VariablesEditor nodeId={id} />);

    expect(queryAllByTestId(/^variable-row-/).length).toBe(0);
  });

  it('clicking Add Variable creates a new empty row in local state', () => {
    const id = setupNodeWithVariables({});
    const { getByTestId, getAllByTestId } = render(<VariablesEditor nodeId={id} />);

    fireEvent.click(getByTestId('variables-add-button'));

    expect(getAllByTestId(/^variable-row-/).length).toBe(1);
  });

  it('committing a key/value pair on blur writes through to the store', () => {
    const id = setupNodeWithVariables({});
    const { getByTestId } = render(<VariablesEditor nodeId={id} />);

    fireEvent.click(getByTestId('variables-add-button'));
    const keyInput = getByTestId('variables-key-input-0') as HTMLInputElement;
    const valueInput = getByTestId('variables-value-input-0') as HTMLInputElement;

    fireEvent.change(keyInput, { target: { value: 'claimType' } });
    fireEvent.change(valueInput, { target: { value: 'water' } });
    fireEvent.blur(valueInput);

    expect(workflowStore.getState().nodes[id]?.data.variables).toEqual({ claimType: 'water' });
  });

  it('changing the type from string to number converts the value', () => {
    const id = setupNodeWithVariables({ count: '42' });
    const { getByTestId } = render(<VariablesEditor nodeId={id} />);
    const typeSelect = getByTestId('variables-type-select-0') as HTMLSelectElement;

    fireEvent.change(typeSelect, { target: { value: 'number' } });
    fireEvent.blur(typeSelect);

    expect(workflowStore.getState().nodes[id]?.data.variables).toEqual({ count: 42 });
  });

  it('changing type to boolean coerces falsy / truthy values', () => {
    const id = setupNodeWithVariables({ active: 'true' });
    const { getByTestId } = render(<VariablesEditor nodeId={id} />);
    const typeSelect = getByTestId('variables-type-select-0') as HTMLSelectElement;

    fireEvent.change(typeSelect, { target: { value: 'boolean' } });
    fireEvent.blur(typeSelect);

    expect(workflowStore.getState().nodes[id]?.data.variables).toEqual({ active: true });
  });

  it('clicking the row delete button removes the variable from the store', () => {
    const id = setupNodeWithVariables({ a: '1', b: '2' });
    const { getByTestId, getAllByTestId } = render(<VariablesEditor nodeId={id} />);

    expect(getAllByTestId(/^variable-row-/).length).toBe(2);
    fireEvent.click(getByTestId('variables-delete-button-0'));

    const remaining = workflowStore.getState().nodes[id]?.data.variables;
    expect(Object.keys(remaining ?? {})).toHaveLength(1);
  });
});
