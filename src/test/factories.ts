// Test factories — sole place test data is constructed (CLAUDE.md §9:
// "Use factories from src/test/factories.ts, never inline object literals
// for test data"). Override only what each test cares about; defaults
// keep the test focused on the behaviour under test.

import { render, type RenderResult } from '@testing-library/react';
import { nanoid } from 'nanoid';
import { createElement, type ReactElement } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { createChatStore, type ChatStore } from '@/state/chat/chatStore';
import { createStores, type CreatedStores } from '@/state/createStores';
import { StoresProvider } from '@/state/StoresProvider';
import { createUiStore, type UiStore } from '@/state/ui/uiStore';
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

// renderWithStores — wraps a tree in StoresProvider so component tests
// can render without manually constructing every store. Returns the
// stores alongside the RTL render result so the test can drive them
// imperatively (`stores.workflowStore.getState().addNode(...)`).
//
// Tests that need a store with explicit shape pass it in via overrides;
// otherwise a fresh persist-disabled store set is built.
export interface RenderWithStoresOptions {
  stores?: Partial<CreatedStores>;
}

export type RenderWithStoresResult = RenderResult & { stores: CreatedStores };

export function renderWithStores(
  ui: ReactElement,
  options: RenderWithStoresOptions = {},
): RenderWithStoresResult {
  const stores = resolveStores(options.stores);
  const result = render(createElement(StoresProvider, stores, ui));
  return Object.assign(result, { stores });
}

function resolveStores(partial?: Partial<CreatedStores>): CreatedStores {
  if (partial?.workflowStore && partial.uiStore && partial.chatStore) {
    return {
      workflowStore: partial.workflowStore,
      uiStore: partial.uiStore,
      chatStore: partial.chatStore,
    };
  }
  // Build any missing pieces from scratch. Chat depends on workflow +
  // ui; resolve those first so a custom workflow store flows through.
  const workflowStore = partial?.workflowStore ?? createTestWorkflowStore();
  const uiStore: UiStore = partial?.uiStore ?? createUiStore();
  const chatStore: ChatStore = partial?.chatStore ?? createChatStore({ workflowStore, uiStore });
  return { workflowStore, uiStore, chatStore };
}

// Re-export so component tests can build a real (middleware-wrapped)
// store via createStores when they need persist or temporal behaviour.
export { createStores };
