# Infrastructure Deployment Checklist

Use this checklist to ensure a successful deployment of the Order Processing infrastructure.

## Pre-Deployment

### Azure Setup
- [ ] Azure subscription active and accessible
- [ ] Sufficient permissions (Contributor or Owner role)
- [ ] Azure CLI installed and updated (`az --version`)
- [ ] Bicep CLI installed (`az bicep version`)
- [ ] Logged in to correct Azure tenant (`az login`)
- [ ] Correct subscription selected (`az account show`)

### Prerequisites Gathered
- [ ] Teams App ID (Microsoft App ID) - from Azure AD registration
- [ ] Teams Tenant ID (Tenant B)
- [ ] Zoho OAuth Client ID
- [ ] Zoho OAuth Client Secret
- [ ] Zoho Refresh Token
- [ ] Foundry Hub Resource ID (optional)
- [ ] Foundry Project Resource ID (optional)

### Configuration
- [ ] Parameter files updated (`main.parameters.<env>.json`)
- [ ] Environment selected (dev/test/prod)
- [ ] Location confirmed (swedencentral)
- [ ] Resource naming reviewed (uniqueSuffix will be auto-generated)

## Deployment Steps

### 1. Validate Template
```bash
# Run what-if analysis
./scripts/deploy.sh <env> swedencentral --what-if

# Or manually validate
az deployment sub validate \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @main.parameters.<env>.json
```

- [ ] Template validation successful
- [ ] What-if analysis reviewed
- [ ] No unexpected deletions or changes
- [ ] Resource names acceptable

### 2. Deploy Infrastructure
```bash
# Deploy using script
./scripts/deploy.sh <env> swedencentral

# Or manually deploy
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @main.parameters.<env>.json
```

- [ ] Deployment started successfully
- [ ] No errors during deployment
- [ ] All resources created
- [ ] Deployment outputs captured

### 3. Validate Deployment
```bash
# Run validation script
./scripts/validate.sh <env>
```

- [ ] Resource group created
- [ ] Storage account with containers and queues
- [ ] Cosmos DB with database and containers
- [ ] Key Vault accessible
- [ ] Function Apps created with Managed Identity
- [ ] Bot Service configured
- [ ] Static Web App deployed
- [ ] Application Insights linked
- [ ] Log Analytics workspace active
- [ ] RBAC assignments applied

### 4. Configure Secrets
```bash
# Run secrets setup script
./scripts/setup-secrets.sh <env> <key-vault-name>
```

- [ ] Zoho credentials stored in Key Vault
  - [ ] ZohoClientId
  - [ ] ZohoClientSecret
  - [ ] ZohoRefreshToken
- [ ] Teams App credentials stored
  - [ ] TeamsAppId
  - [ ] TeamsAppPassword
- [ ] Optional AI provider keys stored
  - [ ] GeminiApiKey (optional)
  - [ ] XAIApiKey (optional)

### 5. Verify RBAC and Permissions
- [ ] Function Apps have Storage Blob Data Contributor role
- [ ] Function Apps have Storage Queue Data Contributor role
- [ ] Function Apps have Cosmos DB Data Contributor role
- [ ] Function Apps have Key Vault Secrets User role
- [ ] Container App has required roles (if prod)
- [ ] No access errors in Function App logs

## Post-Deployment

### Application Code Deployment
- [ ] Build Function App code (workflow, parser, zoho)
- [ ] Deploy to Function Apps using CI/CD or manual
- [ ] Verify Function Apps are running
- [ ] Test Function App endpoints
- [ ] Check Application Insights for telemetry

### Teams App Configuration
- [ ] Azure AD app registration completed (Tenant B)
- [ ] Bot endpoint configured in Azure Bot Service
- [ ] Teams channel enabled
- [ ] Teams app manifest created
- [ ] App uploaded to Teams (custom app)
- [ ] Bot tested in Teams 1:1 chat

### Static Web App Deployment
- [ ] Teams tab UI built (React/Next.js)
- [ ] GitHub Actions or Azure DevOps configured
- [ ] Static Web App deployed
- [ ] Teams tab SSO configured
- [ ] Tab tested in Teams

### Foundry Agent Setup
- [ ] Foundry Hub linked (if new deployment)
- [ ] Foundry Project linked
- [ ] Agent tools deployed:
  - [ ] parse_excel
  - [ ] validate_order
  - [ ] create_zoho_draft
  - [ ] lookup_candidates
  - [ ] committee_map_fields
