// Shared MSW server instance. Tests import { server } and register
// per-suite handlers via server.use(...). Lifecycle (listen / reset /
// close) is wired in src/test/setup.ts so every test gets a clean
// handler set without the suites repeating boilerplate.

import { setupServer } from 'msw/node';

export const server = setupServer();
