// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * LAHANS Connect API lint config (ESLint 9 flat config).
 *
 * BRD §13 "Aturan Tegas" are enforced here as much as eslint can express:
 *  - no untyped `any` (no-explicit-any) — rule 1 (ZERO HARDCODE) is enforced
 *    by the permission/temporal gates, not eslint
 *  - no console.log in production code (audit via AuditInterceptor instead)
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/generated/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);