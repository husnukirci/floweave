// Per-instance store factory bundle. Constructs the three Zustand
// stores wired together (chat depends on workflow + ui) so a single
// call yields the exact set <StoresProvider> needs.
//
// Used by the dev SPA in src/main.tsx and by the
// <workflow-editor> Custom Element's connectedCallback (Phase 8
// commit 2). Tests use this helper too via renderWithStores().

import { createChatStore, type ChatStore } from '@/state/chat/chatStore';
import { createUiStore, type UiStore } from '@/state/ui/uiStore';
import { createWorkflowStore, type WorkflowStore } from '@/state/workflow/factory';

export interface CreateStoresOptions {
  /** devtools + persist key. Defaults to 'floweave-workflow'. */
  workflowName?: string;
  /** Toggle workflow persist middleware. Defaults to true. */
  persistEnabled?: boolean;
  /** LLM proxy endpoint forwarded to the chat store. */
  endpoint?: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface CreatedStores {
  workflowStore: WorkflowStore;
  uiStore: UiStore;
  chatStore: ChatStore;
}

export function createStores(options: CreateStoresOptions = {}): CreatedStores {
  const workflowStore = createWorkflowStore({
    name: options.workflowName,
    persistEnabled: options.persistEnabled,
  });
  const uiStore = createUiStore();
  const chatStore = createChatStore({
    workflowStore,
    uiStore,
    ...(options.endpoint !== undefined && { endpoint: options.endpoint }),
    ...(options.fetchImpl !== undefined && { fetchImpl: options.fetchImpl }),
  });
  return { workflowStore, uiStore, chatStore };
}
