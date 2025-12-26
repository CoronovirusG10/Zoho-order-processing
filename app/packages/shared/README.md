# @order-processing/shared

Shared utilities used across all services in the monorepo.

## Features

### Logging (`src/logging/`)
- Structured logger with correlation ID support
- Log levels: debug, info, warn, error
- Context binding (caseId, tenantId, userId)
- Automatic secret redaction
- Application Insights integration ready
- JSONL format for file output

```typescript
import { Logger } from '@order-processing/shared';

const logger = new Logger({ caseId: 'case-123', tenantId: 'tenant-456' });
logger.info('Processing order', { customerId: 'cust-001' });
logger.error('Failed to parse', error, { filename: 'order.xlsx' });

// Create child logger with additional context
const childLogger = logger.child({ userId: 'user-789' });
```

### Correlation Context (`src/correlation/`)
- AsyncLocalStorage-based context management
- Automatic trace_id and span_id generation
- Propagate across async operations
- Extract from Teams activity

```typescript
import { runWithContextAsync, getContext } from '@order-processing/shared';

await runWithContextAsync({ caseId: 'case-123' }, async () => {
  // Context is available in all nested async calls
  const context = getContext();
  console.log(context.traceId, context.caseId);
});
```

### Error Handling (`src/errors/`)
- Base application error classes
- Error code constants
- Error classification (transient vs permanent)
- Retry recommendations
- User-facing message generation

```typescript
import { ValidationError, handleError, getRetryRecommendation } from '@order-processing/shared';

throw new ValidationError('Invalid SKU format', { field: 'sku', row: 5 });

// Handle and classify errors
const classification = handleError(error, logger);
const retry = getRetryRecommendation(error, attemptNumber);
```

### Validation (`src/validation/`)
- JSON Schema validation using Ajv
- GTIN validation (8/12/13/14 digits with check digit)
- SKU normalization
- Currency parsing
- Quantity validation
- Arithmetic tolerance checking

```typescript
import { validateGtin, normalizeSku, validateLineArithmetic } from '@order-processing/shared';

const gtinResult = validateGtin('5901234123457');
if (gtinResult.valid) {
  console.log(gtinResult.type); // "GTIN-13"
}

const sku = normalizeSku('  abc-123  '); // "ABC-123"

const arithmeticResult = validateLineArithmetic(10, 5.0, 50.0);
```

### Crypto/Hashing (`src/crypto/`)
- SHA-256 hashing for files and strings
- Order fingerprint generation for idempotency
- Combines: fileSha256 + customerId + normalizedLineHash + dateBucket

```typescript
import { sha256File, generateOrderFingerprint } from '@order-processing/shared';

const hash = await sha256File('/path/to/file.xlsx');

const fingerprint = generateOrderFingerprint({
  fileSha256: hash,
  customerId: 'cust-001',
  lineItems: [{ sku: 'SKU-001', quantity: 10 }],
  orderDate: new Date(),
});
```

### Date/Time (`src/datetime/`)
- ISO 8601 formatting
- Date bucketing (hour, day, week, month)
- Date arithmetic
- Locale-aware display formatting

```typescript
import { toIsoDate, getDateBucket, addDays } from '@order-processing/shared';

const today = toIsoDate(new Date()); // "2025-12-25"
const bucket = getDateBucket(new Date(), 'day'); // "2025-12-25"
const tomorrow = addDays(new Date(), 1);
```

### Configuration (`src/config/`)
- Environment variable loader with validation
- Type-safe environment parsing
- Feature flag definitions and checks

```typescript
import { getRequiredEnv, isFeatureEnabled } from '@order-processing/shared';

const apiUrl = getRequiredEnv('API_URL', 'url');
const port = getRequiredEnv('PORT', 'number');

if (isFeatureEnabled('ENABLE_COMMITTEE')) {
  // Run AI committee validation
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Clean
npm run clean
```

## Design Principles

1. **Pure functions where possible** - All utility functions are pure and side-effect free
2. **No `any` types** - Fully type-safe with TypeScript strict mode
3. **Dependency injection** - Designed for testability
4. **Secret safety** - Logger automatically redacts sensitive data
5. **Evidence-based** - Errors and validations include context for debugging

## Usage in Services

```typescript
// In any service
import {
  Logger,
  runWithContextAsync,
  ValidationError,
  validateGtin,
  generateOrderFingerprint,
  isFeatureEnabled,
} from '@order-processing/shared';
```
