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
      // Per-directory thresholds per CLAUDE.md §9. src/llm and src/utils
      // stay loose until they have code (Phases 2 + 6).
      thresholds: {
        'src/state/workflow/**': {
          lines: 90,
          branches: 85,
          functions: 90,
          statements: 90,
        },
      },
    },
  },
});
