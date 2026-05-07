// IO slice — workflow-level actions that don't fit nodes or edges:
// exportJSON, importJSON (with schema validation), applyMutations
// (single-batch driver for LLM-driven changes), and clear.
//
// importJSON validates the parsed input against the WorkflowState
// schema before any state mutation. State is replaced atomically only
// when validation passes; on failure the existing state is untouched.
//
// applyMutations applies operations in order; if one fails, returns
// Result.err with the failed index in details. Previously-applied
// mutations are not rolled back (partial application is acceptable —
// the LLM agent loop sees the failure and decides next steps). True
// atomic rollback is a Tier 2 add-on.

import type { StateCreator } from 'zustand';

import type { WorkflowStoreState } from '../storeState';
import type {
  CustomNodeType,
  Mutation,
  Result,
  StoreError,
  Variable,
  WorkflowEdge,
  WorkflowNode,
  WorkflowState,
} from '../types';

export interface IoSlice {
  exportJSON: () => string;
  importJSON: (json: string) => Result<{ nodeCount: number; edgeCount: number }>;
  applyMutations: (mutations: readonly Mutation[]) => Result<{ applied: number }>;
  clear: () => void;
}

const CUSTOM_NODE_TYPES: readonly CustomNodeType[] = [
  'createAccount',
  'createPolicy',
  'createDocument',
  'sendEmail',
  'verifyPolicy',
  'assessDamage',
  'calculatePayout',
  'approveClaim',
  'denyClaim',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVariable(value: unknown): value is Variable {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isPosition(value: unknown): value is { x: number; y: number } {
  return isObject(value) && typeof value.x === 'number' && typeof value.y === 'number';
}

function isNodeData(value: unknown): value is WorkflowNode['data'] {
  if (!isObject(value)) return false;
  if (typeof value.label !== 'string') return false;
  if (!isObject(value.variables)) return false;
  return Object.values(value.variables).every(isVariable);
}

function isCustomNodeType(value: unknown): value is CustomNodeType {
  return typeof value === 'string' && (CUSTOM_NODE_TYPES as readonly string[]).includes(value);
}

function isWorkflowNode(value: unknown): value is WorkflowNode {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (!isPosition(value.position)) return false;
  if (!isNodeData(value.data)) return false;
  switch (value.kind) {
    case 'start':
    case 'end':
    case 'task':
      return true;
    case 'custom':
      return isCustomNodeType(value.customType);
    default:
      return false;
  }
}

function isWorkflowEdge(value: unknown): value is WorkflowEdge {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.target === 'string'
  );
}

function isWorkflowState(value: unknown): value is WorkflowState {
  if (!isObject(value)) return false;
  if (!isObject(value.nodes)) return false;
  if (!isObject(value.edges)) return false;
  if (!Object.values(value.nodes).every(isWorkflowNode)) return false;
  if (!Object.values(value.edges).every(isWorkflowEdge)) return false;
  return true;
}

function applyMutation(store: WorkflowStoreState, mutation: Mutation): Result<unknown> {
  switch (mutation.kind) {
    case 'addNode':
      return store.addNode(mutation.input, mutation.id);
    case 'updateNode':
      return store.updateNode(mutation.id, mutation.patch);
    case 'moveNode':
      return store.moveNode(mutation.id, mutation.position);
    case 'removeNode':
      return store.removeNode(mutation.id);
    case 'connectNodes':
      return store.connectNodes(mutation.input);
    case 'removeEdge':
      return store.removeEdge(mutation.id);
  }
}

function mutationFailed(index: number, mutation: Mutation, cause: StoreError): StoreError {
  return {
    code: 'MUTATION_FAILED',
    message: `Mutation ${String(index)} (${mutation.kind}) failed: ${cause.message}`,
    details: { index, kind: mutation.kind, cause },
  };
}

export const createIoSlice: StateCreator<
  WorkflowStoreState,
  [['zustand/immer', never]],
  [],
  IoSlice
> = (set, get) => ({
  exportJSON: () => {
    const { nodes, edges } = get();
    return JSON.stringify({ nodes, edges });
  },

  importJSON: (json) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return {
        ok: false,
        error: { code: 'INVALID_JSON', message: 'Failed to parse workflow JSON' },
      };
    }

    if (!isWorkflowState(parsed)) {
      return {
        ok: false,
        error: {
          code: 'SCHEMA_INVALID',
          message: 'Workflow JSON does not match the expected schema',
        },
      };
    }

    set((state) => {
      state.nodes = parsed.nodes;
      state.edges = parsed.edges;
    });

    return {
      ok: true,
      value: {
        nodeCount: Object.keys(parsed.nodes).length,
        edgeCount: Object.keys(parsed.edges).length,
      },
    };
  },

  applyMutations: (mutations) => {
    for (const [index, mutation] of mutations.entries()) {
      const result = applyMutation(get(), mutation);
      if (!result.ok) {
        return { ok: false, error: mutationFailed(index, mutation, result.error) };
      }
    }
    return { ok: true, value: { applied: mutations.length } };
  },

  clear: () => {
    set((state) => {
      state.nodes = {};
      state.edges = {};
    });
  },
});
