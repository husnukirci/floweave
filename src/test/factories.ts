// Test factories — sole place test data is constructed (CLAUDE.md §9:
// "Use factories from src/test/factories.ts, never inline object literals
// for test data"). Override only what each test cares about; defaults
// keep the test focused on the behaviour under test.

import { nanoid } from 'nanoid';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { createEdgesSlice } from '@/state/workflow/slices/edgesSlice';
import { createIoSlice } from '@/state/workflow/slices/ioSlice';
import { createNodesSlice } from '@/state/workflow/slices/nodesSlice';
import type { WorkflowStoreState } from '@/state/workflow/storeState';
import type {
  CustomNodeType,
  NodeData,
  NodeKind,
  NodePosition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowState,
} from '@/state/workflow/types';

export type TestWorkflowStore = UseBoundStore<StoreApi<WorkflowStoreState>>;

// Composes nodes + edges slices for tests that need cross-slice behaviour
// (notably removeNode cascade and connectNodes). Use directly in test
// setup; the real workflowStore (commit 7) adds middleware + IO slice.
export function createTestWorkflowStore(): TestWorkflowStore {
  return create<WorkflowStoreState>()(
    immer((...args) => ({
      ...createNodesSlice(...args),
      ...createEdgesSlice(...args),
      ...createIoSlice(...args),
    })),
  );
}

export interface BuildNodeOverrides {
  id?: string;
  kind?: NodeKind;
  customType?: CustomNodeType;
  position?: NodePosition;
  data?: Partial<NodeData>;
}

export function buildNode(overrides: BuildNodeOverrides = {}): WorkflowNode {
  const kind: NodeKind = overrides.kind ?? 'task';
  const id = overrides.id ?? nanoid();
  const position = overrides.position ?? { x: 0, y: 0 };
  const data: NodeData = {
    label: overrides.data?.label ?? defaultLabel(kind, overrides.customType),
    variables: overrides.data?.variables ?? {},
  };

  if (kind === 'custom') {
    return {
      id,
      kind: 'custom',
      customType: overrides.customType ?? 'createAccount',
      position,
      data,
    };
  }

  return { id, kind, position, data };
}

export interface BuildEdgeOverrides {
  id?: string;
  source: string;
  target: string;
}

export function buildEdge(overrides: BuildEdgeOverrides): WorkflowEdge {
  return {
    id: overrides.id ?? nanoid(),
    source: overrides.source,
    target: overrides.target,
  };
}

export interface BuildWorkflowOverrides {
  nodes?: Record<string, WorkflowNode>;
  edges?: Record<string, WorkflowEdge>;
}

export function buildWorkflow(overrides: BuildWorkflowOverrides = {}): WorkflowState {
  return {
    nodes: overrides.nodes ?? {},
    edges: overrides.edges ?? {},
  };
}

function defaultLabel(kind: NodeKind, customType?: CustomNodeType): string {
  if (kind === 'start') return 'Start';
  if (kind === 'end') return 'End';
  if (kind === 'task') return 'Task';
  return customType ?? 'Custom';
}
