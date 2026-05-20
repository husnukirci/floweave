// PropertiesPanel — right-side panel that opens when a node is selected.
// Renders kind / custom-type chips, the label input, and the embedded
// VariablesEditor (commit 3 fills in the editor's real impl). Mounted by
// App when uiStore.selectedNodeId !== null.
//
// Local-state-then-blur per PLAN.md §6 Phase 5 — the label input updates
// local state on every keystroke; blur (or Enter) commits via updateNode.
// Avoids per-keystroke store updates that would re-render the whole canvas.

import { X } from 'lucide-react';
import {
  type ChangeEvent,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { CUSTOM_NODE_REGISTRY } from '@/nodes/registry';
import { useUiStoreApi, useWorkflowStore, useWorkflowStoreApi } from '@/state/StoresProvider';
import { selectNodeById } from '@/state/workflow/selectors';
import type { WorkflowNode } from '@/state/workflow/types';

import { VariablesEditor } from './VariablesEditor';

interface PropertiesPanelProps {
  nodeId: string;
}

export function PropertiesPanel({ nodeId }: PropertiesPanelProps): JSX.Element | null {
  const node = useWorkflowStore(selectNodeById(nodeId));
  // Reset local state when the selected node id changes by keying the
  // inner stateful component on it. Cleaner than the prop-into-state
  // useEffect dance flagged by react-hooks/set-state-in-effect.
  if (!node) return null;
  return <PropertiesPanelInner key={nodeId} node={node} />;
}

function PropertiesPanelInner({ node }: { node: WorkflowNode }): JSX.Element {
  const [label, setLabel] = useState<string>(node.data.label);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const nodeId = node.id;
  const workflowStoreApi = useWorkflowStoreApi();
  const uiStoreApi = useUiStoreApi();

  const closePanel = (): void => {
    uiStoreApi.getState().selectNode(null);
  };

  // Move keyboard focus to the label input when the panel opens (i.e.
  // each time a different node is selected — the parent keys this
  // component on nodeId so this effect fires once per selection).
  useEffect(() => {
    const input = labelInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  // Escape closes the panel from anywhere inside it. The label
  // input has its own Escape handler that discards the in-progress
  // edit; we only close when the input isn't capturing the keystroke.
  useEffect(() => {
    const node = asideRef.current;
    if (!node) return;
    const handle = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // Label input's own keydown runs first via the React tree;
      // if the user is mid-edit, that one prevents default. Check
      // here so we don't double-fire.
      if (event.defaultPrevented) return;
      uiStoreApi.getState().selectNode(null);
    };
    node.addEventListener('keydown', handle);
    return () => {
      node.removeEventListener('keydown', handle);
    };
  }, [uiStoreApi]);

  const commitLabel = (): void => {
    if (label === node.data.label) return;
    workflowStoreApi.getState().updateNode(nodeId, {
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
      ref={asideRef}
      aria-label="Node properties"
      data-testid="properties-panel"
      className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-neutral-200 bg-white p-4 text-sm"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Properties
        </div>
        <button
          type="button"
          onClick={closePanel}
          aria-label="Close properties"
          data-testid="properties-close"
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
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
          ref={labelInputRef}
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
