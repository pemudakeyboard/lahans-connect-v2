// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * LAHANS Connect API lint config (ESLint 9 flat config).
 *
 * BRD §13 "Aturan Tegas" are enforced here as much as eslint can express:
 *  - no untyped `any` (no-explicit-any)
 *  - no console.log in production code (audit via AuditInterceptor instead)
 *  - no hardcoded policy numbers (BRD §13 #1) — no-magic-policy-numbers
 *  - no group-name checks (BRD §13 #2) — no-group-name-checks
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/generated/**', 'eslint-rules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    plugins: {
      lahans: {
        rules: {
          'no-magic-policy-numbers': (await import('./eslint-rules/no-magic-policy-numbers.js'))
            .default,
          'no-group-name-checks': (await import('./eslint-rules/no-group-name-checks.js')).default,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'lahans/no-magic-policy-numbers': 'error',
      'lahans/no-group-name-checks': 'error',
    },
  },
);
