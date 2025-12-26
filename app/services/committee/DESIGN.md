# Committee Engine - Design Document

## Overview

The Committee Engine implements a multi-provider AI validation system for schema mapping in the order processing application. By running 3 different AI providers in parallel and aggregating their votes, we significantly reduce single-model mapping mistakes.

## Design Principles

### 1. Deterministic Where Possible, AI Where Necessary

- **Deterministic** candidate generation (header matching, type detection)
- **AI Committee** for final disambiguation when deterministic scoring is insufficient
- **Strict JSON schema** validation on all AI outputs

### 2. Bounded Evidence Packs

Providers receive **only**:
- Candidate header texts
- 5 sample values per column
- Column statistics (type distribution, patterns)
- Detected language
- Explicit constraints

Providers **do not** receive:
- Full workbook contents
- Complete customer/product data
- Unbounded context that could lead to hallucinations

### 3. Strict Output Validation

All provider responses must:
- Match exact JSON schema
- Only reference provided candidate column IDs
- Include reasoning for audit trail
- Provide confidence scores

Invalid responses are rejected and treated as provider failures.

### 4. Graceful Degradation

- Minimum 2/3 providers must succeed
- Failed providers don't block the process
- Timeouts are enforced (30s per provider)
- System continues with successful responses

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Committee Engine                         │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐│
│  │  Provider      │  │   Weighted     │  │   Consensus    ││
│  │  Factory       │  │   Voting       │  │   Detector     ││
│  └────────────────┘  └────────────────┘  └────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Task Executors                           │  │
│  │  - Schema Mapping Review                             │  │
│  │  - Extraction Review (future)                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Provider   │    │   Provider   │    │   Provider   │
│      1       │    │      2       │    │      3       │
│ (Azure GPT)  │    │ (Claude)     │    │ (DeepSeek)   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │  Blob Storage   │
                  │  (Audit Trail)  │
                  └─────────────────┘
```

### Provider Types

#### Azure AI Foundry Providers
- **Azure OpenAI**: GPT-5.1, GPT-5.2, GPT-4.1
- **Azure Anthropic**: Claude Opus 4.5, Claude Sonnet 4.5
- **Azure DeepSeek**: DeepSeek V3.2

Uses Managed Identity authentication via `@azure/identity`.

#### External Providers
- **Google Gemini**: Gemini 2.5 Pro via Google AI API
- **xAI Grok**: Grok-4 Fast Reasoning via xAI API

Uses API key authentication.

## Workflow

### 1. Provider Selection

```typescript
// Randomly select 3 providers from pool
const selectedProviders = factory.selectRandomProviders(3, [
  'azure-gpt-5.1',
  'azure-claude-opus-4.5',
  'azure-deepseek-v3.2',
  'gemini-2.5-pro',
  'xai-grok-4-reasoning',
]);
```

**Why random?**
- Avoids bias toward specific provider combinations
- Ensures diversity over time
- Distributes load across providers

### 2. Evidence Pack Preparation

```typescript
const evidencePack: EvidencePack = {
  caseId: string,
  candidateHeaders: string[],        // Header text only
  sampleValues: Record<string, string[]>,  // 5 samples per column
  columnStats: ColumnStats[],        // Type distribution, patterns
  detectedLanguage: 'en' | 'fa' | 'mixed',
  constraints: string[],             // Explicit rules
  timestamp: string,
};
```

**Key constraints:**
- "Must choose from candidate column IDs only"
- "Cannot invent new columns or values"
- "Return null if no suitable match exists"

### 3. Parallel Provider Execution

```typescript
// Execute all providers in parallel with timeout
const providerPromises = providers.map((provider) =>
  limit(async () => {
    return await provider.executeMapping(
      evidencePack,
      expectedFields,
      systemPrompt,
      timeoutMs
    );
  })
);

