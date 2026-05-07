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
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'server/**/*.{test,spec}.ts'],
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
      // Per-directory thresholds per CLAUDE.md §9. src/llm stays loose
      // until Phase 6 lands code there.
      thresholds: {
        'src/state/workflow/**': {
          lines: 90,
          branches: 85,
          functions: 90,
          statements: 90,
        },
        'src/utils/**': {
          lines: 95,
          branches: 90,
          functions: 95,
          statements: 95,
        },
      },
    },
  },
});
