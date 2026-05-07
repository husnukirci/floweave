// PropertiesPanel — right-side panel that opens when a node is selected.
// Renders kind / custom-type chips, the label input, and the embedded
// VariablesEditor (commit 3 fills in the editor's real impl). Mounted by
// App when uiStore.selectedNodeId !== null.
//
// Local-state-then-blur per PLAN.md §6 Phase 5 — the label input updates
// local state on every keystroke; blur (or Enter) commits via updateNode.
// Avoids per-keystroke store updates that would re-render the whole canvas.

import {
  type ChangeEvent,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  useState,
} from 'react';

import { CUSTOM_NODE_REGISTRY } from '@/nodes/registry';
import { selectNodeById } from '@/state/workflow/selectors';
import { workflowStore } from '@/state/workflow/instance';
import type { WorkflowNode } from '@/state/workflow/types';

import { VariablesEditor } from './VariablesEditor';

interface PropertiesPanelProps {
  nodeId: string;
}

export function PropertiesPanel({ nodeId }: PropertiesPanelProps): JSX.Element | null {
  const node = workflowStore(selectNodeById(nodeId));
  // Reset local state when the selected node id changes by keying the
  // inner stateful component on it. Cleaner than the prop-into-state
  // useEffect dance flagged by react-hooks/set-state-in-effect.
  if (!node) return null;
  return <PropertiesPanelInner key={nodeId} node={node} />;
}

function PropertiesPanelInner({ node }: { node: WorkflowNode }): JSX.Element {
  const [label, setLabel] = useState<string>(node.data.label);
  const nodeId = node.id;

  const commitLabel = (): void => {
    if (label === node.data.label) return;
    workflowStore.getState().updateNode(nodeId, {
      data: { label, variables: node.data.variables },
    });
  };

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setLabel(event.target.value);
  };

  const handleLabelKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitLabel();
    }
    if (event.key === 'Escape') {
      // Discard the in-progress edit
      event.preventDefault();
      setLabel(node.data.label);
    }
  };

  const customSpec = node.kind === 'custom' ? CUSTOM_NODE_REGISTRY[node.customType] : null;

  return (
    <aside
      aria-label="Node properties"
      data-testid="properties-panel"
      className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-neutral-200 bg-white p-4 text-sm"
    >
      <section>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Node Type
        </div>
        <div
          data-testid="properties-kind"
          className="mt-1 flex items-center gap-1.5 text-neutral-800"
        >
          {customSpec ? (
            <>
              <customSpec.icon className={`h-4 w-4 ${customSpec.iconClass}`} aria-hidden />
              <span data-testid="properties-custom-type">{customSpec.label}</span>
            </>
          ) : (
            <>
              <span className="inline-block h-3 w-3 rounded-full bg-neutral-300" aria-hidden />
              {capitalize(node.kind)}
            </>
          )}
        </div>
      </section>

      <section>
        <label
          htmlFor="properties-label-input"
          className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Label
        </label>
        <input
          id="properties-label-input"
          data-testid="properties-label-input"
          type="text"
          value={label}
          onChange={handleLabelChange}
          onBlur={commitLabel}
          onKeyDown={handleLabelKeyDown}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
      </section>

      <section className="flex-1">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Variables
        </div>
        <VariablesEditor nodeId={nodeId} />
      </section>
    </aside>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
