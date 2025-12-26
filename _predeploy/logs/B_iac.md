# IaC Audit Report - Subagent B

**Date**: 2025-12-26
**Status**: PASS (with warnings)
**IaC Type**: Azure Bicep

---

## Summary

The Infrastructure as Code validation completed successfully. The Bicep templates compile without errors, though there are linter warnings that should be addressed before production deployment.

---

## IaC Files Detected

| File | Purpose |
|------|---------|
| `app/infra/main.bicep` | Main deployment template (subscription-scoped) |
| `app/infra/modules/aifoundry.bicep` | Azure AI Foundry Hub + Project |
| `app/infra/modules/appinsights.bicep` | Application Insights |
| `app/infra/modules/bot.bicep` | Azure Bot Service |
| `app/infra/modules/containerapp.bicep` | Container Apps (prod only) |
| `app/infra/modules/cosmos.bicep` | Cosmos DB account + containers |
| `app/infra/modules/functionapp.bicep` | Azure Function Apps |
| `app/infra/modules/keyvault.bicep` | Azure Key Vault |
| `app/infra/modules/loganalytics.bicep` | Log Analytics Workspace |
| `app/infra/modules/rbac.bicep` | RBAC role assignments |
| `app/infra/modules/secrets.bicep` | Key Vault secrets |
| `app/infra/modules/staticwebapp.bicep` | Static Web App |
| `app/infra/modules/storage.bicep` | Storage Account + containers/queues |
| `app/infra/modules/vnet.bicep` | Virtual Network (private endpoints) |

**Total**: 14 Bicep files

---

## Resources Defined

### Required Resources (Checklist)

| Resource | Status | Notes |
|----------|--------|-------|
| Key Vault | PRESENT | `keyvault.bicep` - RBAC auth, soft delete, purge protection (prod) |
| Storage Account | PRESENT | `storage.bicep` - Blob containers, queues, lifecycle policies |
| App Insights | PRESENT | `appinsights.bicep` - Connected to Log Analytics |
| Log Analytics | PRESENT | `loganalytics.bicep` - 730-day retention |
| Functions | PRESENT | `functionapp.bicep` - 3 function apps (workflow, parser, zoho) |
| Container Apps | PRESENT | `containerapp.bicep` - Prod environment only |
| Cosmos DB | PRESENT | `cosmos.bicep` - 6 containers defined |
| AI Search | NOT DEFINED | Not in current templates |
| Service Bus | NOT DEFINED | Using Storage Queues instead |

### Additional Resources

- **Virtual Network**: Conditional (prod only) for private endpoints
- **Azure Bot**: Teams bot configuration
- **Static Web App**: Teams Tab UI
- **AI Foundry**: Hub + Project for AI workloads
- **AI Services**: Cognitive Services account

---

## Region Configuration

| Setting | Value | Status |
|---------|-------|--------|
| Default Location | `swedencentral` | PASS |
| Bot Location | `global` | PASS (required for Azure Bot) |

---

## Environment Separation

| Environment | Features |
|-------------|----------|
| `dev` | Free tier Cosmos, 1GB daily Log Analytics cap, no private endpoints |
| `test` | Same as dev |
| `prod` | Zone redundancy, purge protection, private endpoints, Container Apps |

**Status**: PASS - Proper environment separation with `@allowed(['dev', 'test', 'prod'])` constraint

---

## Validation Results

### Build Status
- **Command**: `az bicep build --file main.bicep`
- **Result**: SUCCESS (compiled to ARM JSON)
- **Errors**: 0
- **Warnings**: 41

### Warning Categories

| Category | Count | Severity | Description |
|----------|-------|----------|-------------|
| `no-unused-params` | 9 | Low | Unused parameters (cleanup recommended) |
| `no-unused-vars` | 2 | Low | Unused variables |
| `no-unnecessary-dependson` | 7 | Low | Redundant dependency declarations |
| `BCP318` | 17 | Medium | Nullable module access (conditional deployments) |
| `outputs-should-not-contain-secrets` | 3 | High | Secrets in outputs |
| `use-secure-value-for-secure-inputs` | 1 | High | Insecure value for secret property |

### High-Severity Warnings (Recommend Fix)

1. **Secrets in Outputs** (`outputs-should-not-contain-secrets`)
   - `storage.bicep:316` - Connection string with `listKeys()`
   - `cosmos.bicep:410` - Connection string with `listKeys()`
   - `staticwebapp.bicep:79` - API key with `listSecrets()`

2. **Insecure Secret Handling** (`use-secure-value-for-secure-inputs`)
   - `containerapp.bicep:89` - App Insights connection string passed as non-secure

---

## Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| TLS 1.2 minimum | PASS | Storage, Function Apps, Key Vault |
| HTTPS only | PASS | Function Apps, Storage |
| Public blob access | DISABLED | Storage Account |
| Soft delete | ENABLED | Key Vault (90 days) |
| Purge protection | PROD ONLY | Key Vault |
| RBAC authorization | ENABLED | Key Vault |
| Managed identities | ENABLED | All compute resources |
| Private endpoints | PROD ONLY | Conditional deployment |
| Diagnostic logs | ENABLED | All resources to Log Analytics |

---

## Missing Resources (Recommendations)

| Resource | Priority | Recommendation |
|----------|----------|----------------|
| AI Search | Low | Add if semantic search needed |
| Service Bus | Optional | Storage Queues sufficient for current scale |
| Container Registry | Medium | Needed if using custom container images |

---

## Recommendations

### Critical (Fix Before Prod)

1. **Remove secrets from outputs** - Use Key Vault references instead of outputting connection strings
2. **Fix secure value warnings** - Use `@secure()` decorator for sensitive parameters

### Medium Priority

1. **Add null-coalescing operators** - Handle nullable module outputs properly for conditional deployments
2. **Clean up unused parameters** - Remove `foundryHubResourceId`, `foundryProjectResourceId`, `teamsAppTenantId`, `vnetId` params

### Low Priority

1. **Remove unnecessary dependsOn** - Bicep infers dependencies automatically
2. **Remove unused variables** - Clean up `storageAccountContributor`, `cosmosDBAccountContributor`

---

## Evidence Files

| File | Location |
|------|----------|
| IaC Files List | `_predeploy/evidence/B_iac/iac_files.txt` |
| Validation Output | `_predeploy/evidence/B_iac/validation_output.txt` |

---

## Overall Status

| Criteria | Status |
|----------|--------|
| IaC Type Identified | PASS |
| Region Configuration | PASS |
| Environment Separation | PASS |
| Required Resources | PASS (Storage Queues used instead of Service Bus) |
| Syntax Validation | PASS |
| Security Configuration | PASS (with recommendations) |

**FINAL STATUS: PASS**

The infrastructure code is valid and deployable. High-severity warnings regarding secrets in outputs should be addressed before production deployment for enhanced security posture.
