// Wire shapes for the proxy. Mirrors the subset of Anthropic's Messages
// API the client and the proxy actually exchange. Kept narrow and
// explicit so the contract drift between client and server is detectable
// at compile time and at the validation step in the handler.

export interface ChatRequestBody {
  messages: ProxyMessage[];
  system?: string;
  tools?: unknown[];
  /** Optional model override; defaults to ANTHROPIC_MODEL or sonnet. */
  model?: string;
  /** Optional max_tokens override; defaults to 4096. */
  maxTokens?: number;
}

export type ProxyContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ProxyMessage {
  role: 'user' | 'assistant';
  content: string | ProxyContentBlock[];
}

export interface ProxyResponseBody {
  content: ProxyContentBlock[];
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null;
  usage?: { input_tokens: number; output_tokens: number };
}

// Minimal interface for the Anthropic SDK client — what the chat handler
// actually invokes. The real Anthropic class instance satisfies this
// structurally; tests pass a handcrafted mock.
export interface AnthropicClient {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: ProxyMessage[];
      tools?: unknown[];
    }) => Promise<{
      content: ProxyContentBlock[];
      stop_reason?: string | null;
      usage?: { input_tokens: number; output_tokens: number };
    }>;
  };
}
