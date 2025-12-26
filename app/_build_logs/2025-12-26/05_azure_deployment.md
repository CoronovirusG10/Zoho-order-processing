# Azure Deployment Preparation Summary

**Date**: 2025-12-26
**Task**: Prepare Azure deployment scripts and validate Bicep templates
**Region**: Sweden Central (swedencentral)

---

## Deliverables Completed

### 1. Deployment Script Created
**File**: `/data/order-processing/app/infra/deploy.sh`

Features:
- Interactive deployment with confirmation prompts
- Prerequisite validation (Azure CLI, Bicep, login status)
- What-if analysis before actual deployment
- Support for multiple environments (dev, test, prod)
- Color-coded output for better visibility
- Post-deployment output retrieval

Usage:
```bash
# Production deployment (default)
./deploy.sh

# Environment-specific deployment
./deploy.sh rg-orderprocessing-prod prod
./deploy.sh rg-orderprocessing-dev dev

# Validation only
./deploy.sh validate

# What-if preview
./deploy.sh whatif

# Get deployment outputs
./deploy.sh outputs
```

### 2. Parameter Files Created

**Production**: `/data/order-processing/app/infra/parameters.prod.json`
- Premium Function Apps
- Private endpoints enabled
- 730-day log retention
- 1825-day (5-year) blob retention
- AI Foundry deployment enabled

**Development**: `/data/order-processing/app/infra/parameters.dev.json`
- Consumption tier Functions
- No private endpoints
- 30-day log retention
- 90-day blob retention
- AI Foundry deployment enabled

### 3. Bicep Validation

**Status**: PASSED (with warnings only)

**Fix Applied**:
- Fixed `storage.bicep` queue metadata property structure
- Lines 159-176: Moved `metadata` under `properties` for queue resources

**Remaining Warnings** (non-blocking):
- Unused parameters in some modules (vnetId, teamsAppTenantId)
- Secret exposure warnings in outputs (by design for connection strings)
- Unnecessary dependsOn entries (Bicep auto-resolves dependencies)
- BCP318 warnings for conditional module outputs

### 4. README.md Updated

**File**: `/data/order-processing/app/infra/README.md`

Updates made:
- Updated directory structure to reflect new file locations
- Updated deployment commands for new deploy.sh location
- Updated parameter file names (parameters.*.json)
- Added new deployment modes (validate, whatif, outputs)

---

## Resources to be Created

### Core Infrastructure (All Environments)

| Resource Type | Name Pattern | Count |
|---------------|--------------|-------|
| Resource Group | order-processing-{env}-rg | 1 |
| Log Analytics Workspace | order-processing-{env}-logs | 1 |
| Application Insights | order-processing-{env}-ai | 1 |
| Storage Account | orderstor{suffix} | 1 |
| Cosmos DB Account | order-processing-{env}-cosmos | 1 |
| Key Vault | orderkv{suffix} | 1 |
| Function App (Workflow) | order-workflow-{env}-func | 1 |
| Function App (Parser) | order-parser-{env}-func | 1 |
| Function App (Zoho) | order-zoho-{env}-func | 1 |
| App Service Plan | {func-name}-plan | 3 |
| Azure Bot Service | order-processing-{env}-bot | 1 |
| Static Web App | order-processing-{env}-swa | 1 |

### AI Foundry Resources (When Enabled)

| Resource Type | Name Pattern | Count |
|---------------|--------------|-------|
| AI Services Account | order-processing-{env}-aiservices | 1 |
| AI Hub (Workspace) | order-processing-{env}-hub | 1 |
| AI Project | order-processing-{env}-project | 1 |

### Production-Only Resources

| Resource Type | Name Pattern | Count |
|---------------|--------------|-------|
| Virtual Network | order-processing-prod-vnet | 1 |
| Network Security Group | order-processing-prod-vnet-nsg | 1 |
| Container App Environment | order-processing-prod-env | 1 |
| Container App | order-bot-runtime-prod | 1 |
| Private Endpoints | {resource}-pe | 3 |

### Storage Components

**Blob Containers:**
| Container | Purpose |
|-----------|---------|
| orders-incoming | Raw uploaded Excel files |
| orders-audit | Immutable audit bundles (WORM) |
| logs-archive | Archived diagnostic logs |
| committee-evidence | AI committee voting results |

**Storage Queues:**
| Queue | Purpose |
|-------|---------|
| case-processing | Workflow trigger queue |
| zoho-retry | Retry queue for Zoho API |

### Cosmos DB Collections

