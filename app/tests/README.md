# Order Processing Test Suite

Comprehensive test infrastructure for the Teams → Excel → AI Committee → Zoho Draft Sales Orders application.

## Overview

This test suite provides multiple layers of testing to ensure the reliability and correctness of the order processing pipeline:

- **Unit Tests** - Test individual functions in isolation
- **Integration Tests** - Test service interactions with mocked dependencies
- **E2E Tests** - Full workflow tests with mock external services
- **Golden Files** - Representative Excel files with expected outputs

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run golden files
npm run test:golden

# Generate coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Directory Structure

```
tests/
  ├── vitest.config.ts          # Vitest configuration
  ├── setup.ts                  # Global test setup
  ├── package.json              # Test dependencies
  ├── README.md                 # This file
  │
  ├── unit/                     # Unit tests
  │   ├── parser/               # Parser unit tests
  │   │   ├── formula-detector.test.ts
  │   │   ├── header-detector.test.ts
  │   │   ├── normalizer.test.ts
  │   │   └── schema-inference.test.ts
  │   ├── validation/           # Validation unit tests
  │   │   ├── gtin.test.ts
  │   │   └── arithmetic.test.ts
  │   ├── crypto/               # Cryptographic unit tests
  │   │   └── fingerprint.test.ts
  │   └── committee/            # Committee unit tests
  │       ├── weighted-voting.test.ts
  │       └── consensus.test.ts
  │
  ├── integration/              # Integration tests
  │   ├── parser.integration.test.ts
  │   ├── committee.integration.test.ts
  │   └── zoho-matcher.integration.test.ts
  │
  ├── e2e/                      # End-to-end tests
  │   ├── order-workflow.e2e.test.ts
  │   └── setup/                # E2E test setup
  │       ├── mock-zoho.ts
  │       ├── mock-teams.ts
  │       └── mock-providers.ts
  │
  ├── golden-files/             # Golden file test suite
  │   ├── README.md             # Golden files documentation
  │   ├── runner.ts             # Golden file test runner
  │   ├── generate-fixtures.ts  # Fixture generation script
  │   ├── fixtures/             # Excel test files (.xlsx)
  │   └── expected/             # Expected JSON outputs
  │
  ├── mocks/                    # Mock data
  │   ├── zoho-responses.ts
  │   ├── committee-responses.ts
  │   └── sample-orders.ts
  │
  └── utils/                    # Test utilities
      ├── test-helpers.ts
      └── excel-builder.ts
```

## Test Categories

### 1. Unit Tests (`unit/`)

Test individual functions in isolation without external dependencies.

**Coverage:**
- Parser: header detection, formula detection, normalization, schema inference
- Validators: GTIN check digit, arithmetic tolerance
- Crypto: fingerprint generation for idempotency
- Committee: weighted voting, consensus logic

**Run:**
```bash
npm run test:unit
```

### 2. Integration Tests (`integration/`)

Test service interactions with mocked external dependencies.

**Coverage:**
- Parser → Canonical JSON output
- Committee → Aggregated votes
- Zoho Matcher → Customer/item resolution

**Run:**
```bash
npm run test:integration
```

### 3. E2E Tests (`e2e/`)

Full workflow tests simulating real usage without actual external API calls.

**Coverage:**
- File upload → Parse → Validate → Create draft
- User correction workflows
- Committee decision flows
- Idempotency checks
- Error scenarios

**Run:**
```bash
npm run test:e2e
```

### 4. Golden Files (`golden-files/`)

Representative Excel files with expected parser outputs for regression testing.

**Purpose:**
- Regression tests for parser changes
- Model weight calibration
- Documentation of supported formats

See [golden-files/README.md](golden-files/README.md) for details.

**Run:**
```bash
npm run test:golden
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('normalizeNumber', () => {
  it('should handle European format (1.234,56)', () => {
    const result = normalizeNumber('1.234,56');
    expect(result).toBe(1234.56);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Parser Integration', () => {
  it('should parse simple spreadsheet to canonical JSON', async () => {
    const result = await parseExcel('test-file.xlsx');

    expect(result.status).toBe('ready');
    expect(result.lines.length).toBe(2);
  });
});
```

