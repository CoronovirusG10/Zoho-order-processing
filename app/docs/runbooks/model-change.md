# Runbook: AI Model Change

## Overview

This runbook covers procedures for adding, removing, or updating AI models in the committee system. The committee uses multiple AI providers to cross-check schema mappings, reducing single-model errors.

## When to Use This Runbook

- Deploying a new model version in Azure AI Foundry
- Adding a new provider to the committee pool
- Removing an underperforming provider
- Changing committee provider weights
- Updating provider configurations (endpoints, timeouts)

## Current Committee Configuration

### Provider Pool

| Provider ID | Model | Source | Default Weight |
|-------------|-------|--------|----------------|
| `azure-gpt-5.1` | GPT-5.1 | Azure AI Foundry | 1.1 |
| `azure-gpt-5.2` | GPT-5.2 | Azure AI Foundry | 1.15 |
| `azure-claude-opus-4.5` | Claude Opus 4.5 | Azure AI Foundry | 1.2 |
| `azure-deepseek-v3.2` | DeepSeek V3.2 | Azure AI Foundry | 1.0 |
| `gemini-2.5-pro` | Gemini 2.5 Pro | Google AI | 1.05 |
| `xai-grok-4-reasoning` | Grok-4 Fast | xAI | 1.0 |

### Current Selection

3 providers are randomly selected from the pool for each case.

## Pre-Change Checklist

- [ ] Golden file tests pass with current configuration
- [ ] New model deployed and accessible
- [ ] API keys/credentials configured in Key Vault
- [ ] Weight calibration completed (if adding new model)
- [ ] Rollback plan documented
- [ ] Off-peak timing selected (recommended: after business hours)
- [ ] Stakeholders notified

## Adding a New Provider

### Step 1: Deploy Model (Azure AI Foundry)

For Azure AI Foundry models:

```bash
# Deploy model using Azure CLI
az ml online-deployment create \
  --resource-group order-processing-rg \
  --workspace-name order-processing-foundry \
  --name new-model-deployment \
  --file deployment.yaml
```

For external providers:
1. Obtain API key from provider
2. Store in Key Vault (see Step 2)

### Step 2: Configure Credentials

```bash
# Store API key in Key Vault
az keyvault secret set \
  --vault-name order-processing-kv \
  --name "ai-provider-newmodel-key" \
  --value "<api-key>"

# Store endpoint (if custom)
az keyvault secret set \
  --vault-name order-processing-kv \
  --name "ai-provider-newmodel-endpoint" \
  --value "https://api.provider.com/v1"
```

### Step 3: Create Provider Configuration

Add provider configuration in `/services/committee/src/config/providers.ts`:

```typescript
{
  id: 'new-provider-id',
  name: 'New Provider Display Name',
  type: 'azure-openai', // or 'anthropic', 'google', 'xai', 'custom'
  endpoint: process.env.NEW_PROVIDER_ENDPOINT,
  apiKeySecretName: 'ai-provider-newmodel-key',
  model: 'model-version',
  maxTokens: 4096,
  temperature: 0.1,
  timeoutMs: 30000,
  enabled: true,
}
```

### Step 4: Run Golden File Calibration

```bash
cd /data/order-processing/app

# Run calibration with new provider included
npm run calibrate -- \
  --providers "azure-gpt-5.2,azure-claude-opus-4.5,azure-deepseek-v3.2,new-provider-id" \
  --golden-dir ./tests/golden-files \
  --output ./config/weights-new.json

# Review results
cat ./config/weights-new.json
```

Expected output:

```
Calibration Results:
====================
Provider                    Accuracy    Weight    Cases
---------------------------------------------------------
azure-gpt-5.2               95.2%       0.34      50
azure-claude-opus-4.5       94.8%       0.33      50
new-provider-id             93.5%       0.30      50
azure-deepseek-v3.2         92.1%       0.28      50
---------------------------------------------------------
Golden files tested: 50
Average consensus rate: 87.3%
```

### Step 5: Update Configuration

```bash
# Backup current config
cp ./config/weights.json ./config/weights.backup.$(date +%Y%m%d).json

# Apply new weights
cp ./config/weights-new.json ./config/weights.json

# Update provider pool in App Config
az appconfig kv set --name order-processing-config \
  --key Committee:ProviderPool \
  --value "azure-gpt-5.2,azure-claude-opus-4.5,azure-deepseek-v3.2,new-provider-id" \
  --yes
```

