/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'store',
        'canvas',
        'panels',
        'llm',
        'wc',
        'infra',
        'deps',
        'a11y',
        'nodes',
        'utils',
        'state',
        'server',
        'demo',
        'tooling',
        'claude',
        'ci',
      ],
    ],
    'header-max-length': [2, 'always', 72],
  },
};
