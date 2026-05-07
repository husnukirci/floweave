// Proxy entry point. Reads ANTHROPIC_API_KEY from the environment, wires
// the real Anthropic SDK client into the Hono app, and serves on PORT
// (default 3001). Designed to run under `npm run dev:server` locally and
// from the Phase 9 Docker image in production.

import { serve } from '@hono/node-server';
import Anthropic from '@anthropic-ai/sdk';

import { createApp } from './app.ts';
import { createLogger } from './logger.ts';
import type { AnthropicClient } from './types.ts';

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function main(): void {
  const logger = createLogger();
  const apiKey = readEnv('ANTHROPIC_API_KEY');
  if (!apiKey) {
    logger.error({
      event: 'startup_failed',
      reason: 'ANTHROPIC_API_KEY missing',
      hint: 'Copy .env.example to .env and fill in the key from console.anthropic.com.',
    });
    process.exit(1);
  }
  const port = Number(readEnv('PORT') ?? '3001');
  const defaultModel = readEnv('ANTHROPIC_MODEL');
  const staticRoot = readEnv('STATIC_ROOT');

  // The real Anthropic instance satisfies the AnthropicClient interface
  // structurally; the cast narrows the SDK's broader return type to the
  // subset the handler consumes.
  const client = new Anthropic({ apiKey }) as unknown as AnthropicClient;

  const app = createApp({
    client,
    logger,
    defaultModel,
    ...(staticRoot !== undefined && { staticRoot }),
  });

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ event: 'server_started', port: info.port, pid: process.pid });
  });
}

main();
