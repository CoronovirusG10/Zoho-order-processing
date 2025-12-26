/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],

    // Security - prevent accidental credential logging
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.object.name="console"][callee.property.name=/^(log|info|debug)$/]',
        message:
          'Avoid console.log/info/debug in production code. Use structured logging with correlation IDs.',
      },
    ],
  },
  overrides: [
    // Allow console in scripts and test files
    {
      files: ['scripts/**/*.ts', '**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
      rules: {
        'no-console': 'off',
        'no-restricted-syntax': 'off',
      },
    },
    // React-specific overrides
    {
      files: ['services/teams-tab/**/*.tsx', 'services/teams-tab/**/*.ts'],
      env: {
        browser: true,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '*.js',
    '!.eslintrc.cjs',
    'coverage/',
    '*.tsbuildinfo',
  ],
};
