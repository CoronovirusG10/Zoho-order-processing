# Committee Engine Implementation Summary

**Agent**: 5 - Committee Engine
**Date**: 2025-12-25
**Status**: Complete

## Overview

Reviewed and enhanced the existing 3-provider committee engine implementation at `/data/order-processing/app/services/committee/`. The committee provides cross-checking of schema mapping decisions using multiple AI providers to reduce single-model mistakes.

## Existing Implementation Review

The committee engine was already substantially implemented with:

- **5 Provider Implementations**: Azure OpenAI, Azure Anthropic, Azure DeepSeek, Gemini, xAI
- **Engine Orchestrator**: Parallel provider execution, timeout handling, blob storage for audit
- **Weighted Voting**: Aggregation with configurable provider weights
- **Consensus Detection**: Unanimous, majority, split, no_consensus types
- **Calibration Script**: Golden file-based weight calibration
- **Golden Test Files**: English, Farsi, and ambiguous test cases

## Enhancements Made

### 1. Provider Interfaces (Task a)

All 5 providers were already implemented with a common `BaseProvider` interface:

| Provider | Type | Authentication | Status |
|----------|------|----------------|--------|
| Azure OpenAI (GPT-5.1) | `azure-openai` | Managed Identity | Existing |
| Azure Anthropic (Claude Opus 4.5) | `azure-anthropic` | Managed Identity | Existing |
| Azure DeepSeek (V3.2) | `azure-deepseek` | Managed Identity | Existing |
| External Gemini (2.5) | `gemini` | API Key | Existing |
| xAI Grok-4 | `xai` | API Key | Existing |

**Files**:
- `/data/order-processing/app/services/committee/src/providers/base-provider.ts`
- `/data/order-processing/app/services/committee/src/providers/azure-openai-provider.ts`
- `/data/order-processing/app/services/committee/src/providers/azure-anthropic-provider.ts`
- `/data/order-processing/app/services/committee/src/providers/azure-deepseek-provider.ts`
- `/data/order-processing/app/services/committee/src/providers/gemini-provider.ts`
- `/data/order-processing/app/services/committee/src/providers/xai-provider.ts`

### 2. Selection with Diversity (Task b)

**NEW**: Added diversity-aware provider selection to ensure 3 distinct provider *families*.

```typescript
// Provider families ensure diversity
type ProviderFamily = 'openai' | 'anthropic' | 'deepseek' | 'google' | 'xai';

// Selection prefers different families
const result = selectProviders(providers, {
  count: 3,
  pool: availableIds,
  enforceDiversity: true, // Avoids 2 OpenAI models, etc.
});
```

**Files**:
- `/data/order-processing/app/services/committee/src/providers/selection.ts` (NEW)

### 3. Request Format (Task c)

Evidence pack structure was already well-defined. Added enhancements:

```typescript
interface EvidencePack {
  caseId: string;
  candidateHeaders: string[];           // Header text only
  sampleValues: Record<string, string[]>; // 5 samples per column
  columnStats: ColumnStats[];           // Type distribution, patterns
  detectedLanguage: SupportedLanguage;  // en, fa, ar, mixed, unknown
  constraints: string[];                // "Must choose from candidates only"
  timestamp: string;
  metadata?: {                          // NEW: Optional context
    sourceFileName?: string;
    totalRows?: number;
    hasFormulas?: boolean;
  };
}
```

**NEW**: Evidence pack builder utility for constructing packs from raw data.

**Files**:
- `/data/order-processing/app/services/committee/src/utils/evidence-pack-builder.ts` (NEW)
- `/data/order-processing/app/services/committee/src/types.ts` (ENHANCED)

### 4. Response Validation (Task d)

**NEW**: Centralized JSON Schema validation module with comprehensive checks.

```typescript
// Shared schema used by all providers
const PROVIDER_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['mappings', 'issues', 'overallConfidence', 'processingTimeMs'],
  properties: {
    mappings: {
      type: 'array',
      items: {
        required: ['field', 'selectedColumnId', 'confidence', 'reasoning'],
        // ...
      }
    },
    // ...
  }
};

// Full validation pipeline
const result = validateFull(rawOutput, expectedFields, validColumnIds);
if (!result.valid) {
  // Handle validation errors
}
```

