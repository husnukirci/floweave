// Vitest setup file — registered via vitest.config.ts setupFiles. Loaded
// once before any test runs. Adds @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveAttribute, etc.) and the auto-cleanup for
// React Testing Library renders between tests, plus the MSW server
// lifecycle so any test that fetches a network resource hits a
// strictly-handled mock (unhandled requests fail loudly).

import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
