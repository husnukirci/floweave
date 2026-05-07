// LLM tool executor — translates an Anthropic tool_use block into one
// or more workflow store Mutations and produces a tool_result block.
//
// Inputs are re-validated here even though Claude's API enforces the
// tool input_schema at the model layer — the LLM occasionally produces
// malformed output, and clearer per-tool error messages help it recover
// within the agent loop's iteration cap.
//
// Two entry points:
//   - buildToolMutations: pure (only state reads) — returns the mutations
//     a single tool_use should perform plus the human-readable success
//     message. The agent loop collects these across all tool_uses in a
//     turn and applies them as ONE applyMutations() call (CLAUDE.md §4).
//   - applyToolCall: convenience wrapper that builds and applies a single
//     tool_use's mutations through applyMutations and returns a
//     tool_result. Used by tests and callers that don't need batching.
//
// Pre-generating IDs upfront (via nanoid) lets the success messages
// reference newly-created node IDs even when they're applied inside a
// batched applyMutations call where per-mutation results aren't surfaced.

import { nanoid } from 'nanoid';
import type { StoreApi } from 'zustand';

import type { WorkflowStoreState } from '@/state/workflow/storeState';
import type {
  AddNodeInput,
  CustomNodeType,
  Mutation,
  NodeData,
  Variable,
} from '@/state/workflow/types';

import type { ToolName, ToolResultBlock, ToolUseBlock } from './tools';

const VALID_KINDS = ['start', 'end', 'task', 'custom'] as const;
const VALID_CUSTOM_TYPES = [
  'createAccount',
  'createPolicy',
  'createDocument',
  'sendEmail',
  'verifyPolicy',
  'assessDamage',
  'calculatePayout',
  'approveClaim',
  'denyClaim',
] as const satisfies readonly CustomNodeType[];

type LocalResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ToolBuildResult =
  | { ok: true; mutations: Mutation[]; successContent: string }
  | { ok: false; errorContent: string };

function ok(toolUseId: string, content: string): ToolResultBlock {
  return { type: 'tool_result', tool_use_id: toolUseId, content };
}

