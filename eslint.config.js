import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const FORBIDDEN_LIBS = [
  'bpmn-js',
  'bpmn-react',
  'react-flow',
  '@xyflow/react',
  'redux',
  '@reduxjs/toolkit',
  'mobx',
  'jotai',
  'recoil',
  'valtio',
];

const forbiddenImports = [
  'error',
  {
    paths: FORBIDDEN_LIBS.map((name) => ({
      name,
      message: `${name} is forbidden by CLAUDE.md §3 — see docs/decisions.md for rationale.`,
    })),
    patterns: FORBIDDEN_LIBS.map((name) => `${name}/*`),
  },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', '.husky'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': forbiddenImports,

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // Config files: relax rules that don't make sense outside src/
  {
    files: ['vite.config.ts', 'vitest.config.ts', '*.config.{js,ts,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },

  prettier,
);