### Step 6: Deploy to Staging

```bash
# Deploy to staging environment
npm run deploy:staging

# Run smoke tests
npm run test:smoke -- --env staging --include committee

# Run integration tests
npm run test:integration -- --env staging --filter committee
```

### Step 7: Canary Deployment (Recommended)

```bash
# Enable canary mode - new provider used for 10% of cases
az appconfig kv set --name order-processing-config \
  --key Committee:CanaryProvider --value "new-provider-id" --yes

az appconfig kv set --name order-processing-config \
  --key Committee:CanaryPercentage --value "10" --yes
```

Monitor for 24 hours before proceeding.

### Step 8: Full Rollout

```bash
# Increase canary to 50%
az appconfig kv set --name order-processing-config \
  --key Committee:CanaryPercentage --value "50" --yes

# After 24 hours with no issues, disable canary mode
az appconfig kv delete --name order-processing-config \
  --key Committee:CanaryProvider --yes

az appconfig kv delete --name order-processing-config \
  --key Committee:CanaryPercentage --yes

# Deploy to production
npm run deploy:prod
```

## Removing a Provider

### Step 1: Remove from Pool

```bash
# Update provider pool (exclude the provider being removed)
az appconfig kv set --name order-processing-config \
  --key Committee:ProviderPool \
  --value "azure-gpt-5.2,azure-claude-opus-4.5,azure-deepseek-v3.2" \
  --yes
```

### Step 2: Recalibrate Weights

```bash
# Run calibration without the removed provider
npm run calibrate -- \
  --providers "azure-gpt-5.2,azure-claude-opus-4.5,azure-deepseek-v3.2" \
  --golden-dir ./tests/golden-files \
  --output ./config/weights-updated.json

# Apply new weights
cp ./config/weights-updated.json ./config/weights.json
```

### Step 3: Deploy Changes

```bash
npm run deploy:prod
```

### Step 4: Clean Up

```bash
# Remove provider configuration (optional, can leave disabled)
# Remove API key from Key Vault if no longer needed
az keyvault secret delete \
  --vault-name order-processing-kv \
  --name "ai-provider-oldmodel-key"
```

## Updating Provider Weights

### Manual Weight Adjustment

```bash
# View current weights
cat ./config/weights.json

# Edit weights manually
# weights.json format:
# {
#   "azure-gpt-5.2": 1.15,
#   "azure-claude-opus-4.5": 1.20,
#   "azure-deepseek-v3.2": 1.00
# }

# Apply changes
npm run deploy:prod
```

### Automatic Recalibration

```bash
# Run full calibration against golden files
npm run calibrate -- \
  --golden-dir ./tests/golden-files \
  --output ./config/weights.json

# Review diff
git diff ./config/weights.json

# Deploy if satisfied
npm run deploy:prod
```

## Monitoring After Changes

### Key Metrics to Watch

```kusto
// Committee agreement rate (should be >= 85%)
customEvents
| where timestamp > ago(2h)
| where name == "CommitteeVote"
| extend consensus = tostring(customDimensions.consensus)
| summarize
    Total = count(),
    Unanimous = countif(consensus == "unanimous"),
    Majority = countif(consensus == "majority"),
    Split = countif(consensus == "split"),
    NoConsensus = countif(consensus == "no_consensus")
| extend AgreementRate = (Unanimous + Majority) * 100.0 / Total
```

```kusto
// Provider-level accuracy
customEvents
| where timestamp > ago(24h)
| where name == "CommitteeProviderVote"
| extend
    provider = tostring(customDimensions.provider),
    correct = tobool(customDimensions.matched_final)
| summarize
    Total = count(),
    Correct = countif(correct),
    Accuracy = countif(correct) * 100.0 / count()
  by provider
| order by Accuracy desc
```

```kusto
// Provider latency
customEvents
| where timestamp > ago(2h)
| where name == "CommitteeProviderVote"
| extend
    provider = tostring(customDimensions.provider),
    latency = todouble(customDimensions.latency_ms)
| summarize
    p50 = percentile(latency, 50),
    p95 = percentile(latency, 95),
    p99 = percentile(latency, 99)
  by provider
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Agreement Rate | < 85% | < 70% |
| Provider Accuracy | < 88% | < 80% |
| Provider Latency (p95) | > 10s | > 20s |
| "Needs Human" Rate | > 20% | > 35% |

## Rollback Procedures

### Immediate Rollback

```bash
# Restore previous weights
cp ./config/weights.backup.YYYYMMDD.json ./config/weights.json

