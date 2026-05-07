// Workflow domain types — single source of truth for state shape, action
// inputs, and the Result envelope used by every non-trivial store action
// (CLAUDE.md §3). No runtime here; logic lives in slices and validators.

export type NodeKind = 'start' | 'end' | 'task' | 'custom';

export type CustomNodeType =
  | 'createAccount'
  | 'createPolicy'
  | 'createDocument'
  | 'sendEmail'
  | 'verifyPolicy'
  | 'assessDamage'
  | 'calculatePayout'
  | 'approveClaim'
  | 'denyClaim';

export type Variable = string | number | boolean;

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeData {
  label: string;
  variables: Record<string, Variable>;
}

// Discriminated union (CLAUDE.md §7). Serializes to PLAN.md §4's JSON shape:
// `{ id, kind, position, data }` for basic kinds and the same plus
// `customType` for custom kind.
export interface BasicNode {
  id: string;
  kind: 'start' | 'end' | 'task';
  position: NodePosition;
  data: NodeData;
}

export interface CustomNode {
  id: string;
  kind: 'custom';
  customType: CustomNodeType;
  position: NodePosition;
  data: NodeData;
}

export type WorkflowNode = BasicNode | CustomNode;

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowState {
  nodes: Record<string, WorkflowNode>;
  edges: Record<string, WorkflowEdge>;
}

// Action input shapes — what callers pass; the slice generates IDs and
// fills defaults so callers do not.

export interface AddBasicNodeInput {
  kind: 'start' | 'end' | 'task';
  position: NodePosition;
  data?: Partial<NodeData>;
}

export interface AddCustomNodeInput {
  kind: 'custom';
  customType: CustomNodeType;
  position: NodePosition;
  data?: Partial<NodeData>;
}

export type AddNodeInput = AddBasicNodeInput | AddCustomNodeInput;

export interface UpdateNodePatch {
  data?: Partial<NodeData>;
  position?: NodePosition;
}

export interface ConnectNodesInput {
  source: string;
  target: string;
}

// Mutation — the discriminated union of every action that modifies the
// workflow store. Used by ioSlice.applyMutations to batch LLM-driven
// changes into a single applied sequence (CLAUDE.md §4 invariant:
// "LLM-driven mutations use applyMutations() as a single batched call.
// Never call individual actions in a loop from the agent loop.").
//
// 1:1 mapping with the LLM tool schema in Phase 6 (ADR-009 atomic tools).

export type Mutation =
  | {
      kind: 'addNode';
      input: AddNodeInput;
      /**
       * Optional pre-generated id. The LLM agent loop pre-generates ids
       * upfront so the success tool_result can include the new node's id
       * even when applied through a batched applyMutations() call. When
       * absent, addNode generates a fresh nanoid as usual.
       */
      id?: string;
    }
  | { kind: 'updateNode'; id: string; patch: UpdateNodePatch }
  | { kind: 'moveNode'; id: string; position: NodePosition }
  | { kind: 'removeNode'; id: string }
  | { kind: 'connectNodes'; input: ConnectNodesInput }
  | { kind: 'removeEdge'; id: string };

// Result envelope — all non-trivial store actions return this shape so
// callers (UI and LLM tool executor alike) handle success and failure
// uniformly without try/catch (CLAUDE.md §3).

export interface StoreError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type Result<T, E = StoreError> = { ok: true; value: T } | { ok: false; error: E };