| Container | Partition Key | TTL | Purpose |
|-----------|---------------|-----|---------|
| cases | /tenantId | None | Order processing cases |
| fingerprints | /fingerprint | None | Idempotency tracking |
| events | /caseId | None | Audit event log |
| agentThreads | /threadId | 30 days | AI agent state |
| committeeVotes | /caseId | None | ML committee results |
| cache | /cacheKey | 24 hours | API response cache |

### Key Vault Secrets

| Secret Name | Purpose |
|-------------|---------|
| ZohoClientId | Zoho OAuth client ID |
| ZohoClientSecret | Zoho OAuth secret |
| ZohoRefreshToken | Zoho refresh token |
| StorageConnectionString | Azure Storage connection |
| CosmosConnectionString | Cosmos DB connection |
| AppInsightsConnectionString | Application Insights |
| TeamsAppPassword | Teams bot password |
| OpenAiApiKey | OpenAI GPT models |
| AnthropicApiKey | Anthropic Claude models |
| GoogleAiApiKey | Google Gemini models |
| DeepSeekApiKey | DeepSeek models |
| XAiApiKey | xAI Grok models |

### RBAC Assignments

| Role | Assigned To | Scope |
|------|-------------|-------|
| Storage Blob Data Contributor | Function Apps, Container App | Storage Account |
| Storage Queue Data Contributor | Workflow Function | Storage Account |
| Cosmos DB Data Contributor | Function Apps, Container App | Cosmos DB |
| Key Vault Secrets User | Function Apps, Container App | Key Vault |

---

## Estimated Resource Count by Environment

| Environment | Resources | Notes |
|-------------|-----------|-------|
| Development | ~25 | No VNet, no Container App, Consumption tier |
| Test | ~25 | Same as dev |
| Production | ~35 | VNet + 3 subnets, Container App, Private Endpoints |

---

## Deployment Order (Handled Automatically by Bicep)

1. Resource Group
2. Virtual Network (prod only)
3. Log Analytics Workspace
4. Application Insights
5. Storage Account (with containers and queues)
6. Cosmos DB (with database and containers)
7. Key Vault
8. Function Apps (3 instances)
9. Azure Bot Service
10. Static Web App
11. Container App (prod only)
12. AI Foundry Hub + Project (if enabled)
13. Key Vault Secrets
14. RBAC Assignments

---

## Post-Deployment Actions Required

1. **Configure Teams App Registration**
   - Create App Registration in Azure AD (Tenant B)
   - Configure API permissions
   - Update TeamsAppPassword in Key Vault

2. **Update API Key Secrets**
   - Add actual Zoho OAuth credentials
   - Add AI model API keys

3. **Configure CI/CD**
   - Get Static Web App deployment token
   - Set up GitHub Actions for Function Apps

4. **Deploy Application Code**
   - Build and deploy workflow function
   - Build and deploy parser function
   - Build and deploy zoho function
   - Deploy Teams Tab to Static Web App

---

## Files Modified/Created

| File | Action | Description |
|------|--------|-------------|
| `/data/order-processing/app/infra/deploy.sh` | Created | Deployment script |
| `/data/order-processing/app/infra/parameters.prod.json` | Created | Production parameters |
| `/data/order-processing/app/infra/parameters.dev.json` | Created | Development parameters |
| `/data/order-processing/app/infra/modules/storage.bicep` | Modified | Fixed queue metadata structure |
| `/data/order-processing/app/infra/README.md` | Modified | Updated deployment instructions |

---

## Validation Commands

```bash
# Validate Bicep syntax
az bicep build --file /data/order-processing/app/infra/main.bicep

# What-if deployment (dry run)
cd /data/order-processing/app/infra
./deploy.sh whatif

# Full deployment
./deploy.sh rg-orderprocessing-prod prod
```

---

## Cost Considerations

### Development Environment (Estimated Monthly)
- Function Apps (Consumption): $0 - $10/month
- Cosmos DB (Serverless, Free Tier): $0/month
- Storage (LRS, minimal usage): $1-5/month
- Log Analytics: ~$5/month
- **Total**: ~$10-20/month

### Production Environment (Estimated Monthly)
- Function Apps (Premium EP1 x3): ~$200/month
- Cosmos DB (Serverless): ~$50-100/month
- Storage (LRS): ~$10-20/month
- Container App: ~$50-100/month
- Log Analytics: ~$50/month
- Private Endpoints: ~$10/month
- **Total**: ~$350-500/month

---

## Summary

All deliverables have been completed:
- [x] Created deploy.sh script with interactive deployment
- [x] Created parameters.prod.json with production settings
- [x] Created parameters.dev.json with development settings
- [x] Validated Bicep templates (fixed storage.bicep errors)
- [x] Updated README.md with deployment instructions
- [x] Documented all resources to be created
- [x] Generated this summary report

The infrastructure is ready for deployment to Azure Sweden Central.