# Restore previous provider pool
az appconfig kv set --name order-processing-config \
  --key Committee:ProviderPool \
  --value "azure-gpt-5.1,azure-claude-opus-4.5,azure-grok-4" \
  --yes

# Deploy
npm run deploy:prod
```

### Disable Problematic Provider Only

```bash
# Remove just the new provider from pool
az appconfig kv set --name order-processing-config \
  --key Committee:ProviderPool \
  --value "azure-gpt-5.2,azure-claude-opus-4.5,azure-deepseek-v3.2" \
  --yes

# Disable at provider level (no deployment needed)
az appconfig kv set --name order-processing-config \
  --key Committee:Providers:new-provider-id:Enabled \
  --value "false" \
  --yes
```

## Testing Requirements

### Before Production Deployment

1. **Golden File Tests**: All golden files must pass
   ```bash
   npm run test:golden -- --all
   ```

2. **Integration Tests**: Committee integration tests pass
   ```bash
   npm run test:integration -- --filter committee
   ```

3. **Staging Smoke Tests**: Real requests processed correctly
   ```bash
   npm run test:smoke -- --env staging
   ```

### Golden File Format

```json
{
  "caseId": "golden-001",
  "description": "Standard English order with clear headers",
  "filePath": "./tests/golden-files/fixtures/order-001.xlsx",
  "evidencePack": {
    "caseId": "golden-001",
    "candidateHeaders": ["Customer Name", "SKU", "Quantity", "Unit Price"],
    "sampleValues": {
      "0": ["Acme Corp", "Beta Inc", "Gamma Ltd"],
      "1": ["ABC-001", "XYZ-999", "DEF-555"],
      "2": ["10", "5", "25"],
      "3": ["100.00", "250.50", "75.25"]
    },
    "columnStats": [],
    "detectedLanguage": "en",
    "constraints": ["Must choose from candidate IDs only"],
    "timestamp": "2025-12-25T12:00:00Z"
  },
  "expectedMappings": {
    "customer_name": "0",
    "sku": "1",
    "quantity": "2",
    "unit_price": "3"
  }
}
```

## Success Criteria

After any model change, verify:

- [ ] Committee agreement rate >= 85%
- [ ] No increase in "needs human" cases (>5% delta)
- [ ] Golden file accuracy >= 90%
- [ ] No P1 incidents in first 48 hours
- [ ] Provider latency within acceptable range
- [ ] Error rate stable or improved

## Troubleshooting

### Provider Not Responding

```bash
# Check provider status
npm run committee:health -- --provider new-provider-id

# Test provider directly
curl -X POST "https://api.provider.com/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "model-id", "messages": [{"role": "user", "content": "test"}]}'
```

### High Disagreement Rate

1. Check if specific field types are causing issues
2. Review provider outputs for the disagreeing cases
3. Consider adjusting weights or removing provider
4. Check for prompt template issues

### Calibration Failures

```bash
# Run calibration with verbose output
npm run calibrate -- --verbose --providers "..."

# Check golden file format
npm run validate:golden -- --dir ./tests/golden-files
```

## Appendix: Provider Implementation

### Adding a Custom Provider

1. Create provider class in `/services/committee/src/providers/`:

```typescript
// custom-provider.ts
import { BaseProvider } from './base-provider';

export class CustomProvider extends BaseProvider {
  readonly id = 'custom-provider-id';
  readonly name = 'Custom Provider';

  async callModel(prompt: string): Promise<ProviderResponse> {
    // Implementation
  }
}
```

2. Register in factory:

```typescript
// provider-factory.ts
import { CustomProvider } from './custom-provider';

factory.register('custom-provider-id', CustomProvider);
```

### Provider Response Schema

All providers must return:

```typescript
interface ProviderResponse {
  mappings: Array<{
    field: string;
    selectedColumnId: string;
    confidence: number;
    reasoning: string;
  }>;
  issues: Array<{
    code: string;
    severity: 'warning' | 'error';
    evidence: string;
  }>;
  overallConfidence: number;
  processingTimeMs: number;
}
```
