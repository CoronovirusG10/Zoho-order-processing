# Committee Engine

Multi-provider AI committee for schema mapping validation and extraction review.

## Overview

The Committee Engine reduces single-model mapping mistakes by running multiple AI providers in parallel and using weighted voting to reach consensus. When providers disagree significantly, the system flags the case for human review.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Committee Engine                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Select 3 random providers from pool                 │
│  2. Prepare bounded evidence pack                       │
│  3. Call providers in parallel (with timeout)           │
│  4. Validate outputs against JSON schema                │
│  5. Aggregate votes with weights                        │
│  6. Detect consensus                                    │
│  7. Store audit trail to blob storage                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐
    │ Provider │       │ Provider │       │ Provider │
    │    1     │       │    2     │       │    3     │
    └──────────┘       └──────────┘       └──────────┘
```

## Features

### Supported Providers

**Azure AI Foundry:**
- GPT-5.1, GPT-5.2, GPT-4.1 (OpenAI models)
- Claude Opus 4.5, Claude Sonnet 4.5 (Anthropic)
- DeepSeek V3.2

**External APIs:**
- Google Gemini 2.5 Pro
- xAI Grok-4 Fast Reasoning

### Evidence Pack (Bounded Input)

Providers receive only:
- Candidate header texts
- 5 sample values per column
- Column statistics (type distribution, patterns)
- Detected language
- Strict constraints

**What providers DON'T see:**
- Full workbook contents
- Complete row data
- Customer/product data beyond samples

### Weighted Voting

Each provider has a weight based on calibrated accuracy:
- Higher weight = more trusted
- Weights are updated via calibration against golden files
- Voting uses: `vote_strength = provider_weight × confidence`

### Consensus Types

- **Unanimous**: All providers agree
- **Majority**: 2/3+ agree with sufficient margin
- **Split**: Mixed votes, low margin
- **No Consensus**: Low confidence across all providers

## Usage

### Basic Usage

```typescript
import {
  CommitteeEngine,
  ProviderFactory,
  createDefaultConfig,
  getDefaultProviderConfigs,
} from '@order-processing/committee';

// Initialize provider factory
const providerConfigs = getDefaultProviderConfigs();
const factory = new ProviderFactory({ configs: providerConfigs });

