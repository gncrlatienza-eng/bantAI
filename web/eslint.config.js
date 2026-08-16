// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'eslint.config.js'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  react.configs.flat.recommended,
  eslintPluginPrettierRecommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Vite's JSX runtime is automatic — React doesn't need to be in scope, and this project doesn't use PropTypes.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
  {
    // Same rationale as backend/eslint.config.mjs: type-checked linting on
    // mocked test code is noisy by design, not a real-bug signal. No test
    // files exist in web/ yet, but this keeps the two configs consistent
    // for whenever they land.
    files: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // Deliberately narrow, same "start lenient" reasoning as ai/'s and
    // backend/'s configs: web/ never had a linter run against it before this
    // pass. Real findings surfaced (unused imports/vars, two stray tsc-
    // compiled files accidentally committed) and were fixed. What's left is
    // concentrated entirely in the three huge, pre-existing admin/client
    // dashboard pages and traces to one root cause worth fixing properly
    // later rather than papering over per-line here:
    //   - no-unsafe-{assignment,member-access,call}: src/mocks/referenceData.ts
    //     has no TypeScript interfaces, so anything destructured from it is
    //     `any`. Typing that file properly would resolve nearly all of these
    //     at once.
    //   - no-misused-promises: several onClick handlers are async functions
    //     passed where a void-returning handler is expected — needs a real
    //     look at each call site (wrap in `() => void fn()`), not a blind
    //     mechanical edit across a 12,000-line file.
    //   - no-unescaped-entities: ~20 literal quote characters in JSX text
    //     across the same files — cosmetic, not a rendering bug in a
    //     compiled React app.
    files: [
      'src/pages/admin.tsx',
      'src/pages/client.tsx',
      'src/pages/public.tsx',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
);
