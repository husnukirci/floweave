import { beforeEach, describe, expect, it } from 'vitest';

import { createChatStore, type ChatMessage, type ChatStore } from './chatStore';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: overrides.id ?? 'm1',
  role: overrides.role ?? 'user',
  content: overrides.content ?? 'Hello',
  timestamp: overrides.timestamp ?? 0,
  ...(overrides.toolCalls !== undefined && { toolCalls: overrides.toolCalls }),
});

describe('chatStore', () => {
  let store: ChatStore;

  beforeEach(() => {
    store = createChatStore();
  });

  it('starts idle with no messages, no error, no in-flight controller', () => {
    const state = store.getState();
    expect(state.messages).toEqual([]);
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
    expect(state.abortController).toBeNull();
  });

  describe('addMessage', () => {
    it('appends to the messages array', () => {
      store.getState().addMessage(message({ id: 'm1' }));
      store.getState().addMessage(message({ id: 'm2', role: 'assistant' }));
      expect(store.getState().messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    });
  });

  describe('sendMessage (Phase 1 stub)', () => {
    it('returns Result.err NOT_IMPLEMENTED', async () => {
      const result = await store.getState().sendMessage('hi');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_IMPLEMENTED');
    });
  });

  describe('cancelInFlight', () => {
    it('aborts the controller and resets status to idle', () => {
      const controller = new AbortController();
      store.setState({ status: 'pending', abortController: controller });

      store.getState().cancelInFlight();

      expect(controller.signal.aborted).toBe(true);
      expect(store.getState().status).toBe('idle');
      expect(store.getState().abortController).toBeNull();
    });

    it('is a no-op when nothing is in flight', () => {
      store.getState().cancelInFlight();
      expect(store.getState().status).toBe('idle');
    });
  });

  describe('clearMessages', () => {
    it('resets messages, status, error, and controller', () => {
      store.getState().addMessage(message({ id: 'm1' }));
      store.setState({ status: 'error', error: { code: 'X', message: 'x' } });

      store.getState().clearMessages();

      expect(store.getState().messages).toEqual([]);
      expect(store.getState().status).toBe('idle');
      expect(store.getState().error).toBeNull();
    });
  });

  describe('setError', () => {
    it('sets the error and flips status to error', () => {
      store.getState().setError({ code: 'NETWORK', message: 'down' });
      expect(store.getState().error?.code).toBe('NETWORK');
      expect(store.getState().status).toBe('error');
    });

    it('clears the error and returns status to idle when passed null', () => {
      store.getState().setError({ code: 'X', message: 'x' });
      store.getState().setError(null);
      expect(store.getState().error).toBeNull();
      expect(store.getState().status).toBe('idle');
    });
  });
});
