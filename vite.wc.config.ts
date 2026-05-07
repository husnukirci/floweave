// Vite library-mode config for the <workflow-editor> Web Component
// bundle. Outputs a single self-contained JS file at dist-wc/
// workflow-editor.js with React, Zustand, and the Tailwind stylesheet
// inlined — host pages drop in a <script type="module"> tag and use
// <workflow-editor> declaratively (ADR-020 single-bundle distribution).
//
// Invoked via `vite build --config vite.wc.config.ts` (npm script
// build:wc). The dev SPA (index.html / main.tsx) is unchanged and
// keeps the default vite.config.ts.

import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // Vite library mode preserves `process.env.NODE_ENV` references so
    // consumers can decide at their build time. The WC bundle is a
    // browser drop-in with no host build step, so we replace these at
    // build time with the production literal — otherwise React DOM's
    // dev/prod entry switch throws ReferenceError when the bundle
    // loads (no `process` global in the browser).
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-wc',
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/web-component/entry.ts', import.meta.url)),
      name: 'WorkflowEditor',
      formats: ['es'],
      fileName: () => 'workflow-editor.js',
    },
    rollupOptions: {
      output: {
        // Single artifact — no code splitting; consumers load one file.
        // (Vite warns this option is deprecated in favour of a top-level
        // `codeSplitting: false`, but that key isn't typed yet in
        // BuildEnvironmentOptions; revisit when the type ships.)
        inlineDynamicImports: true,
      },
    },
  },
});
