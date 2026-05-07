// LLM proxy client — typed fetch wrapper with AbortController support.
// Owns the wire format the client and the Hono proxy share, and the
// HTTP-layer concerns (network errors, non-2xx, in-flight abort
// detection). The agent loop in agentLoop.ts orchestrates iterations
// and calls postChat() per turn — it never touches fetch directly.

import type { ToolResultBlock, ToolUseBlock } from './tools';

// Wire-format content blocks shared with the proxy. Mirrors the subset
// of Anthropic's Messages API the client and the proxy actually consume
// or produce.
export type ProxyContentBlock = { type: 'text'; text: string } | ToolUseBlock | ToolResultBlock;

export interface ProxyMessage {
  role: 'user' | 'assistant';
  content: string | ProxyContentBlock[];
}

export interface ProxyResponse {
  content: ProxyContentBlock[];
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

// What the agent loop POSTs to the proxy each iteration.
export interface ChatRequestBody {
  messages: ProxyMessage[];
  system: string;
  tools: readonly unknown[];
}

export interface PostChatParams {
  endpoint: string;
  body: ChatRequestBody;
  signal?: AbortSignal;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export type PostChatResult =
  | { ok: true; response: ProxyResponse }
  | { ok: false; error: string; aborted: boolean };

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (error.message.toLowerCase().includes('abort')) return true;
  }
  return false;
}

export async function postChat(params: PostChatParams): Promise<PostChatResult> {
  const { endpoint, body, signal, fetchImpl = fetch } = params;

  try {
    const httpResp = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!httpResp.ok) {
      return {
        ok: false,
        error: `Proxy responded with status ${String(httpResp.status)}`,
        aborted: false,
      };
    }
    // Trust the proxy contract — the server validates and shapes the
    // payload before forwarding it. Mis-shaped responses surface as
    // runtime errors caught below.
    const response = (await httpResp.json()) as ProxyResponse;
    return { ok: true, response };
  } catch (caught: unknown) {
    if (isAbortError(caught)) {
      return { ok: false, error: 'Aborted', aborted: true };
    }
    const message = caught instanceof Error ? caught.message : String(caught);
    return { ok: false, error: `Network error: ${message}`, aborted: false };
  }
}
