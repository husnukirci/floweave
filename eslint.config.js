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
  { ignores: ['dist', 'dist-wc', 'dist-vercel', '.vercel', 'node_modules', 'coverage', '.husky'] },

  // Base recommendations apply to everything.
  js.configs.recommended,

  // TS strict + stylistic type-checked rules — scoped to TS only.
  {
    files: ['**/*.{ts,tsx,cts,mts}'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // Plain JS config files: disable type-checked rules (no TS project to source from).
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Zustand slice files: dynamic-key delete on `Record<id, T>` is the
  // canonical inverse of dynamic-key assign per ADR-002 (Records over
  // arrays). The rule exists to flag accidental dynamic-key deletion on
  // typed objects; in slices it is intentional.
  {
    files: ['src/state/**/slices/*.ts'],
    rules: {
      '@typescript-eslint/no-dynamic-delete': 'off',
    },
  },

  // Server source: structured logs go to stdout (Twelve-Factor). The
  // logger emits via console.log inline with an eslint-disable comment;
  // no other console usage is permitted here either.
  {
    files: ['server/**/*.ts'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'log'] }],
    },
  },

  // Prettier last to disable conflicting stylistic rules.
  prettier,
);