// Create committee engine
const config = createDefaultConfig();
const engine = new CommitteeEngine(
  factory,
  config,
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

// Prepare evidence pack
const evidencePack = {
  caseId: 'case-123',
  candidateHeaders: ['Customer', 'SKU', 'Qty', 'Price'],
  sampleValues: {
    '0': ['Acme Corp', 'Beta Inc', 'Gamma Ltd'],
    '1': ['ABC-001', 'XYZ-999', 'DEF-555'],
    '2': ['10', '5', '25'],
    '3': ['100.00', '250.50', '75.25'],
  },
  columnStats: [
    {
      columnId: '0',
      headerText: 'Customer',
      nonEmptyCount: 10,
      uniqueCount: 8,
      dataTypes: { string: 10 },
      patterns: [],
    },
    // ... more stats
  ],
  detectedLanguage: 'en',
  constraints: [
    'Must choose from candidate IDs only',
    'Cannot invent new columns',
  ],
  timestamp: new Date().toISOString(),
};

// Create task
const task = {
  type: 'schema-mapping',
  evidencePack,
  expectedFields: ['customer_name', 'sku', 'quantity', 'unit_price'],
  candidateColumns: {},
};

// Run committee
const result = await engine.runCommittee(task);

console.log('Consensus:', result.aggregatedResult.consensus);
console.log('Requires human review:', result.requiresHumanReview);
console.log('Final mappings:', result.finalMappings);
```

### Calibrating Weights

```bash
# Run calibration against golden test files
npm run calibrate -- --golden-dir ./tests/golden
```

Golden file format:
```json
{
  "caseId": "golden-001",
  "description": "Standard English order with clear headers",
  "filePath": "./golden-files/order-001.xlsx",
  "evidencePack": {
    "caseId": "golden-001",
    "candidateHeaders": ["Customer Name", "SKU", "Quantity"],
    "sampleValues": { ... },
    "columnStats": [ ... ],
    "detectedLanguage": "en",
    "constraints": [ ... ],
    "timestamp": "2025-12-25T12:00:00Z"
  },
  "expectedMappings": {
    "customer_name": "0",
    "sku": "1",
    "quantity": "2"
  }
}
```

## Configuration

### Environment Variables

```bash
# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-foundry.openai.azure.com

# Azure Anthropic (Claude via Foundry)
AZURE_ANTHROPIC_ENDPOINT=https://your-foundry.openai.azure.com

# Azure DeepSeek
AZURE_DEEPSEEK_ENDPOINT=https://your-foundry.openai.azure.com

# Google Gemini
GOOGLE_API_KEY=your-api-key

# xAI Grok
XAI_API_KEY=your-api-key

# Azure Storage (for audit trail)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
```

### Committee Configuration

```typescript
const config: CommitteeConfig = {
  providerCount: 3,                    // Number of providers to use
  providerPool: [                      // Available provider IDs
    'azure-gpt-5.1',
    'azure-claude-opus-4.5',
    'azure-deepseek-v3.2',
    'gemini-2.5-pro',
    'xai-grok-4-reasoning',
  ],
  weights: {                            // Provider weights
    'azure-gpt-5.1': 1.1,
    'azure-claude-opus-4.5': 1.2,
    'azure-deepseek-v3.2': 1.0,
    'gemini-2.5-pro': 1.05,
    'xai-grok-4-reasoning': 1.0,
  },
  consensusThreshold: 0.66,             // 2/3 majority
  confidenceThreshold: 0.75,            // Min confidence for auto-accept
  timeoutMs: 30000,                     // 30s per provider
  minSuccessfulProviders: 2,            // Min providers that must succeed
};
```

## Audit Trail

All committee decisions are stored in Azure Blob Storage:

```
committee-outputs/
  {taskId}/
    evidence-pack.json      # Input evidence
    raw-outputs.json        # All provider responses
```

Each result includes:
- Selected providers
- Individual provider outputs
- Aggregated votes
- Consensus determination
- Disagreements
- Execution time
- Configuration snapshot

## Provider Output Schema

All providers must return strict JSON:

```json
{
  "mappings": [
    {
      "field": "customer_name",
      "selectedColumnId": "0",
      "confidence": 0.95,
      "reasoning": "Column 0 'Customer' exactly matches..."
    }
  ],
  "issues": [
    {
      "code": "AMBIGUOUS_MAPPING",
      "severity": "warning",
      "evidence": "Columns 3 and 5 both contain numeric data"
    }
  ],
  "overallConfidence": 0.88,
  "processingTimeMs": 1523
}
```

## Error Handling

### Provider Failures

- If a provider times out or errors, it's marked as failed
- Committee continues with remaining providers
- Minimum 2/3 providers must succeed
- Failed providers don't contribute to voting

### Validation Errors

- All outputs are validated against JSON schema
- Invalid outputs are rejected
- Providers must return mappings for all expected fields

### Graceful Degradation

1. 3 providers selected → 2 succeed: Continue with 2
2. 3 providers selected → 1 succeeds: **Fail** (below minimum)
3. Invalid JSON from provider: Treat as failure
4. Timeout: Treat as failure

## Performance

- Providers called in parallel (max 3 concurrent)
- Typical execution: 2-5 seconds per case
- Timeout per provider: 30 seconds
- Evidence pack size: ~10-50 KB

## Testing

```bash
# Run tests
npm test

# Build
npm run build

# Development
npm run dev
```

## Integration

The Committee Engine is designed to be called from:

1. **Parser Service**: After initial schema inference
2. **Foundry Agent**: When user requests mapping validation
3. **Workflow Orchestrator**: As part of case processing

Example integration:

```typescript
// In parser service
const mappingSuggestions = await inferSchemaMapping(workbook);

// Run committee to validate
const committeeResult = await committeeEngine.runCommittee({
  type: 'schema-mapping',
  evidencePack: buildEvidencePack(workbook, mappingSuggestions),
  expectedFields: CANONICAL_FIELDS,
});

if (committeeResult.requiresHumanReview) {
  // Flag for user review in Teams
  await flagForUserReview(caseId, committeeResult.aggregatedResult.disagreements);
} else {
  // Auto-accept committee consensus
  await applyMappings(caseId, committeeResult.finalMappings);
}
```

## Security

- No secrets in prompts or evidence packs
- Uses Managed Identity for Azure providers
- API keys stored in environment variables
- All provider communications logged
- PII minimized in evidence packs (only 5 samples)
- Full audit trail for compliance

## License

UNLICENSED - Internal use only
