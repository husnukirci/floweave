// VariablesEditor — the variables grid inside the PropertiesPanel.
// Each row: key input · type select (string/number/boolean) · value input
// · delete button. Add Variable button appends a new empty row.
//
// Local state for in-progress edits; blur (or Enter) commits to the store
// via updateNode per PLAN.md §6 Phase 5 ("Local component state for in-
// progress edits, sync to store on blur").
//
// Stub for TDD: returns null until commit 3 lands the real impl.

import { type JSX } from 'react';

interface VariablesEditorProps {
  nodeId: string;
}

export function VariablesEditor(_props: VariablesEditorProps): JSX.Element | null {
  return null;
}