const results = await Promise.all(providerPromises);
```

**Concurrency control:**
- Max 3 concurrent provider calls
- 30-second timeout per provider
- Errors caught and marked as failures

### 4. Output Validation

```typescript
// Validate against JSON schema
const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['mappings', 'issues', 'overallConfidence', 'processingTimeMs'],
  properties: {
    mappings: {
      type: 'array',
      items: {
        required: ['field', 'selectedColumnId', 'confidence', 'reasoning'],
        properties: {
          field: { type: 'string' },
          selectedColumnId: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' },
        },
      },
    },
    // ... more validation
  },
};
```

**Validation checks:**
- Schema compliance
- All expected fields mapped
- Column IDs exist in candidates
- Confidence values in range [0, 1]

### 5. Weighted Voting

```typescript
// For each field, aggregate votes
for (const field of allFields) {
  const votes = new Map<string | null, VoteInfo>();

  for (const output of outputs) {
    const mapping = output.mappings.find(m => m.field === field);
    const providerWeight = weights[output.providerId];

    // Vote strength = weight × confidence
    const voteStrength = providerWeight * mapping.confidence;
    votes.get(mapping.selectedColumnId).weight += voteStrength;
  }

  // Winner = highest weighted vote
  const winner = maxBy(votes, v => v.weight);
}
```

**Weight sources:**
- Initial: Hand-tuned defaults
- Calibrated: From golden file accuracy
- Updated: Via calibration script

### 6. Consensus Detection

```typescript
type ConsensusType =
  | 'unanimous'     // All providers agree
  | 'majority'      // 2/3+ agree with sufficient margin
  | 'split'         // Mixed votes, low margin
  | 'no_consensus'; // Low confidence across all
```

**Decision thresholds:**
- Unanimous: All vote for same column
- Majority: Margin ≥ 0.25 between winner and runner-up
- Split: Margin < 0.25
- No consensus: Max confidence < 0.5

### 7. Human Review Determination

```typescript
requiresHumanReview =
  !isSufficientConsensus(consensus, confidence, threshold) ||
  anyFieldRequiresReview(fieldVotes);

function isSufficientConsensus(consensus, confidence, threshold) {
  // Unanimous + high confidence = auto-accept
  if (consensus === 'unanimous' && confidence >= threshold) {
    return true;
  }

  // Majority + very high confidence = auto-accept
  if (consensus === 'majority' && confidence >= 0.85) {
    return true;
  }

  // All other cases = human review
  return false;
}
```

### 8. Audit Trail Storage

```typescript
// Store to Azure Blob Storage
committee-outputs/
  {taskId}/
    evidence-pack.json    // Input evidence
    raw-outputs.json      // All provider responses
```

**Audit trail includes:**
- Task ID and case ID
- Selected provider IDs
- Complete provider outputs
- Aggregation results
- Configuration snapshot
- Timestamps

## Provider Implementation

### Base Provider Interface

```typescript
abstract class BaseProvider {
  abstract executeMapping(
    evidencePack: EvidencePack,
    expectedFields: string[],
    systemPrompt: string,
    timeoutMs: number
  ): Promise<ProviderMappingOutput>;

  protected abstract validateOutput(output: unknown): ProviderMappingOutput;
}
```

### Azure Provider Pattern

```typescript
class AzureOpenAIProvider extends BaseProvider {
  private client: AzureOpenAI;

  constructor(config: ProviderConfig) {
    super(config);

    const credential = new DefaultAzureCredential();
    this.client = new AzureOpenAI({
      endpoint: config.endpoint,
      azureADTokenProvider: async () => {
        const token = await credential.getToken(
          'https://cognitiveservices.azure.com/.default'
        );
        return token.token;
      },
    });
  }

