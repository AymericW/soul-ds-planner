import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/** Layer rules (see docs/ARCHITECTURE.md). scripts/check-architecture.mjs enforces the same map + cycles. */
const forbid = (...layers) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: layers.map((layer) => ({
        group: [`@/${layer}`, `@/${layer}/*`],
        message: `This layer must not depend on "${layer}" (see docs/ARCHITECTURE.md).`,
      })),
    },
  ],
});

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-alert': 'error',
    },
  },
  { files: ['src/constants/**'], rules: forbid('models', 'domain', 'services', 'data', 'helpers', 'viewmodels', 'screens', 'components') },
  { files: ['src/models/**'], rules: forbid('domain', 'services', 'data', 'helpers', 'viewmodels', 'screens', 'components') },
  { files: ['src/helpers/**'], rules: forbid('domain', 'services', 'data', 'viewmodels', 'screens', 'components') },
  {
    files: ['src/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'react', message: 'Domain logic must stay framework-free.' }],
          patterns: ['services', 'data', 'viewmodels', 'screens', 'components'].map((layer) => ({
            group: [`@/${layer}`, `@/${layer}/*`],
            message: `Domain must not depend on "${layer}".`,
          })),
        },
      ],
    },
  },
  { files: ['src/services/**'], rules: forbid('data', 'viewmodels', 'screens', 'components') },
  { files: ['src/data/**'], rules: forbid('services', 'viewmodels', 'screens', 'components') },
  { files: ['src/viewmodels/**'], rules: forbid('screens', 'components') },
  { files: ['src/components/**'], rules: forbid('domain', 'services', 'data', 'viewmodels', 'screens') },
  { files: ['src/screens/**'], rules: forbid('domain', 'services', 'data') },
  {
    files: ['scripts/**/*.mjs', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
);
