import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.config.{ts,js,mjs,cjs}',
        '**/*.d.ts',
        'src/main.tsx',
        'src/test/**',
        '.husky/**',
        '.claude/**',
      ],
      // Real per-directory thresholds from CLAUDE.md §9 land in Phase 1 once
      // src/state, src/llm, src/utils have actual tests. Today: stubs that
      // always pass so test:cov runs cleanly during scaffolding.
      thresholds: {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      },
    },
  },
});