- [ ] Committee models configured (3 providers)
- [ ] Agent tested via API

### Integration Testing
- [ ] Upload test Excel file via Teams bot
- [ ] Verify file stored in `orders-incoming` blob container
- [ ] Check parser function execution
- [ ] Verify Cosmos DB case record created
- [ ] Test committee voting (if enabled)
- [ ] Verify validation and issue detection
- [ ] Test user correction workflow
- [ ] Create draft sales order in Zoho (sandbox)
- [ ] Verify audit bundle in `orders-audit` container
- [ ] Check Application Insights traces
- [ ] Review Log Analytics logs

### Monitoring Setup
- [ ] Application Insights alerts configured
- [ ] Log Analytics queries saved
- [ ] Azure Monitor workbooks created (optional)
- [ ] Cost alerts set up
- [ ] Budget configured

### Security Review
- [ ] All secrets in Key Vault (no hardcoded values)
- [ ] RBAC properly configured
- [ ] Private endpoints enabled (prod only)
- [ ] TLS 1.2 enforced
- [ ] Diagnostic settings enabled on all resources
- [ ] Soft delete enabled on Key Vault
- [ ] Immutable storage configured on audit container

### Documentation
- [ ] Infrastructure topology documented
- [ ] Connection strings and endpoints documented
- [ ] Runbooks created for common operations
- [ ] Disaster recovery plan documented
- [ ] Cost optimization reviewed

## Environment-Specific Checks

### Development Environment
- [ ] Cosmos DB in serverless mode
- [ ] Function Apps on Consumption plan
- [ ] No private endpoints (cost savings)
- [ ] Log retention at 90 days
- [ ] Free tier enabled where possible

### Production Environment
- [ ] Cosmos DB zone-redundant
- [ ] Function Apps on Premium plan with VNet integration
- [ ] Private endpoints enabled for Storage, Cosmos, Key Vault
- [ ] Log retention at 730 days
- [ ] Backup and disaster recovery tested
- [ ] High availability validated
- [ ] Performance tested under load

## Common Issues and Solutions

### Template Validation Fails
- Update Bicep CLI: `az bicep upgrade`
- Check parameter file syntax
- Verify all required parameters provided

### Deployment Fails - Insufficient Permissions
- Verify Contributor or Owner role on subscription
- Check for Azure Policy restrictions
- Ensure quota available for resources

### Function App Can't Access Key Vault
- Verify Managed Identity enabled
- Check RBAC assignments
- Ensure Key Vault firewall allows Azure services

### Private Endpoint Issues
- Verify VNet and subnet created
- Check DNS resolution
- Ensure correct subnet delegation

### Cosmos DB Throttling
- Switch from serverless to provisioned
- Increase RU/s allocation
- Review query patterns

## Rollback Plan

If deployment fails or issues occur:

1. **Preserve Data**
   ```bash
   # Export Cosmos DB data
   # Download blobs from Storage
   # Export Key Vault secrets
   ```

2. **Delete Failed Resources**
   ```bash
   az group delete --name order-processing-<env>-rg --yes --no-wait
   ```

3. **Fix Issues and Redeploy**
   - Review deployment logs
   - Fix template or parameters
   - Redeploy from clean state

4. **Restore Data** (if applicable)
   - Re-import Cosmos DB data
   - Upload blobs back to Storage
   - Recreate Key Vault secrets

## Success Criteria

Deployment is considered successful when:

- [ ] All resources deployed without errors
- [ ] Validation script passes 100%
- [ ] End-to-end test completes successfully
- [ ] No errors in Application Insights
- [ ] Teams bot responds in 1:1 chat
- [ ] Excel file uploaded and parsed correctly
- [ ] Draft sales order created in Zoho
- [ ] Audit trail complete in blob storage
- [ ] Monitoring and alerts active

## Sign-Off

- [ ] Infrastructure team approval
- [ ] Security team review completed
- [ ] Cost estimate approved
- [ ] Deployment documentation complete
- [ ] Runbook tested
- [ ] Team trained on operations

---

**Deployment Date:** ___________
**Deployed By:** ___________
**Environment:** ___________
**Version:** ___________
**Notes:** ___________
