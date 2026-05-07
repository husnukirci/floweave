import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.ts';
import { createSilentLogger } from '../logger.ts';
import type { AnthropicClient, ProxyResponseBody } from '../types.ts';

const ENDPOINT = 'http://test.local/api/chat';

function fakeClient(impl: AnthropicClient['messages']['create']): AnthropicClient {
  return { messages: { create: impl } };
}

function postJson(body: unknown): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat', () => {
  it('proxies a valid request and returns the Anthropic response', async () => {
    const create = vi.fn(async () =>
      Promise.resolve({
        content: [{ type: 'text' as const, text: 'hi back' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 4 },
      }),
    );
    const app = createApp({ client: fakeClient(create), logger: createSilentLogger() });

    const res = await app.fetch(
      postJson({
        messages: [{ role: 'user', content: 'hi' }],
        system: 'be helpful',
        tools: [{ name: 'add_node' }],
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as ProxyResponseBody;
    expect(body.content[0]).toMatchObject({ type: 'text', text: 'hi back' });
    expect(body.stop_reason).toBe('end_turn');
    expect(body.usage).toEqual({ input_tokens: 10, output_tokens: 4 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'be helpful',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ name: 'add_node' }],
    });
  });

  it('returns 400 when the body is not valid JSON', async () => {
    const app = createApp({
      client: fakeClient(vi.fn()),
      logger: createSilentLogger(),
    });

    const res = await app.fetch(
      new Request(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not valid',
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('json');
  });

  it('returns 400 when messages is missing or empty', async () => {
    const create = vi.fn();
    const app = createApp({ client: fakeClient(create), logger: createSilentLogger() });

    const res = await app.fetch(postJson({ system: 'oops' }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 400 when a message role is invalid', async () => {
    const create = vi.fn();
    const app = createApp({ client: fakeClient(create), logger: createSilentLogger() });

    const res = await app.fetch(postJson({ messages: [{ role: 'system', content: 'no' }] }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 502 when the Anthropic SDK throws', async () => {
    const create = vi.fn(() => Promise.reject(new Error('upstream timeout')));
    const app = createApp({ client: fakeClient(create), logger: createSilentLogger() });

    const res = await app.fetch(postJson({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('anthropic');
  });

  it('uses the requested model when supplied, otherwise falls back to default', async () => {
    const calls: string[] = [];
    const create = vi.fn((params: { model: string }) => {
      calls.push(params.model);
      return Promise.resolve({
        content: [{ type: 'text' as const, text: 'ok' }],
        stop_reason: 'end_turn',
      });
    });
    const app = createApp({
      client: fakeClient(create),
      logger: createSilentLogger(),
      defaultModel: 'claude-default-test',
    });

    await app.fetch(postJson({ messages: [{ role: 'user', content: 'hi' }] }));
    await app.fetch(
      postJson({ messages: [{ role: 'user', content: 'hi' }], model: 'claude-override' }),
    );

    expect(calls).toEqual(['claude-default-test', 'claude-override']);
  });

  it('emits structured logs for request and response', async () => {
    const create = vi.fn(async () =>
      Promise.resolve({
        content: [
          { type: 'text' as const, text: 'ok' },
          { type: 'tool_use' as const, id: 'tu_1', name: 'add_node', input: {} },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 1, output_tokens: 2 },
      }),
    );
    const info = vi.fn();
    const logger = { info, warn: vi.fn(), error: vi.fn() };
    const app = createApp({
      client: fakeClient(create),
      logger,
      generateRequestId: () => 'req-fixed',
    });

    await app.fetch(
      postJson({
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{ name: 'add_node' }],
      }),
    );

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat_request',
        requestId: 'req-fixed',
        messageCount: 1,
        toolCount: 1,
      }),
    );
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat_response',
        requestId: 'req-fixed',
        stop_reason: 'tool_use',
        toolUseCount: 1,
        input_tokens: 1,
        output_tokens: 2,
      }),
    );
  });

  it('exposes a healthz endpoint', async () => {
    const app = createApp({ client: fakeClient(vi.fn()), logger: createSilentLogger() });
    const res = await app.fetch(new Request('http://test.local/healthz'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
