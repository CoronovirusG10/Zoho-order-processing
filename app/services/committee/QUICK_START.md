# Committee Engine - Quick Start Guide

## 1. Installation

```bash
cd /data/order-processing/app/services/committee
npm install
```

## 2. Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Required for Azure providers
AZURE_OPENAI_ENDPOINT=https://your-foundry.openai.azure.com
AZURE_ANTHROPIC_ENDPOINT=https://your-foundry.openai.azure.com
AZURE_DEEPSEEK_ENDPOINT=https://your-foundry.openai.azure.com

# Required for external providers
GOOGLE_API_KEY=your-google-api-key
XAI_API_KEY=your-xai-api-key

# Required for audit trail
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
```

## 3. Build

```bash
npm run build
```

## 4. Run Example

```bash
npm run dev -- examples/basic-usage.ts
```

Expected output:
```
Initialized 5 providers
Committee config: { providerCount: 3, ... }
Running committee with 3 providers...
✓ Committee completed in 3524ms

=== Results ===
Task ID: abc-123-...
Consensus: majority
Overall Confidence: 87.5%
Requires Human Review: false

=== Final Mappings ===
  customer_name: Column 0 (Customer Name)
  sku: Column 1 (SKU)
  quantity: Column 4 (Quantity)
  ...
```

## 5. Basic Usage in Your Code

```typescript
import {
  CommitteeEngine,
  ProviderFactory,
  createDefaultConfig,
  getDefaultProviderConfigs,
  EvidencePack,
  SchemaMappingTask,
} from '@order-processing/committee';

// One-time setup
const factory = new ProviderFactory({
  configs: getDefaultProviderConfigs()
});

const engine = new CommitteeEngine(
  factory,
  createDefaultConfig(),
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

// Per-case execution
async function validateMapping(caseId: string, candidateData: any) {
  const evidencePack: EvidencePack = {
    caseId,
    candidateHeaders: candidateData.headers,
    sampleValues: candidateData.samples,
    columnStats: candidateData.stats,
    detectedLanguage: 'en',
    constraints: [
      'Must choose from candidate IDs only',
      'Cannot invent new columns',
    ],
    timestamp: new Date().toISOString(),
  };

  const task: SchemaMappingTask = {
    type: 'schema-mapping',
    evidencePack,
    expectedFields: [
      'customer_name',
      'sku',
      'quantity',
      'unit_price',
      'line_total',
    ],
    candidateColumns: {},
  };

  const result = await engine.runCommittee(task);

  if (result.requiresHumanReview) {
    // Flag for human review in Teams
    return {
      status: 'needs_review',
      disagreements: result.aggregatedResult.disagreements,
    };
  } else {
    // Auto-accept committee decision
    return {
      status: 'approved',
      mappings: result.finalMappings,
    };
  }
}
```

## 6. Calibrate Weights

Add golden test files to `tests/golden/`:

```json
{
  "caseId": "test-001",
  "description": "Description",
  "evidencePack": { ... },
  "expectedMappings": {
    "customer_name": "0",
    "sku": "1",
    ...
  }
}
```

Run calibration:

```bash
npm run calibrate -- --golden-dir ./tests/golden
```

## 7. Monitoring

Check audit trail in Azure Blob Storage:

```
committee-outputs/
  {task-id}/
    evidence-pack.json    # What the committee saw
    raw-outputs.json      # All provider responses
```

## 8. Troubleshooting

### No providers initialized
**Problem**: "Not enough enabled providers"
**Solution**: Check environment variables are set correctly

### Provider timeout
**Problem**: "Provider timeout after 30000ms"
**Solution**: Increase `timeoutMs` in config or check network connectivity

### Validation errors
**Problem**: "Invalid provider output"
**Solution**: Provider returned malformed JSON. Check provider logs.

### Insufficient consensus
**Problem**: "requiresHumanReview: true"
**Solution**: This is expected when providers disagree. Route to human review.

## 9. Common Patterns

### Pattern 1: Integration with Parser

```typescript
// After deterministic schema inference
const parserResults = await parseExcel(workbook);

// Run committee for validation
const committeeResult = await engine.runCommittee({
  type: 'schema-mapping',
  evidencePack: buildEvidencePack(parserResults),
  expectedFields: CANONICAL_FIELDS,
});

// Use committee decision
if (committeeResult.requiresHumanReview) {
  await createUserReviewTask(committeeResult);
} else {
  await applyMappings(committeeResult.finalMappings);
}
```

### Pattern 2: Cost Optimization

```typescript
// Only run committee for uncertain cases
if (deterministicConfidence < 0.8) {
  const committeeResult = await engine.runCommittee(task);
  return committeeResult.finalMappings;
} else {
  // Use deterministic result directly
  return deterministicMappings;
}
```

### Pattern 3: Provider Pool Rotation

```typescript
// Different pools for different scenarios
const config = createDefaultConfig();

if (language === 'fa') {
  // Farsi - use providers known to handle multilingual well
  config.providerPool = [
    'gemini-2.5-pro',
    'azure-claude-opus-4.5',
    'azure-gpt-5.2',
  ];
} else {
  // English - use default pool
  config.providerPool = getRecommendedProviderPool();
}

const engine = new CommitteeEngine(factory, config);
```

## 10. Performance Tips

1. **Reuse engine instance** - Don't create new engine for each case
2. **Run selectively** - Only use committee for uncertain cases
3. **Batch if possible** - Process multiple cases concurrently
4. **Monitor costs** - Track provider usage in Azure Monitor
5. **Tune thresholds** - Adjust consensus thresholds based on accuracy vs cost

## 11. Next Steps

- Read [DESIGN.md](./DESIGN.md) for architecture details
- Review [README.md](./README.md) for complete API reference
- Check [examples/basic-usage.ts](./examples/basic-usage.ts) for more examples
- See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for technical details

## Support

For issues or questions:
1. Check the documentation
2. Review golden file examples
3. Examine audit trail in blob storage
4. Verify environment configuration
