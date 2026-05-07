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

// Schemas in Anthropic's input_schema format. Sent to Claude alongside
// each chat turn; Claude validates LLM output against them at the API
// layer (best-effort) and our executor re-validates before applying.

export interface AnthropicToolSchema {
  name: ToolName;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: readonly string[];
  };
}

const CUSTOM_TYPES = [
  'createAccount',
  'createPolicy',
  'createDocument',
  'sendEmail',
  'verifyPolicy',
  'assessDamage',
  'calculatePayout',
  'approveClaim',
  'denyClaim',
] as const;

const POSITION_SCHEMA = {
  type: 'object',
  description: 'World coordinates of the node card top-left corner.',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
  },
  required: ['x', 'y'],
} as const;

const DATA_SCHEMA = {
  type: 'object',
  description: 'Optional human-readable label and typed variables.',
  properties: {
    label: { type: 'string', description: 'Display label shown on the node card.' },
    variables: {
      type: 'object',
      description:
        'Typed key-value pairs attached to the node (e.g. claimType, isUrgent). Values must be string, number, or boolean.',
      additionalProperties: { type: ['string', 'number', 'boolean'] },
    },
  },
} as const;

export const TOOL_SCHEMAS: readonly AnthropicToolSchema[] = [
  {
    name: 'add_node',
    description:
      'Add a new node to the workflow. Choose kind="start" or "end" for terminal markers, "task" for a generic step, or "custom" with a customType drawn from the insurance-domain registry.',
    input_schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['start', 'end', 'task', 'custom'],
          description: 'Node kind. Use "custom" for the insurance-specific variants.',
        },
        customType: {
          type: 'string',
          enum: [...CUSTOM_TYPES],
          description:
            'Required when kind === "custom". Picks one of the 9 insurance node variants.',
        },
        position: POSITION_SCHEMA,
        data: DATA_SCHEMA,
      },
      required: ['kind', 'position'],
    },
  },
  {
    name: 'connect_nodes',
    description:
      'Connect two existing nodes with a directed edge from source to target. Validation rules: no self-loops, no duplicate edges, no edges into start nodes, no edges out of end nodes.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'ID of the source node.' },
        target: { type: 'string', description: 'ID of the target node.' },
      },
      required: ['source', 'target'],
    },
  },
  {
    name: 'update_node',
    description:
      "Update an existing node's label, variables, or position. Only the supplied fields change; omitted fields are preserved.",
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the node to update.' },
        data: DATA_SCHEMA,
        position: POSITION_SCHEMA,
      },
      required: ['id'],
    },
  },
  {
    name: 'remove_node',
    description:
      'Remove a node and any edges referencing it (incoming and outgoing). Idempotent against missing IDs (returns is_error).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the node to remove.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'insert_between',
    description:
      'Insert a new node between two already-connected nodes. Removes the existing source→target edge, adds the new node, and creates source→new and new→target edges. Use this instead of remove_edge + add_node + 2× connect_nodes.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'ID of the existing source node.' },
        target: { type: 'string', description: 'ID of the existing target node.' },
        kind: {
          type: 'string',
          enum: ['task', 'custom'],
          description: 'Kind of the new node. Cannot be "start" or "end".',
        },
        customType: {
          type: 'string',
          enum: [...CUSTOM_TYPES],
          description: 'Required when kind === "custom".',
        },
        data: DATA_SCHEMA,
      },
      required: ['source', 'target', 'kind'],
    },
  },
];
