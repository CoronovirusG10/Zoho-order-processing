import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Include patterns
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', 'src/_archive/**'],

    // Global test timeout (E2E tests with Temporal can take longer)
    testTimeout: 60000,

    // Hook timeout for beforeAll/afterAll (starting Temporal test environment)
    hookTimeout: 120000,

    // Pool configuration for better isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid Temporal port conflicts
      },
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
      ],
    },

    // Reporter configuration
    reporters: ['verbose'],

    // Setup files
    setupFiles: [],

    // Globals
    globals: true,
  },

  // Resolve configuration for module imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
