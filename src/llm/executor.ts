// LLM tool executor — translates an Anthropic tool_use block into one
// or more workflow store actions and produces a tool_result block.
//
// Inputs are re-validated here even though Claude's API enforces the
// tool input_schema at the model layer — the LLM occasionally produces
// malformed output, and clearer per-tool error messages help it recover
// within the agent loop's iteration cap.
//
// Per-tool calls bypass applyMutations and call store actions directly.
// The agent loop in commit 5 batches across multiple tool_use blocks
// per turn via applyMutations to satisfy CLAUDE.md §4. The unit
// executor runs one tool at a time, so direct action calls are correct
// at this layer.

import type { StoreApi } from 'zustand';

import type { WorkflowStoreState } from '@/state/workflow/storeState';
import type { AddNodeInput, CustomNodeType, NodeData, Variable } from '@/state/workflow/types';

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

export function applyToolCall(
  toolCall: ToolUseBlock,
  store: StoreApi<WorkflowStoreState>,
): ToolResultBlock {
  const name = toolCall.name as ToolName;
  switch (name) {
    case 'add_node':
      return applyAddNode(toolCall, store);
    case 'connect_nodes':
      return applyConnectNodes(toolCall, store);
    case 'update_node':
      return applyUpdateNode(toolCall, store);
    case 'remove_node':
      return applyRemoveNode(toolCall, store);
    case 'insert_between':
      return applyInsertBetween(toolCall, store);
    default:
      return err(toolCall.id, `Unknown tool name: '${toolCall.name}'`);
  }
}

function applyAddNode(
  toolCall: ToolUseBlock,
  store: StoreApi<WorkflowStoreState>,
): ToolResultBlock {
  const built = buildAddNodeInput(toolCall.input);
  if (!built.ok) return err(toolCall.id, built.error);

  const result = store.getState().addNode(built.value);
  if (!result.ok) {
    return err(toolCall.id, `Cannot add node: ${result.error.code} ${result.error.message}`);
  }
  return ok(
    toolCall.id,
    `Added ${result.value.kind} node '${result.value.id}' at (${String(
      result.value.position.x,
    )}, ${String(result.value.position.y)}).`,
  );
}