**Files**:
- `/data/order-processing/app/services/committee/src/validation/output-schema.ts` (NEW)
- `/data/order-processing/app/services/committee/src/validation/index.ts` (NEW)

### 5. Aggregation (Task e)

Weighted voting was already implemented. Key features:

- **Vote Strength**: `provider_weight * confidence`
- **Winner Selection**: Highest total vote weight
- **Margin Calculation**: Winner weight - runner-up weight
- **Human Review Flag**: Triggered when margin < threshold or low confidence

```typescript
// Aggregation logic
const fieldVotes = aggregateVotes(outputs, weights, 0.25);

// Consensus types
type ConsensusType = 'unanimous' | 'majority' | 'split' | 'no_consensus';

// Human review conditions
- Consensus is 'split' or 'no_consensus'
- Overall confidence < 0.75
- Any field has requiresHuman = true
```

**Files**:
- `/data/order-processing/app/services/committee/src/aggregation/weighted-voting.ts`
- `/data/order-processing/app/services/committee/src/aggregation/consensus-detector.ts`

### 6. Weight Calibration (Task f)

**ENHANCED**: Calibration script now outputs to a persistent config file.

```bash
# Run calibration
npm run calibrate -- --golden-dir ./tests/golden
```

**Output**: `/data/order-processing/app/services/committee/config/calibrated-weights.json`

```json
{
  "version": "1.0.0",
  "lastCalibrated": "2025-12-25T12:00:00Z",
  "calibrationCasesCount": 3,
  "weights": {
    "azure-gpt-5.1": 1.15,
    "azure-claude-opus-4.5": 1.20,
    "azure-deepseek-v3.2": 1.00,
    "gemini-2.5-pro": 1.05,
    "xai-grok-4-reasoning": 1.00
  },
  "providerStats": {
    "azure-gpt-5.1": {
      "accuracy": 0.92,
      "fieldAccuracies": { "customer_name": 1.0, "sku": 0.9 }
    }
    // ...
  }
}
```

**Weight Loading Priority**:
1. `COMMITTEE_WEIGHTS_FILE` environment variable
2. `config/calibrated-weights.json`
3. Hardcoded `DEFAULT_WEIGHTS`

**Files**:
- `/data/order-processing/app/services/committee/src/config/weights-file.ts` (NEW)
- `/data/order-processing/app/services/committee/src/config/weights.ts` (ENHANCED)
- `/data/order-processing/app/services/committee/scripts/calibrate-weights.ts` (ENHANCED)

## File Structure

```
services/committee/
  config/
    .gitkeep                          # Calibrated weights directory (NEW)
  scripts/
    calibrate-weights.ts              # ENHANCED: Outputs config file
  src/
    index.ts                          # ENHANCED: New exports
    types.ts                          # ENHANCED: SupportedLanguage
    engine.ts                         # Existing orchestrator
    config/
      provider-config.ts              # Provider configurations
      weights.ts                      # ENHANCED: File-based loading
      weights-file.ts                 # NEW: Config file management
    providers/
      base-provider.ts                # Common interface
      azure-openai-provider.ts        # GPT-5.1, GPT-5.2
      azure-anthropic-provider.ts     # Claude Opus 4.5
      azure-deepseek-provider.ts      # DeepSeek V3.2
      gemini-provider.ts              # Gemini 2.5 Pro
      xai-provider.ts                 # Grok-4
      provider-factory.ts             # ENHANCED: Diversity selection
      selection.ts                    # NEW: Diversity-aware selection
    validation/
      output-schema.ts                # NEW: Shared JSON schema
      index.ts                        # NEW: Validation exports
    aggregation/
      weighted-voting.ts              # Vote aggregation
      consensus-detector.ts           # Consensus classification
    prompts/
      mapping-review-prompt.ts        # Schema mapping prompts
      extraction-review-prompt.ts     # Extraction review prompts
    tasks/
      schema-mapping-review.ts        # Task execution
      extraction-review.ts            # Future implementation
    utils/
      evidence-pack-builder.ts        # NEW: Evidence pack construction
      index.ts                        # NEW: Utility exports
  tests/
    golden/
      golden-001-english.json         # Standard English test
      golden-002-farsi.json           # Farsi headers test
      golden-003-ambiguous.json       # Ambiguous columns test
```

