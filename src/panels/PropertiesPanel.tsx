// PropertiesPanel — right-side panel that opens when a node is selected.
// Renders label input, kind chip, custom-type chip (if applicable), and
// the VariablesEditor. Mounted by App when uiStore.selectedNodeId !== null.
//
// Stub for TDD: returns null until commit 2 lands the real impl.

import { type JSX } from 'react';

interface PropertiesPanelProps {
  nodeId: string;
}

export function PropertiesPanel(_props: PropertiesPanelProps): JSX.Element | null {
  return null;
}
