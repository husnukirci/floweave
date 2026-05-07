// Hono application factory. Tests build an app with a mocked Anthropic
// client; production builds with the real SDK in proxy.ts. The factory
// pattern keeps the handler graph the single source of truth for
// routing and lets tests assert on app.fetch(req) without any network.

import { Hono } from 'hono';

import { chatHandler, type ChatHandlerDeps } from './handlers/chat.ts';

export interface AppDeps extends ChatHandlerDeps {
  /** Path the chat handler is mounted at. Defaults to /api/chat. */
  chatPath?: string;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ ok: true }));
  app.post(deps.chatPath ?? '/api/chat', chatHandler(deps));

  return app;
}
