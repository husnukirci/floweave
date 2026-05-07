// Hono application factory. Tests build an app with a mocked Anthropic
// client; production builds with the real SDK in proxy.ts. The factory
// pattern keeps the handler graph the single source of truth for
// routing and lets tests assert on app.fetch(req) without any network.

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

import { chatHandler, type ChatHandlerDeps } from './handlers/chat.ts';

export interface AppDeps extends ChatHandlerDeps {
  /** Path the chat handler is mounted at. Defaults to /api/chat. */
  chatPath?: string;
  /**
   * When provided, mounts static file serving rooted at this directory
   * for paths the API routes don't claim. Used by the Docker image to
   * serve demo.html and the dist-wc/ bundle from the same origin as
   * /api/chat (sidesteps CORS). Leave undefined in dev so Vite handles
   * the SPA serving on its own port.
   */
  staticRoot?: string;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ ok: true }));
  app.post(deps.chatPath ?? '/api/chat', chatHandler(deps));

  if (deps.staticRoot !== undefined) {
    // GET / -> demo.html so a fresh visit to the root URL lands the
    // demo page without typing the file name.
    app.get('/', (c) => c.redirect('/demo.html'));
    app.use(
      '*',
      serveStatic({
        root: deps.staticRoot,
        // Don't fall through to the SPA's index.html for unknown paths;
        // unmatched requests should 404 rather than masquerade as the
        // demo page.
      }),
    );
  }

  return app;
}
