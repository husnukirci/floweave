import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestWorkflowStore, type TestWorkflowStore } from '@/test/factories';
import { server } from '@/test/server';

import { createChatStore, type ChatMessage, type ChatStore } from './chatStore';

const ENDPOINT = 'https://api.test.local/api/chat';

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

  describe('sendMessage', () => {
    let workflowStore: TestWorkflowStore;
    let chat: ChatStore;

    beforeEach(() => {
      workflowStore = createTestWorkflowStore();
      chat = createChatStore({ endpoint: ENDPOINT, workflowStore });
    });

    it('appends a user message and an assistant message on a no-tool turn', async () => {
      server.use(
        http.post(ENDPOINT, () =>
          HttpResponse.json({
            content: [{ type: 'text', text: 'Hello back.' }],
            stop_reason: 'end_turn',
          }),
        ),
      );

      const result = await chat.getState().sendMessage('Hi');

      expect(result.ok).toBe(true);
      const messages = chat.getState().messages;
      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('Hi');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[1]?.content).toBe('Hello back.');
      expect(chat.getState().status).toBe('idle');
      expect(chat.getState().abortController).toBeNull();
    });

    it('applies tool_use blocks to the workflow store and surfaces them as toolCalls summaries', async () => {
      let call = 0;
      server.use(
        http.post(ENDPOINT, () => {
          call += 1;
          if (call === 1) {
            return HttpResponse.json({
              content: [
                {
                  type: 'tool_use',
                  id: 'tu1',
                  name: 'add_node',
                  input: { kind: 'task', position: { x: 0, y: 0 } },
                },
                {
                  type: 'tool_use',
                  id: 'tu2',
                  name: 'add_node',
                  input: { kind: 'end', position: { x: 200, y: 0 } },
                },
              ],
              stop_reason: 'tool_use',
            });
          }
          return HttpResponse.json({
            content: [{ type: 'text', text: 'Added two nodes.' }],
            stop_reason: 'end_turn',
          });
        }),
      );

      await chat.getState().sendMessage('add two nodes');

      expect(Object.keys(workflowStore.getState().nodes)).toHaveLength(2);
      const messages = chat.getState().messages;
      const last = messages.at(-1);
      expect(last?.role).toBe('assistant');
      expect(last?.toolCalls).toHaveLength(2);
      expect(last?.toolCalls?.[0]).toMatchObject({ name: 'add_node', result: 'ok' });
      expect(last?.toolCalls?.[1]).toMatchObject({ name: 'add_node', result: 'ok' });
    });

    it('flips status to pending while the request is in flight and back to idle on completion', async () => {
      // Deferred created synchronously up front so the resolve handle
      // is always defined when the test calls it; capturing the
      // resolver inside the MSW handler races with the test's
      // microtask drain.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.post(ENDPOINT, async () => {
          await gate;
          return HttpResponse.json({
            content: [{ type: 'text', text: 'late' }],
            stop_reason: 'end_turn',
          });
        }),
      );

      const send = chat.getState().sendMessage('hi');
      await Promise.resolve();
      expect(chat.getState().status).toBe('pending');
      expect(chat.getState().abortController).not.toBeNull();

      release();
      await send;

      expect(chat.getState().status).toBe('idle');
      expect(chat.getState().abortController).toBeNull();
    });

    it('cancels the in-flight request and returns idle when cancelInFlight() runs mid-flight', async () => {
      server.use(
        http.post(ENDPOINT, async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({
            content: [{ type: 'text', text: 'late' }],
            stop_reason: 'end_turn',
          });
        }),
      );

      const send = chat.getState().sendMessage('hi');
      await Promise.resolve();
      chat.getState().cancelInFlight();
      const result = await send;

      expect(result.ok).toBe(false);
      expect(chat.getState().status).toBe('idle');
      expect(chat.getState().abortController).toBeNull();
    });

    it('pushes a system error message and flips status to error when the proxy returns 5xx', async () => {
      server.use(http.post(ENDPOINT, () => HttpResponse.json({ error: 'down' }, { status: 500 })));

      const result = await chat.getState().sendMessage('hi');

      expect(result.ok).toBe(false);
      const messages = chat.getState().messages;
      expect(messages.some((m) => m.role === 'system')).toBe(true);
      expect(chat.getState().status).toBe('error');
      expect(chat.getState().error).not.toBeNull();
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
