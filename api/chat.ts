// Vercel serverless entry for the LLM proxy (ADR-024). Mirrors the
// composition in server/proxy.ts — client + logger into the createApp()
// factory — minus the port listener and static serving: Vercel's CDN
// serves demo.html and the WC bundle, and this function only owns
// /api/chat. The Hono app's own POST /api/chat route matches the
// incoming path, so no route rewiring is needed.
//
// Named HTTP-method export (Vercel's web handler signature) rather than
// a default export, per the repo's no-default-exports rule.

import Anthropic from '@anthropic-ai/sdk';
import { handle } from 'hono/vercel';

import { createApp } from '../server/app.ts';
import { createLogger } from '../server/logger.ts';
import type { AnthropicClient } from '../server/types.ts';

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

const logger = createLogger();
const apiKey = readEnv('ANTHROPIC_API_KEY');
if (apiKey === undefined) {
  // Unlike proxy.ts, don't exit: crashing at cold start yields an opaque
  // platform 500. With an empty key the SDK still constructs, Anthropic
  // rejects with 401, and the handler surfaces a structured error the
  // client can display.
  logger.error({
    event: 'startup_failed',
    reason: 'ANTHROPIC_API_KEY missing',
    hint: 'Set ANTHROPIC_API_KEY in the Vercel project environment variables.',
  });
}

// The real Anthropic instance satisfies the AnthropicClient interface
// structurally; the cast narrows the SDK's broader return type to the
// subset the handler consumes (same pattern as server/proxy.ts).
const client = new Anthropic({ apiKey: apiKey ?? '' }) as unknown as AnthropicClient;

const app = createApp({
  client,
  logger,
  defaultModel: readEnv('ANTHROPIC_MODEL'),
});

export const POST = handle(app);
