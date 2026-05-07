// Chat store — async LLM interaction state. No middleware (CLAUDE.md §4):
// chat history is not undone/redone, not persisted (cleared on workflow
// reset), not surfaced in devtools.
//
// sendMessage is stubbed in Phase 1 (returns NOT_IMPLEMENTED). The real
// implementation lands in Phase 7 alongside the chat panel UI: it will
// dispatch the user message to the LLM proxy via the agent loop in
// src/llm/agentLoop.ts and apply the resulting tool_use blocks via the
// workflow store's applyMutations.

import { create, type StoreApi, type UseBoundStore } from 'zustand';

import type { WorkflowStoreState } from '@/state/workflow/storeState';
import type { Result, StoreError } from '@/state/workflow/types';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ToolCallSummary {
  name: string;
  result: 'ok' | 'err';
  message: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  toolCalls?: readonly ToolCallSummary[];
}

export type ChatStatus = 'idle' | 'pending' | 'error';

export interface ChatState {
  messages: readonly ChatMessage[];
  status: ChatStatus;
  error: StoreError | null;
  abortController: AbortController | null;

  addMessage: (message: ChatMessage) => void;
  sendMessage: (content: string) => Promise<Result<{ messageCount: number }>>;
  cancelInFlight: () => void;
  clearMessages: () => void;
  setError: (error: StoreError | null) => void;
}

const initialState: Pick<ChatState, 'messages' | 'status' | 'error' | 'abortController'> = {
  messages: [],
  status: 'idle',
  error: null,
  abortController: null,
};

export type ChatStore = UseBoundStore<StoreApi<ChatState>>;

export interface CreateChatStoreOptions {
  /**
   * Endpoint the chat sendMessage POSTs to. Defaults to
   * import.meta.env.VITE_API_ENDPOINT, falling back to '/api/chat'.
   * Tests pass a fixture URL alongside an MSW handler.
   */
  endpoint?: string;
  /**
   * Workflow store the agent loop applies mutations to. Defaults to the
   * module-level singleton in src/state/workflow/instance.ts. Tests pass
   * a fresh store per case so cases are independent.
   */
  workflowStore?: StoreApi<WorkflowStoreState>;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

// Options consumed in commit 2's sendMessage implementation. Accepting
// them in commit 1 (with the body still stubbed) lets the new test
// suite compile and exercise the intended public shape.
export function createChatStore(_options: CreateChatStoreOptions = {}): ChatStore {
  return create<ChatState>()((set, get) => ({
    ...initialState,

    addMessage: (message) => {
      set((state) => ({ messages: [...state.messages, message] }));
    },

    sendMessage: (content) => {
      // Stub for Phase 1. The Phase 7 implementation will:
      //   1. push the user message onto state.messages
      //   2. set status='pending', create an AbortController
      //   3. call src/llm/agentLoop with current workflow state
      //   4. apply returned mutations via workflowStore.applyMutations
      //   5. push the assistant message with tool-call summaries
      //   6. set status='idle' and clear the controller
      void content;
      return Promise.resolve({
        ok: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'sendMessage stub — real implementation lands in Phase 7',
        },
      });
    },

    cancelInFlight: () => {
      const controller = get().abortController;
      if (controller) {
        controller.abort();
      }
      set({ status: 'idle', abortController: null });
    },

    clearMessages: () => {
      set({ messages: [], status: 'idle', error: null, abortController: null });
    },

    setError: (error) => {
      set({ error, status: error ? 'error' : 'idle' });
    },
  }));
}

export const useChatStore = createChatStore();
