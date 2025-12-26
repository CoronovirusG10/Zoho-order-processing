/**
 * Global test setup file
 * Runs before all tests
 */

import { beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
process.env.COSMOS_DB_ENDPOINT = 'https://localhost:8081';
process.env.COSMOS_DB_KEY = 'test-key';
process.env.ZOHO_CLIENT_ID = 'test-client-id';
process.env.ZOHO_CLIENT_SECRET = 'test-client-secret';
process.env.ZOHO_REFRESH_TOKEN = 'test-refresh-token';
process.env.ZOHO_ORGANIZATION_ID = 'test-org-id';

// Global setup
beforeAll(() => {
  console.log('Running test suite...');
});

// Global teardown
afterAll(() => {
  console.log('Test suite completed.');
});

// Reset after each test
afterEach(() => {
  // Clear any test-specific mocks or state
});

// Extend expect with custom matchers if needed
declare global {
  namespace Vi {
    interface Matchers<R = unknown> {
      toBeValidGtin(): R;
      toHaveEvidence(): R;
    }
  }
}
