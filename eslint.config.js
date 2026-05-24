import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // Ignore build output and dependencies
  { ignores: ['dist/**', 'node_modules/**', 'actions-runner/**'] },

  // TypeScript recommended rules (flat config)
  // Sets up @typescript-eslint/parser, registers plugin, applies TS-specific rules
  ...tsPlugin.configs['flat/recommended'],

  // React Hooks rules (core Rules of React, not the experimental v7 compiler rules)
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // React Refresh — only-export-components + allow constant exports
  reactRefresh.configs.vite,

  // Enable JSX parsing for .tsx files
  {
    files: ['**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // Custom rule overrides for all TS/TSX files
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Allow unused vars when prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Warn on explicit `any` (except in tests, see below)
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Test files: relax some rules
  {
    files: [
      'src/test/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Script files: allow explicit any for DB row manipulation
  {
    files: ['scripts/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // GameContext exports both a component and a hook (by design)
  {
    files: ['src/context/GameContext.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  // Arena has legacy imperative flow with guard returns and non-hook "useFight" naming.
  {
    files: ['src/pages/Arena.tsx', 'src/context/useCombat.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