function buildAddNodeInput(input: unknown): LocalResult<AddNodeInput> {
  if (!isObject(input)) return { ok: false, error: 'tool input must be an object' };
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

function applyConnectNodes(
  toolCall: ToolUseBlock,
  store: StoreApi<WorkflowStoreState>,
): ToolResultBlock {
  if (!isObject(toolCall.input)) {
    return err(toolCall.id, 'Cannot connect nodes: input must be an object');
  }
  const { source, target } = toolCall.input;
  if (typeof source !== 'string' || typeof target !== 'string') {
    return err(toolCall.id, "Cannot connect nodes: 'source' and 'target' must be strings");
  }
  const result = store.getState().connectNodes({ source, target });
  if (!result.ok) {
    const reason = result.error.details?.reason;
    return err(
      toolCall.id,
      `Cannot connect '${source}' → '${target}': ${typeof reason === 'string' ? reason : result.error.code}`,
    );
  }
  return ok(toolCall.id, `Connected '${source}' → '${target}' (edge id: '${result.value.id}').`);
}

function applyUpdateNode(
  toolCall: ToolUseBlock,
  store: StoreApi<WorkflowStoreState>,
): ToolResultBlock {
  if (!isObject(toolCall.input)) {
    return err(toolCall.id, 'Cannot update node: input must be an object');
  }
  const { id, data, position } = toolCall.input;
  if (typeof id !== 'string') {
    return err(toolCall.id, "Cannot update node: 'id' must be a string");
  }
  const dataValidation = validateData(data);
  if (!dataValidation.ok) return err(toolCall.id, `Cannot update node: ${dataValidation.error}`);
  if (position !== undefined && !isPosition(position)) {
    return err(toolCall.id, "Cannot update node: 'position' must be { x: number, y: number }");
  }
  const result = store.getState().updateNode(id, {
    data: dataValidation.value,
    position,
  });
  if (!result.ok) {
    return err(
      toolCall.id,
      `Cannot update node '${id}': ${result.error.code === 'NODE_NOT_FOUND' ? 'not found' : result.error.message}`,
    );
  }
  return ok(toolCall.id, `Updated node '${id}'.`);
}

function applyRemoveNode(
  toolCall: ToolUseBlock,
  store: StoreApi<WorkflowStoreState>,
): ToolResultBlock {
  if (!isObject(toolCall.input)) {
    return err(toolCall.id, 'Cannot remove node: input must be an object');
  }
  const { id } = toolCall.input;
  if (typeof id !== 'string') {
    return err(toolCall.id, "Cannot remove node: 'id' must be a string");
  }
  const result = store.getState().removeNode(id);
  if (!result.ok) {
    return err(
      toolCall.id,
      `Cannot remove node '${id}': ${result.error.code === 'NODE_NOT_FOUND' ? 'not found' : result.error.message}`,
    );
  }
  const removedEdges = result.value.removedEdgeIds.length;
  return ok(
    toolCall.id,
    `Removed node '${id}'${removedEdges > 0 ? ` and cascade-deleted ${String(removedEdges)} edge(s)` : ''}.`,
  );
}

function applyInsertBetween(
  toolCall: ToolUseBlock,
  store: StoreApi<WorkflowStoreState>,
): ToolResultBlock {
  if (!isObject(toolCall.input)) {
    return err(toolCall.id, 'Cannot insert between: input must be an object');
  }
  const { source, target, kind, customType, data } = toolCall.input;
  if (typeof source !== 'string' || typeof target !== 'string') {
    return err(toolCall.id, "Cannot insert between: 'source' and 'target' must be strings");
  }
  if (kind !== 'task' && kind !== 'custom') {
    return err(
      toolCall.id,
      `Cannot insert between: 'kind' must be 'task' or 'custom' (got ${JSON.stringify(kind)})`,
    );
  }

  const state = store.getState();
  const sourceNode = state.nodes[source];
  const targetNode = state.nodes[target];
  if (!sourceNode || !targetNode) {
    return err(
      toolCall.id,
      `Cannot insert between '${source}' and '${target}': source or target not found`,
    );
  }
  const existingEdge = Object.values(state.edges).find(
    (e) => e.source === source && e.target === target,
  );
  if (!existingEdge) {
    return err(
      toolCall.id,
      `Cannot insert between '${source}' and '${target}': nodes are not connected`,
    );
  }

  const dataValidation = validateData(data);
  if (!dataValidation.ok) {
    return err(toolCall.id, `Cannot insert between: ${dataValidation.error}`);
  }

  const midPosition = {
    x: Math.round((sourceNode.position.x + targetNode.position.x) / 2),
    y: Math.round((sourceNode.position.y + targetNode.position.y) / 2),
  };

  let addInput: AddNodeInput;
  if (kind === 'custom') {
    if (
      typeof customType !== 'string' ||
      !(VALID_CUSTOM_TYPES as readonly string[]).includes(customType)
    ) {
      return err(
        toolCall.id,
        `Cannot insert between: 'customType' is required and must be a valid insurance kind when kind === 'custom'`,
      );
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

  // Sequential apply. If a step after the first fails, partial state is
  // left behind — acceptable at Tier 1; the LLM can recover via the
  // cap'd agent loop.
  const removeRes = store.getState().removeEdge(existingEdge.id);
  if (!removeRes.ok) {
    return err(toolCall.id, `Cannot insert between: failed to remove existing edge`);
  }
  const addRes = store.getState().addNode(addInput);
  if (!addRes.ok) {
    return err(toolCall.id, `Cannot insert between: failed to add node — ${addRes.error.message}`);
  }
  const conn1 = store.getState().connectNodes({ source, target: addRes.value.id });
  if (!conn1.ok) {
    return err(toolCall.id, `Cannot insert between: failed to connect source → new`);
  }
  const conn2 = store.getState().connectNodes({ source: addRes.value.id, target });
  if (!conn2.ok) {
    return err(toolCall.id, `Cannot insert between: failed to connect new → target`);
  }

  return ok(
    toolCall.id,
    `Inserted ${addRes.value.kind} node '${addRes.value.id}' between '${source}' and '${target}'.`,
  );
}