### E2E Test Example

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('Order Workflow E2E', () => {
  beforeAll(async () => {
    // Setup mock servers
  });

  it('should process order from upload to draft', async () => {
    // Test full workflow
  });
});
```

## Test Utilities

### Test Helpers (`utils/test-helpers.ts`)

- `deepEqual()` - Deep equality comparison
- `computeDiff()` - Object diff for debugging
- `createMockEvidence()` - Create evidence cells
- `validateGtinCheckDigit()` - GTIN validation
- `approxEqual()` - Floating point comparison
- `waitFor()` - Async condition waiter

### Excel Builder (`utils/excel-builder.ts`)

Programmatically create Excel files for testing:

```typescript
import { ExcelBuilder } from './utils/excel-builder';

const builder = new ExcelBuilder();
const buffer = await builder.createSimpleWorkbook({
  headers: ['SKU', 'Product', 'Qty', 'Price'],
  rows: [
    ['SKU-001', 'Widget A', 10, 25.50]
  ]
});
```

## Mocking

### Mock Zoho API

Uses MSW (Mock Service Worker) to intercept HTTP requests:

```typescript
import { createMockZohoServer } from './e2e/setup/mock-zoho';

const server = createMockZohoServer();
server.listen();
```

### Mock Teams Bot

```typescript
import { MockTeamsBotAdapter } from './e2e/setup/mock-teams';

const adapter = new MockTeamsBotAdapter();
await adapter.sendMessage('conv-123', 'Test message');
```

### Mock AI Providers

```typescript
import { MockProviderService } from './e2e/setup/mock-providers';

const provider = new MockProviderService();
const result = await provider.generateMapping('gpt-4o', evidencePack);
```

## Coverage Requirements

**Target Coverage:** 80%

Run coverage report:
```bash
npm run test:coverage
```

View HTML report:
```bash
open coverage/index.html
```

## CI/CD Integration

Tests run automatically on:
- Every pull request
- Before deployment
- Nightly regression tests

**CI Configuration:**
```yaml
# .github/workflows/test.yml
- run: npm run test:coverage
- run: npm run test:golden
```

## Debugging Tests

### Run specific test file

```bash
npx vitest unit/parser/normalizer.test.ts
```

### Run tests matching pattern

```bash
npx vitest -t "GTIN"
```

### Debug in VS Code

Add breakpoints and use the "Debug Test" code lens, or use:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal"
}
```

### View test output

```bash
npm run test:watch
```

## Best Practices

### ✅ Do

- Write tests before or alongside code (TDD)
- Test edge cases and error conditions
- Use descriptive test names
- Mock external dependencies
- Keep tests fast (<100ms for unit tests)
- Use golden files for regression testing
- Maintain >80% code coverage

### ❌ Don't

- Make network calls in unit tests
- Test implementation details
- Share state between tests
- Write flaky tests
- Skip error scenarios
- Commit failing tests

## Common Issues

### Tests timing out

Increase timeout in `vitest.config.ts`:
```typescript
test: {
  testTimeout: 30000
}
```

### Mock server not working

Ensure server is started before tests:
```typescript
beforeAll(() => server.listen());
afterAll(() => server.close());
```

### Coverage not accurate

Ensure coverage includes all source files:
```typescript
coverage: {
  include: ['services/**/src/**/*.ts']
}
```

## Performance

**Test Execution Times (target):**
- Unit tests: <5 seconds
- Integration tests: <30 seconds
- E2E tests: <60 seconds
- Golden files: <120 seconds

**Total suite: <5 minutes**

## Maintenance

### Weekly

- Run full test suite
- Check coverage reports
- Fix flaky tests

### Monthly

- Update golden files
- Review mock data accuracy
- Refactor slow tests

### Quarterly

- Re-calibrate committee weights
- Add new edge case tests
- Archive obsolete tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [MSW Documentation](https://mswjs.io/)
- [ExcelJS Documentation](https://github.com/exceljs/exceljs)
- [Testing Best Practices](https://testingjavascript.com/)

## Support

For questions or issues with tests:
1. Check this README
2. See `SOLUTION_DESIGN.md` section 9.3
3. Review existing test examples
4. Ask the team in #order-processing-dev

---

**Last Updated:** 2025-12-25
