// LLM tool schemas — the five atomic tools per ADR-009. Each maps 1:1
// to a workflow store action so the LLM can express any change to a
// workflow. The schemas (real impl in commit 2) follow Anthropic's
// tool_use input_schema format; the input types here are what we expect
// the LLM to send for each tool.
//
// Re-validated by the executor (commit 3) before applying — the LLM
// occasionally produces malformed input and we surface those failures
// as structured tool_results so it can recover.

export type ToolName =
  | 'add_node'
  | 'connect_nodes'
  | 'update_node'
  | 'remove_node'
  | 'insert_between';

// Anthropic's tool_use block shape (subset we consume).
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

// Anthropic's tool_result block shape (subset we produce).
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// ============================================================
// Per-tool input shapes (what we expect the LLM to send)
// ============================================================

export type ToolNodeKind = 'start' | 'end' | 'task' | 'custom';

export interface AddNodeToolInput {
  kind: ToolNodeKind;
  /** Required when kind === 'custom' */
  customType?: string;
  position: { x: number; y: number };
  data?: {
    label?: string;
    variables?: Record<string, string | number | boolean>;
  };
}

export interface ConnectNodesToolInput {
  source: string;
  target: string;
}

export interface UpdateNodeToolInput {
  id: string;
  data?: {
    label?: string;
    variables?: Record<string, string | number | boolean>;
  };
  position?: { x: number; y: number };
}

export interface RemoveNodeToolInput {
  id: string;
}

export interface InsertBetweenToolInput {
  /** ID of the source node — must currently be connected to target. */
  source: string;
  /** ID of the target node — must currently be connected from source. */
  target: string;
  /** Kind of the new node to insert. Cannot be 'start' or 'end'. */
  kind: 'task' | 'custom';
  customType?: string;
  data?: {
    label?: string;
    variables?: Record<string, string | number | boolean>;
  };
}

// Schemas in Anthropic's input_schema format (filled in commit 2).
export interface AnthropicToolSchema {
  name: ToolName;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: readonly string[];
  };
}

export const TOOL_SCHEMAS: readonly AnthropicToolSchema[] = [];
