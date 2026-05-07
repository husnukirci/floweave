// Chat store — async LLM interaction state. No middleware (CLAUDE.md §4):
// chat history is not undone/redone, not persisted (cleared on workflow
// reset), not surfaced in devtools.
//
// sendMessage drives a single chat turn: pushes the user message,
// flips to pending, runs the agent loop, then pushes either an
// assistant message (with tool-call summaries) or — on a non-cancel
// failure — a system message with the error.

import { nanoid } from 'nanoid';
import { create, type StoreApi, type UseBoundStore } from 'zustand';

import { runAgentLoop } from '@/llm/agentLoop';
import type { UiState } from '@/state/ui/uiStore';
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
  /** Workflow store the agent loop applies mutations to. */
  workflowStore: StoreApi<WorkflowStoreState>;
  /**
   * UI store the chat surfaces side effects through — e.g.
   * markRecentlyAdded for the AI-added pulse highlight.
   */
  uiStore: StoreApi<UiState>;
  /**
   * Endpoint the chat sendMessage POSTs to. Defaults to
   * import.meta.env.VITE_API_ENDPOINT, falling back to '/api/chat'.
   * Tests pass a fixture URL alongside an MSW handler.
   */
  endpoint?: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_ENDPOINT = '/api/chat';

function defaultEndpoint(): string {
  const env = import.meta.env as Record<string, unknown>;
  const value = env.VITE_API_ENDPOINT;
  return typeof value === 'string' && value.length > 0 ? value : DEFAULT_ENDPOINT;
}

function isAbortError(message: string): boolean {
  return message.toLowerCase().includes('abort');
}

export function createChatStore(options: CreateChatStoreOptions): ChatStore {
  const { workflowStore, uiStore } = options;
  const endpoint = options.endpoint ?? defaultEndpoint();
  const fetchImpl = options.fetchImpl;

  return create<ChatState>()((set, get) => ({
    ...initialState,

    addMessage: (message) => {
      set((state) => ({ messages: [...state.messages, message] }));
    },

    sendMessage: async (content) => {
      const userMessage: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      const controller = new AbortController();
      // Snapshot existing node ids so we can diff after the agent loop
      // and mark the newly created ones for the AI-added pulse highlight
      // without parsing the agent loop's success messages.
      const nodeIdsBefore = new Set(Object.keys(workflowStore.getState().nodes));
      set((state) => ({
        messages: [...state.messages, userMessage],
        status: 'pending',
        error: null,
        abortController: controller,
      }));

      const result = await runAgentLoop({
        userMessage: content,
        store: workflowStore,
        endpoint,
        signal: controller.signal,
        ...(fetchImpl !== undefined && { fetchImpl }),
      });

      // If cancelInFlight ran mid-flight it cleared the controller.
      // Don't double-write state in that case — cancelInFlight already
      // set status to idle.
      if (get().abortController !== controller) {
        return {
          ok: false,
          error: { code: 'CANCELLED', message: 'Request cancelled by user' },
        };
      }

      if (result.ok) {
        const toolCalls: ToolCallSummary[] = result.toolCalls.map((tc) => ({
          name: tc.name,
          result: tc.isError ? 'err' : 'ok',
          message: tc.resultContent,
        }));
        const assistantMessage: ChatMessage = {
          id: nanoid(),
          role: 'assistant',
          content: result.finalText,
          timestamp: Date.now(),
          ...(toolCalls.length > 0 && { toolCalls }),
        };
        set((state) => ({
          messages: [...state.messages, assistantMessage],
          status: 'idle',
          abortController: null,
        }));
        // Diff node ids and surface newly created ones to the UI for
        // the pulse highlight. Runs *after* the assistant message lands
        // so ChatPanel + Canvas state move together.
        const nodesAfter = workflowStore.getState().nodes;
        const newNodeIds = Object.keys(nodesAfter).filter((id) => !nodeIdsBefore.has(id));
        if (newNodeIds.length > 0) {
          uiStore.getState().markRecentlyAdded(newNodeIds);
        }
        return { ok: true, value: { messageCount: get().messages.length } };
      }

      // Non-cancel failures (proxy 5xx, network errors, iteration cap)
      // surface as a system message + error state. Aborts are already
      // handled by cancelInFlight above; the `Aborted` string from the
      // agent loop only reaches here when the signal fired without
      // anyone calling cancelInFlight.
      const errorObj: StoreError = isAbortError(result.error)
        ? { code: 'CANCELLED', message: result.error }
        : { code: 'AGENT_LOOP_FAILED', message: result.error };
      const systemMessage: ChatMessage = {
        id: nanoid(),
        role: 'system',
        content: result.error,
        timestamp: Date.now(),
      };
      set((state) => ({
        messages: [...state.messages, systemMessage],
        status: 'error',
        error: errorObj,
        abortController: null,
      }));
      return { ok: false, error: errorObj };
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
