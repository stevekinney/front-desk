import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      'data/**',
      'vendor/**',
      'packages/contract/src/generated/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['legacy/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
);
