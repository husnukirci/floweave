// POST /api/chat — proxies a single chat turn to the Anthropic Messages
// API. Validates the wire shape, calls the SDK, and reshapes the
// response into the narrow ProxyResponseBody the client consumes. Logs
// one structured request/response pair (plus errors) per call for ops
// observability.
//
// The handler does not implement the agent loop — that runs on the
// client (src/llm/agentLoop.ts). The proxy exists solely to keep
// ANTHROPIC_API_KEY out of the browser bundle (CLAUDE.md §3 / §4).

import type { Context } from 'hono';

import type { Logger } from '../logger.ts';
import type { AnthropicClient, ProxyMessage, ProxyResponseBody } from '../types.ts';

export interface ChatHandlerDeps {
  client: AnthropicClient;
  logger: Logger;
  /** Default model when the request doesn't specify one. */
  defaultModel?: string;
  /** Default max_tokens when the request doesn't specify one. */
  defaultMaxTokens?: number;
  /** Override for request id generation in tests. */
  generateRequestId?: () => string;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;

type ValidationResult =
  | {
      ok: true;
      value: {
        messages: ProxyMessage[];
        system?: string;
        tools?: unknown[];
        model: string;
        maxTokens: number;
      };
    }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validate(
  body: unknown,
  deps: { defaultModel: string; defaultMaxTokens: number },
): ValidationResult {
  if (!isObject(body)) return { ok: false, error: 'request body must be a JSON object' };

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "'messages' must be a non-empty array" };
  }
  for (const m of messages) {
    if (!isObject(m)) return { ok: false, error: "each 'messages' entry must be an object" };
    if (m.role !== 'user' && m.role !== 'assistant') {
      return { ok: false, error: "each message 'role' must be 'user' or 'assistant'" };
    }
    if (typeof m.content !== 'string' && !Array.isArray(m.content)) {
      return { ok: false, error: "each message 'content' must be a string or array" };
    }
  }
  if (body.system !== undefined && typeof body.system !== 'string') {
    return { ok: false, error: "'system' must be a string when supplied" };
  }
  if (body.tools !== undefined && !Array.isArray(body.tools)) {
    return { ok: false, error: "'tools' must be an array when supplied" };
  }
  const model =
    typeof body.model === 'string' && body.model.length > 0 ? body.model : deps.defaultModel;
  const maxTokens =
    typeof body.maxTokens === 'number' && body.maxTokens > 0
      ? body.maxTokens
      : deps.defaultMaxTokens;

  return {
    ok: true,
    value: {
      messages: messages as ProxyMessage[],
      system: typeof body.system === 'string' ? body.system : undefined,
      tools: Array.isArray(body.tools) ? body.tools : undefined,
      model,
      maxTokens,
    },
  };
}

function defaultRequestId(): string {
  return globalThis.crypto.randomUUID();
}

export function chatHandler(deps: ChatHandlerDeps) {
  const defaultModel = deps.defaultModel ?? DEFAULT_MODEL;
  const defaultMaxTokens = deps.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;
  const generateRequestId = deps.generateRequestId ?? defaultRequestId;

  return async (c: Context): Promise<Response> => {
    const requestId = generateRequestId();
    const start = Date.now();

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      deps.logger.warn({ requestId, event: 'invalid_json' });
      return c.json({ error: 'invalid JSON body' }, 400);
    }

    const validation = validate(raw, { defaultModel, defaultMaxTokens });
    if (!validation.ok) {
      deps.logger.warn({ requestId, event: 'invalid_payload', reason: validation.error });
      return c.json({ error: validation.error }, 400);
    }
    const { messages, system, tools, model, maxTokens } = validation.value;

    deps.logger.info({
      requestId,
      event: 'chat_request',
      model,
      messageCount: messages.length,
      toolCount: tools?.length ?? 0,
      hasSystem: typeof system === 'string',
    });

    let anthropicResponse: Awaited<ReturnType<AnthropicClient['messages']['create']>>;
    try {
      anthropicResponse = await deps.client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        tools,
      });
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : String(caught);
      deps.logger.error({ requestId, event: 'anthropic_error', error: message });
      return c.json({ error: 'upstream Anthropic API error' }, 502);
    }

    const stopReason = (anthropicResponse.stop_reason ?? null) as ProxyResponseBody['stop_reason'];
    const toolUseCount = anthropicResponse.content.filter((b) => b.type === 'tool_use').length;
    const duration = Date.now() - start;

    deps.logger.info({
      requestId,
      event: 'chat_response',
      durationMs: duration,
      stop_reason: stopReason,
      input_tokens: anthropicResponse.usage?.input_tokens,
      output_tokens: anthropicResponse.usage?.output_tokens,
      toolUseCount,
    });

    const body: ProxyResponseBody = {
      content: anthropicResponse.content,
      stop_reason: stopReason,
      usage: anthropicResponse.usage,
    };
    return c.json(body);
  };
}