function err(toolUseId: string, content: string): ToolResultBlock {
  return { type: 'tool_result', tool_use_id: toolUseId, content, is_error: true };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is { x: number; y: number } {
  return isObject(value) && typeof value.x === 'number' && typeof value.y === 'number';
}

function isVariable(value: unknown): value is Variable {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function validateData(value: unknown): LocalResult<Partial<NodeData>> {
  if (value === undefined) return { ok: true, value: {} };
  if (!isObject(value)) return { ok: false, error: "'data' must be an object when supplied" };
  const out: Partial<NodeData> = {};
  if (value.label !== undefined) {
    if (typeof value.label !== 'string')
      return { ok: false, error: "'data.label' must be a string" };
    out.label = value.label;
  }
  if (value.variables !== undefined) {
    if (!isObject(value.variables)) {
      return { ok: false, error: "'data.variables' must be an object" };
    }
    const variables: Record<string, Variable> = {};
    for (const [k, v] of Object.entries(value.variables)) {
      if (!isVariable(v)) {
        return {
          ok: false,
          error: `'data.variables.${k}' must be string, number, or boolean`,
        };
      }
      variables[k] = v;
    }
    out.variables = variables;
  }
  return { ok: true, value: out };
}

// Drill down through MUTATION_FAILED errors to surface the underlying
// validator's reason code (e.g. 'duplicate-edge', 'self-loop').
function extractReason(applyError: { details?: Record<string, unknown> }): string | undefined {
  const cause = applyError.details?.cause;
  if (!isObject(cause)) return undefined;
  const causeDetails = cause.details;
  if (!isObject(causeDetails)) return undefined;
  const reason = causeDetails.reason;
  return typeof reason === 'string' ? reason : undefined;
}

export function buildToolMutations(
  toolCall: ToolUseBlock,
  store: StoreApi<WorkflowStoreState>,
): ToolBuildResult {
  const name = toolCall.name as ToolName;
  switch (name) {
    case 'add_node':
      return buildAddNode(toolCall.input);
    case 'connect_nodes':
      return buildConnectNodes(toolCall.input);
    case 'update_node':
      return buildUpdateNode(toolCall.input);
    case 'remove_node':
      return buildRemoveNode(toolCall.input, store);
    case 'insert_between':
      return buildInsertBetween(toolCall.input, store);
    default:
      return { ok: false, errorContent: `Unknown tool name: '${toolCall.name}'` };
  }
}

export function applyToolCall(
  toolCall: ToolUseBlock,
  store: StoreApi<WorkflowStoreState>,
): ToolResultBlock {
  const built = buildToolMutations(toolCall, store);
  if (!built.ok) return err(toolCall.id, built.errorContent);
  if (built.mutations.length === 0) return ok(toolCall.id, built.successContent);

  const result = store.getState().applyMutations(built.mutations);
  if (!result.ok) {
    const reason = extractReason(result.error);
    return err(
      toolCall.id,
      reason
        ? `${labelForName(toolCall.name)}: ${reason}`
        : `${labelForName(toolCall.name)}: ${result.error.message}`,
    );
  }
  return ok(toolCall.id, built.successContent);
}

function labelForName(name: string): string {
  switch (name) {
    case 'add_node':
      return 'Cannot add node';
    case 'connect_nodes':
      return 'Cannot connect nodes';
    case 'update_node':
      return 'Cannot update node';
    case 'remove_node':
      return 'Cannot remove node';
    case 'insert_between':
      return 'Cannot insert between';
    default:
      return 'Tool failed';
  }
}

function buildAddNode(input: unknown): ToolBuildResult {
  const built = parseAddNodeInput(input);
  if (!built.ok) return { ok: false, errorContent: built.error };

  const id = nanoid();
  const successContent = `Added ${built.value.kind} node '${id}' at (${String(built.value.position.x)}, ${String(built.value.position.y)}).`;
  return {
    ok: true,
    mutations: [{ kind: 'addNode', input: built.value, id }],
    successContent,
  };
}

function parseAddNodeInput(input: unknown): LocalResult<AddNodeInput> {
  if (!isObject(input))
    return { ok: false, error: 'Cannot add node: tool input must be an object' };
  const { kind, customType, position, data } = input;

  if (typeof kind !== 'string' || !(VALID_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false,
      error: `Cannot add node: 'kind' must be one of start, end, task, custom (got ${JSON.stringify(kind)})`,
    };
  }
  if (!isPosition(position)) {
    return { ok: false, error: "Cannot add node: 'position' must be { x: number, y: number }" };
  }
  const dataValidation = validateData(data);
  if (!dataValidation.ok) return { ok: false, error: `Cannot add node: ${dataValidation.error}` };

  if (kind === 'custom') {
    if (
      typeof customType !== 'string' ||
      !(VALID_CUSTOM_TYPES as readonly string[]).includes(customType)
    ) {
      return {
        ok: false,
        error: `Cannot add node: 'customType' is required and must be one of the 9 insurance kinds when kind === 'custom' (got ${JSON.stringify(customType)})`,
      };
    }
    return {
      ok: true,
      value: {
        kind: 'custom',
        customType: customType as CustomNodeType,
        position,
        data: dataValidation.value,
      },
    };
  }

  return {
    ok: true,
    value: {
      kind: kind as 'start' | 'end' | 'task',
      position,
      data: dataValidation.value,
    },
  };
}

function buildConnectNodes(input: unknown): ToolBuildResult {
  if (!isObject(input)) {
    return { ok: false, errorContent: 'Cannot connect nodes: input must be an object' };
  }
  const { source, target } = input;
  if (typeof source !== 'string' || typeof target !== 'string') {
    return {
      ok: false,
      errorContent: "Cannot connect nodes: 'source' and 'target' must be strings",
    };
  }
  return {
    ok: true,
    mutations: [{ kind: 'connectNodes', input: { source, target } }],
    successContent: `Connected '${source}' → '${target}'.`,
  };
}

function buildUpdateNode(input: unknown): ToolBuildResult {
  if (!isObject(input)) {
    return { ok: false, errorContent: 'Cannot update node: input must be an object' };
  }
  const { id, data, position } = input;
  if (typeof id !== 'string') {
    return { ok: false, errorContent: "Cannot update node: 'id' must be a string" };
  }
  const dataValidation = validateData(data);
  if (!dataValidation.ok) {
    return { ok: false, errorContent: `Cannot update node: ${dataValidation.error}` };
  }
  if (position !== undefined && !isPosition(position)) {
    return {
      ok: false,
      errorContent: "Cannot update node: 'position' must be { x: number, y: number }",
    };
  }
  return {
    ok: true,
    mutations: [
      {
        kind: 'updateNode',
        id,
        patch: {
          data: dataValidation.value,
          position,
        },
      },
    ],
    successContent: `Updated node '${id}'.`,
  };
}

function buildRemoveNode(input: unknown, store: StoreApi<WorkflowStoreState>): ToolBuildResult {
  if (!isObject(input)) {
    return { ok: false, errorContent: 'Cannot remove node: input must be an object' };
  }
  const { id } = input;
  if (typeof id !== 'string') {
    return { ok: false, errorContent: "Cannot remove node: 'id' must be a string" };
  }
  // Pre-flight existence check so the success message can mention the
  // cascade-deleted edge count without a per-mutation result lookup.
  if (!store.getState().nodes[id]) {
    return { ok: false, errorContent: `Cannot remove node '${id}': not found` };
  }
  const cascadingEdges = Object.values(store.getState().edges).filter(
    (e) => e.source === id || e.target === id,
  ).length;
  return {
    ok: true,
    mutations: [{ kind: 'removeNode', id }],
    successContent:
      cascadingEdges > 0
        ? `Removed node '${id}' and cascade-deleted ${String(cascadingEdges)} edge(s).`
        : `Removed node '${id}'.`,
  };
}

function buildInsertBetween(input: unknown, store: StoreApi<WorkflowStoreState>): ToolBuildResult {
  if (!isObject(input)) {
    return { ok: false, errorContent: 'Cannot insert between: input must be an object' };
  }
  const { source, target, kind, customType, data } = input;
  if (typeof source !== 'string' || typeof target !== 'string') {
    return {
      ok: false,
      errorContent: "Cannot insert between: 'source' and 'target' must be strings",
    };
  }
  if (kind !== 'task' && kind !== 'custom') {
    return {
      ok: false,
      errorContent: `Cannot insert between: 'kind' must be 'task' or 'custom' (got ${JSON.stringify(kind)})`,
    };
  }

  const state = store.getState();
  const sourceNode = state.nodes[source];
  const targetNode = state.nodes[target];
  if (!sourceNode || !targetNode) {
    return {
      ok: false,
      errorContent: `Cannot insert between '${source}' and '${target}': source or target not found`,
    };
  }
  const existingEdge = Object.values(state.edges).find(
    (e) => e.source === source && e.target === target,
  );
  if (!existingEdge) {
    return {
      ok: false,
      errorContent: `Cannot insert between '${source}' and '${target}': nodes are not connected`,
    };
  }

  const dataValidation = validateData(data);
  if (!dataValidation.ok) {
    return { ok: false, errorContent: `Cannot insert between: ${dataValidation.error}` };
  }

  const midPosition = {
    x: Math.round((sourceNode.position.x + targetNode.position.x) / 2),
    y: Math.round((sourceNode.position.y + targetNode.position.y) / 2),
  };
  const newId = nanoid();

  let addInput: AddNodeInput;
  if (kind === 'custom') {
    if (
      typeof customType !== 'string' ||
      !(VALID_CUSTOM_TYPES as readonly string[]).includes(customType)
    ) {
      return {
        ok: false,
        errorContent:
          "Cannot insert between: 'customType' is required and must be a valid insurance kind when kind === 'custom'",
      };
    }
    addInput = {
      kind: 'custom',
      customType: customType as CustomNodeType,
      position: midPosition,
      data: dataValidation.value,
    };
  } else {
    addInput = { kind: 'task', position: midPosition, data: dataValidation.value };
  }

  return {
    ok: true,
    mutations: [
      { kind: 'removeEdge', id: existingEdge.id },
      { kind: 'addNode', input: addInput, id: newId },
      { kind: 'connectNodes', input: { source, target: newId } },
      { kind: 'connectNodes', input: { source: newId, target } },
    ],
    successContent: `Inserted ${addInput.kind} node '${newId}' between '${source}' and '${target}'.`,
  };
}
