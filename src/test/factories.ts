// Test factories — sole place test data is constructed (CLAUDE.md §9:
// "Use factories from src/test/factories.ts, never inline object literals
// for test data"). Override only what each test cares about; defaults
// keep the test focused on the behaviour under test.

import { nanoid } from 'nanoid';

import type {
  CustomNodeType,
  NodeData,
  NodeKind,
  NodePosition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowState,
} from '@/state/workflow/types';

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