## Usage Example

```typescript
import {
  CommitteeEngine,
  ProviderFactory,
  createDefaultConfig,
  getDefaultProviderConfigs,
  buildEvidencePack,
} from '@order-processing/committee';

// Initialize
const factory = new ProviderFactory({
  configs: getDefaultProviderConfigs()
});
const engine = new CommitteeEngine(factory, createDefaultConfig());

// Build evidence pack
const evidencePack = buildEvidencePack('case-123', [
  { header: 'Customer', values: ['Acme Corp', 'Beta Inc'] },
  { header: 'SKU', values: ['ABC-001', 'XYZ-999'] },
  { header: 'Qty', values: ['10', '5'] },
]);

// Run committee
const result = await engine.runCommittee({
  type: 'schema-mapping',
  evidencePack,
  expectedFields: ['customer_name', 'sku', 'quantity'],
  candidateColumns: {},
});

// Check result
if (result.requiresHumanReview) {
  // Flag disagreements for user
  console.log('Disagreements:', result.aggregatedResult.disagreements);
} else {
  // Auto-apply mappings
  console.log('Final mappings:', result.finalMappings);
}
```

## Configuration

### Environment Variables

```bash
# Azure OpenAI (GPT models)
AZURE_OPENAI_ENDPOINT=https://your-foundry.openai.azure.com

# Azure Anthropic (Claude via Foundry)
AZURE_ANTHROPIC_ENDPOINT=https://your-foundry.openai.azure.com

# Azure DeepSeek
AZURE_DEEPSEEK_ENDPOINT=https://your-foundry.openai.azure.com

# External providers
GOOGLE_API_KEY=your-gemini-api-key
XAI_API_KEY=your-xai-api-key

# Calibrated weights file (optional)
COMMITTEE_WEIGHTS_FILE=/path/to/calibrated-weights.json
```

### Default Configuration

```typescript
{
  providerCount: 3,                    // Select 3 providers
  providerPool: [                      // Pool of 5 providers
    'azure-gpt-5.1',
    'azure-claude-opus-4.5',
    'azure-deepseek-v3.2',
    'gemini-2.5-pro',
    'xai-grok-4-reasoning',
  ],
  consensusThreshold: 0.66,            // 2/3 majority
  confidenceThreshold: 0.75,           // Auto-accept threshold
  timeoutMs: 30000,                    // 30s per provider
  minSuccessfulProviders: 2,           // At least 2 must succeed
}
```

## Testing

Golden test files support:
- English headers (straightforward mapping)
- Farsi/Persian headers (language translation)
- Ambiguous columns (multiple quantity-like columns)

```bash
# Run calibration against golden files
npm run calibrate -- --golden-dir ./tests/golden
```

## Integration Points

The committee engine integrates with:
- **Parser Service**: Provides evidence packs after schema inference
- **Foundry Agent**: Invokes committee for validation
- **Workflow Orchestrator**: Part of case processing pipeline
- **Storage Service**: Audit trail in Azure Blob

## Security Considerations

- No secrets in prompts or evidence packs
- Managed Identity for Azure providers
- API keys in environment variables only
- PII minimized (only 5 sample values)
- Full audit trail for compliance

## Known Limitations

1. Extraction review task not yet implemented (V2 feature)
2. Weights require manual calibration via script
3. No real-time provider health monitoring

## Next Steps

1. Integrate with parser service for evidence pack generation
2. Connect to Foundry Agent for interactive review
3. Implement extraction review task for V2
4. Add provider health checks and circuit breakers