  async executeMapping(...) {
    const response = await this.client.chat.completions.create({
      model: this.config.deploymentName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    return this.validateOutput(JSON.parse(response.content));
  }
}
```

### External Provider Pattern

```typescript
class GeminiProvider extends BaseProvider {
  private client: GoogleGenerativeAI;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async executeMapping(...) {
    const model = this.client.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(userPrompt);
    return this.validateOutput(JSON.parse(result.text()));
  }
}
```

## Weight Calibration

### Golden File Structure

```json
{
  "caseId": "golden-001",
  "description": "Standard English order",
  "expectedMappings": {
    "customer_name": "0",
    "sku": "1",
    "quantity": "2"
  },
  "evidencePack": { ... }
}
```

### Calibration Algorithm

```typescript
// 1. Run committee on all golden files
for (const testCase of goldenFiles) {
  const result = await engine.runCommittee(testCase);
  results.set(testCase.caseId, result);
}

// 2. Calculate per-provider accuracy
for (const provider of providers) {
  let correct = 0, total = 0;

  for (const testCase of goldenFiles) {
    const providerOutput = results.get(testCase.caseId)
      .providerOutputs.find(o => o.providerId === provider.id);

    for (const mapping of providerOutput.mappings) {
      const expected = testCase.expectedMappings[mapping.field];
      if (mapping.selectedColumnId === expected) {
        correct++;
      }
      total++;
    }
  }

  const accuracy = correct / total;

  // 3. Calculate recommended weight using logit
  const k = 10;
  const weight = 1 / (1 + Math.exp(-k * (accuracy - 0.5)));

  weights[provider.id] = weight;
}

// 4. Normalize weights
const normalized = normalizeWeights(weights);

// 5. Save weights
await saveWeights(normalized);
```

### Weight Formula

Using logistic function to map accuracy → weight:

```
weight = 1 / (1 + e^(-k * (accuracy - 0.5)))

where:
  k = 10 (steepness parameter)
  accuracy ∈ [0, 1]
  weight ∈ (0, 1)
```

**Properties:**
- accuracy = 0.5 → weight ≈ 0.5 (neutral)
- accuracy = 0.7 → weight ≈ 0.88 (good)
- accuracy = 0.9 → weight ≈ 0.98 (excellent)
- accuracy = 0.3 → weight ≈ 0.12 (poor)

## Security Considerations

### No Secrets in Prompts

```typescript
// ✗ BAD - Leaking customer data
const prompt = `Map these columns for customer ${customerName}...`;

// ✓ GOOD - Bounded evidence only
const evidencePack = {
  sampleValues: {
    '0': ['Sample 1', 'Sample 2', ...],  // Max 5 samples
  },
};
```

### Managed Identity for Azure

```typescript
// Use DefaultAzureCredential for all Azure providers
const credential = new DefaultAzureCredential();
```

### API Keys via Environment

```bash
# Never hardcode API keys
GOOGLE_API_KEY=xxx
XAI_API_KEY=yyy
```

### Audit Trail

All decisions logged to immutable blob storage:
- Evidence pack sent to providers
- Raw provider responses
- Aggregation logic
- Final decision

## Performance Characteristics

### Typical Case

- **Providers**: 3 selected randomly
- **Parallel execution**: Yes (max 3 concurrent)
- **Timeout per provider**: 30 seconds
- **Actual execution time**: 2-5 seconds
- **Evidence pack size**: 10-50 KB
- **Output size**: 5-20 KB per provider

### Cost Analysis

Per case with 3 providers:

| Provider | Tokens In | Tokens Out | Cost/Case |
|----------|-----------|------------|-----------|
| GPT-5.1 | ~2,000 | ~1,000 | ~$0.05 |
| Claude Opus 4.5 | ~2,000 | ~1,000 | ~$0.06 |
| DeepSeek V3.2 | ~2,000 | ~1,000 | ~$0.02 |
| **Total** | | | **~$0.13** |

At 200 cases/day: **~$26/day** or **~$780/month**

### Optimization Options

1. **Selective committee**: Only run on uncertain cases
2. **Provider pool rotation**: Use cheaper providers more often
3. **Batch processing**: Group similar cases
4. **Caching**: Cache similar evidence packs

## Error Handling

### Provider Failures

```typescript
try {
  const output = await provider.executeMapping(...);
  return { providerId, output };
} catch (error) {
  return {
    providerId,
    error: error.message,
    output: {
      mappings: [],
      issues: [{ code: 'PROVIDER_FAILED', ... }],
      overallConfidence: 0,
    },
  };
}
```

### Insufficient Providers

```typescript
const successful = outputs.filter(o => !o.error);

if (successful.length < minSuccessfulProviders) {
  throw new Error(
    `Only ${successful.length} providers succeeded ` +
    `(minimum: ${minSuccessfulProviders})`
  );
}
```

### Validation Failures

```typescript
if (!validateOutput(output)) {
  const errors = validateOutput.errors
    .map(e => `${e.instancePath}: ${e.message}`)
    .join(', ');
  throw new Error(`Invalid provider output: ${errors}`);
}
```

## Future Enhancements

### V2 Features

1. **Extraction Review**: Validate extracted values, not just mappings
2. **Incremental Learning**: Update weights continuously
3. **Provider Diversity Scoring**: Prefer diverse provider combinations
4. **Confidence Calibration**: Fine-tune confidence thresholds per field type
5. **Specialized Providers**: Different pools for different languages/domains

### Advanced Consensus

- **Bayesian voting**: Model provider reliability over time
- **Field-specific weights**: Different weights per canonical field
- **Explainability**: Generate human-readable disagreement summaries

### Integration Enhancements

- **Real-time calibration**: Update weights after each human correction
- **A/B testing**: Compare committee vs single-provider accuracy
- **Cost optimization**: Dynamic provider selection based on budget

## References

- Solution Design: `/data/order-processing/SOLUTION_DESIGN.md` § 5.6
- Model Access Report: `/data/order-processing/MODEL_ACCESS_REPORT_2025-12-20.md`
- Azure AI Foundry Documentation
- Provider API Documentation (OpenAI, Anthropic, Google, xAI)
