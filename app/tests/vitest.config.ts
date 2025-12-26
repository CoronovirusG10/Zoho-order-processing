import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/fixtures/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        '**/mocks/**',
        '**/fixtures/**',
        '**/golden-files/fixtures/**',
        '**/golden-files/expected/**',
        '**/*.test.ts',
        '**/node_modules/**',
        '**/dist/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    // Setup files to run before tests
    setupFiles: ['./setup.ts'],
    // Disable isolated tests for faster execution
    isolate: true,
    // Run tests in parallel
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  },
  resolve: {
    alias: {
      '@order-processing/types': path.resolve(__dirname, '../packages/types/src'),
      '@order-processing/shared': path.resolve(__dirname, '../packages/shared/src'),
      '@order-processing/parser': path.resolve(__dirname, '../services/parser/src'),
      '@order-processing/committee': path.resolve(__dirname, '../services/committee/src'),
      '@order-processing/zoho': path.resolve(__dirname, '../services/zoho/src'),
      '@order-processing/api': path.resolve(__dirname, '../services/api/src'),
      '@tests/mocks': path.resolve(__dirname, './mocks'),
      '@tests/utils': path.resolve(__dirname, './utils')
    }
  }
});
