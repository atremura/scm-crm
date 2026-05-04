// Flat config for Next 16. eslint-config-next 16 exports a native flat
// config (array). FlatCompat with `next/core-web-vitals` causes a
// circular-reference crash on this version, so we import the package
// directly. eslint-config-prettier disables stylistic rules that conflict
// with Prettier — must come after Next's config.
//
// typescript-eslint comes in transitively via eslint-config-next, but we
// pull it explicitly so we can register the plugin in our overrides
// block (the plugin isn't auto-registered by next/core-web-vitals).

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');
const prettier = require('eslint-config-prettier');
const tseslint = require('typescript-eslint');

const eslintConfig = [
  ...nextCoreWebVitals,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Next 16 / react-hooks 7 ship strict defaults that flag patterns
      // the codebase already uses widely (setState-in-effect, manual
      // memoization). Downgrade to warn — refactor incrementally instead
      // of blocking commits.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
  {
    ignores: [
      'src/generated/**',
      '.next/**',
      'node_modules/**',
      'public/**',
      '.husky/**',
      'prisma/migrations/**',
    ],
  },
];

export default eslintConfig;
