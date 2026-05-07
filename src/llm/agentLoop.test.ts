import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/server';
import { createTestWorkflowStore } from '@/test/factories';

import { runAgentLoop, type ProxyResponse } from './agentLoop';

const ENDPOINT = 'https://api.test.local/api/chat';

function jsonResponse(body: ProxyResponse) {
  return HttpResponse.json(body);
}

describe('runAgentLoop', () => {
  it('returns the assistant text when the first response has no tool_use blocks', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        jsonResponse({
          content: [{ type: 'text', text: 'Hi there.' }],
          stop_reason: 'end_turn',
        }),
      ),
    );
    const store = createTestWorkflowStore();

    const result = await runAgentLoop({
      userMessage: 'hello',
      store,
      endpoint: ENDPOINT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.finalText).toBe('Hi there.');
    expect(result.iterations).toBe(1);
    expect(result.toolCalls).toHaveLength(0);
    expect(result.stopReason).toBe('end_turn');
  });

  it('applies a single tool_use, sends results back, and returns the follow-up text', async () => {
    let call = 0;
    server.use(
      http.post(ENDPOINT, () => {
        call += 1;
        if (call === 1) {
          return jsonResponse({
            content: [
              {
                type: 'tool_use',
                id: 'tu_1',
                name: 'add_node',
                input: { kind: 'task', position: { x: 100, y: 50 } },
              },
            ],
            stop_reason: 'tool_use',
          });
        }
        return jsonResponse({
          content: [{ type: 'text', text: 'Added the node.' }],
          stop_reason: 'end_turn',
        });
      }),
    );
    const store = createTestWorkflowStore();

    const result = await runAgentLoop({
      userMessage: 'add a task',
      store,
      endpoint: ENDPOINT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.iterations).toBe(2);
    expect(result.finalText).toBe('Added the node.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('add_node');
    expect(result.toolCalls[0]?.isError).toBe(false);
    expect(Object.keys(store.getState().nodes)).toHaveLength(1);
  });

  it('applies multiple tool_use blocks emitted in a single turn', async () => {
    let call = 0;
    server.use(
      http.post(ENDPOINT, () => {
        call += 1;
        if (call === 1) {
          return jsonResponse({
            content: [
              {
                type: 'tool_use',
                id: 'tu_a',
                name: 'add_node',
                input: { kind: 'start', position: { x: 0, y: 0 } },
              },
              {
                type: 'tool_use',
                id: 'tu_b',
                name: 'add_node',
                input: { kind: 'end', position: { x: 400, y: 0 } },
              },
            ],
            stop_reason: 'tool_use',
          });
        }
        return jsonResponse({
          content: [{ type: 'text', text: 'Added two nodes.' }],
          stop_reason: 'end_turn',
        });
      }),
    );
    const store = createTestWorkflowStore();

    const result = await runAgentLoop({
      userMessage: 'add start and end',
      store,
      endpoint: ENDPOINT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls.every((c) => !c.isError)).toBe(true);
    expect(Object.keys(store.getState().nodes)).toHaveLength(2);
  });

  it('surfaces validation failures as is_error tool_results so the LLM can recover', async () => {
    let call = 0;
    server.use(
      http.post(ENDPOINT, () => {
        call += 1;
        if (call === 1) {
          // Malformed: missing position.
          return jsonResponse({
            content: [
              {
                type: 'tool_use',
                id: 'tu_bad',
                name: 'add_node',
                input: { kind: 'task' },
              },
            ],
            stop_reason: 'tool_use',
          });
        }
        if (call === 2) {
          // Recovery attempt with valid input.
          return jsonResponse({
            content: [
              {
                type: 'tool_use',
                id: 'tu_good',
                name: 'add_node',
                input: { kind: 'task', position: { x: 10, y: 10 } },
              },
            ],
            stop_reason: 'tool_use',
          });
        }
        return jsonResponse({
          content: [{ type: 'text', text: 'Done after retry.' }],
          stop_reason: 'end_turn',
        });
      }),
    );
    const store = createTestWorkflowStore();

    const result = await runAgentLoop({
      userMessage: 'add a task',
      store,
      endpoint: ENDPOINT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.iterations).toBe(3);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]?.isError).toBe(true);
    expect(result.toolCalls[1]?.isError).toBe(false);
    expect(Object.keys(store.getState().nodes)).toHaveLength(1);
  });

  it('terminates at maxIterations when the LLM keeps returning tool_use', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        jsonResponse({
          content: [
            {
              type: 'tool_use',
              id: 'tu_loop',
              name: 'add_node',
              input: { kind: 'task', position: { x: 0, y: 0 } },
            },
          ],
          stop_reason: 'tool_use',
        }),
      ),
    );
    const store = createTestWorkflowStore();

    const result = await runAgentLoop({
      userMessage: 'spin',
      store,
      endpoint: ENDPOINT,
      maxIterations: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.iterations).toBe(3);
    expect(result.stopReason).toBe('max_iterations');
    expect(result.toolCalls).toHaveLength(3);
  });

  it('aborts cleanly when the supplied AbortSignal fires', async () => {
    server.use(
      http.post(ENDPOINT, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return jsonResponse({
          content: [{ type: 'text', text: 'late' }],
          stop_reason: 'end_turn',
        });
      }),
    );
    const store = createTestWorkflowStore();
    const controller = new AbortController();

    const promise = runAgentLoop({
      userMessage: 'hello',
      store,
      endpoint: ENDPOINT,
      signal: controller.signal,
    });
    controller.abort();
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.toLowerCase()).toMatch(/abort|cancel/);
  });

  it('returns ok:false when the proxy responds with a non-2xx status', async () => {
    server.use(
      http.post(ENDPOINT, () => HttpResponse.json({ error: 'upstream failed' }, { status: 500 })),
    );
    const store = createTestWorkflowStore();

    const result = await runAgentLoop({
      userMessage: 'hi',
      store,
      endpoint: ENDPOINT,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.error).toMatch(/500|proxy|upstream/i);
  });

  it('sends the system prompt with serialized workflow state on every request', async () => {
    let capturedSystem: string | undefined;
    let capturedTools: unknown;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        const body = (await request.json()) as { system?: string; tools?: unknown };
        capturedSystem = body.system;
        capturedTools = body.tools;
        return jsonResponse({
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
        });
      }),
    );
    const store = createTestWorkflowStore();

    await runAgentLoop({
      userMessage: 'hi',
      store,
      endpoint: ENDPOINT,
    });

    expect(capturedSystem).toBeDefined();
    expect(capturedSystem).toContain('<workflow_state>');
    expect(capturedTools).toBeDefined();
    expect(Array.isArray(capturedTools)).toBe(true);
    expect((capturedTools as { name: string }[]).map((t) => t.name)).toEqual(
      expect.arrayContaining(['add_node', 'connect_nodes']),
    );
  });
});
