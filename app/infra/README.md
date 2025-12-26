# Order Processing Infrastructure as Code (Bicep)

This directory contains Bicep templates for deploying the Order Processing application infrastructure to Azure (Sweden Central).

## Architecture Overview

The infrastructure deploys a complete Teams → Excel → AI Committee → Zoho Draft Sales Orders application with the following components:

### Core Infrastructure
- **Resource Group**: Logical container for all resources
- **Storage Account**: Blob storage for orders, audit trails, and logs
- **Cosmos DB**: NoSQL database for case state, fingerprints, events, and agent threads
- **Key Vault**: Secure storage for secrets and credentials
- **Application Insights**: Application performance monitoring
- **Log Analytics Workspace**: Centralized logging and analytics

### Compute
- **Azure Bot Service**: Teams bot integration
- **Function Apps** (3):
  - Workflow orchestration
  - Excel parser/validator
  - Zoho API integration
- **Static Web App**: Teams personal tab UI
- **Container App** (prod only): Optional bot runtime

### Networking (Production)
- **Virtual Network**: Private network for secure communication
- **Private Endpoints**: Secure access to Storage, Cosmos DB, and Key Vault

## Directory Structure

```
infra/
├── main.bicep                      # Main orchestration template
├── deploy.sh                       # Deployment script
├── parameters.dev.json             # Development environment parameters
├── parameters.prod.json            # Production environment parameters
├── README.md                       # This file
├── modules/
│   ├── appinsights.bicep          # Application Insights
│   ├── bot.bicep                  # Azure Bot Service
│   ├── containerapp.bicep         # Container Apps
│   ├── cosmos.bicep               # Cosmos DB
│   ├── functionapp.bicep          # Function Apps
│   ├── keyvault.bicep             # Key Vault
│   ├── loganalytics.bicep         # Log Analytics
│   ├── rbac.bicep                 # RBAC assignments
│   ├── secrets.bicep              # Key Vault secrets
│   ├── staticwebapp.bicep         # Static Web App
│   ├── storage.bicep              # Storage Account
│   └── vnet.bicep                 # Virtual Network
└── (scripts moved to root infra/)
```

## Prerequisites

1. **Azure CLI**: Install from https://aka.ms/azure-cli
2. **Bicep**: Installed automatically by scripts or run `az bicep install`
3. **Azure Subscription**: Active subscription with appropriate permissions
4. **Permissions**: Contributor or Owner role on the subscription

## Deployment

### Using Bash (Linux/macOS/WSL)

```bash
# Make script executable
chmod +x deploy.sh

# Deploy to production (default)
./deploy.sh

# Deploy to specific resource group and environment
./deploy.sh rg-orderprocessing-prod prod
./deploy.sh rg-orderprocessing-dev dev

# Validate only
./deploy.sh validate

# What-if preview (dry run)
./deploy.sh whatif

# Get deployment outputs
./deploy.sh outputs
```

### Manual Deployment

```bash
# Validate template
az bicep build --file main.bicep

# What-if (preview changes)
az deployment sub what-if \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @parameters.prod.json

# Deploy
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters @parameters.prod.json \
  --name order-processing-deployment
```

## Parameters

### Required Parameters

Update the parameter files (`parameters.<env>.json`) with your values:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `environment` | Environment name | `dev`, `test`, `prod` |
| `location` | Azure region | `swedencentral` |
| `teamsAppId` | Teams App ID (Microsoft App ID) | `00000000-0000-0000-0000-000000000000` |
| `teamsAppTenantId` | Teams Tenant ID (Tenant B) | `00000000-0000-0000-0000-000000000000` |

### Optional Parameters

| Parameter | Description | Default | Notes |
|-----------|-------------|---------|-------|
| `cosmosThroughputMode` | Cosmos DB mode | `serverless` | Use `provisioned` for prod |
| `functionPlanType` | Function hosting plan | `Consumption` | Use `Premium` for prod |
| `enablePrivateEndpoints` | Enable private endpoints | `false` (dev), `true` (prod) | Recommended for prod |
| `logRetentionDays` | Log Analytics retention | `730` | Max 730 days in workspace |
| `blobRetentionDays` | Blob storage retention | `1825` | 5 years minimum |

### Secrets (Set After Deployment)

These secrets should be set in Key Vault after deployment:

```bash
# Zoho OAuth credentials
az keyvault secret set --vault-name <key-vault-name> --name ZohoClientId --value '<your-value>'
az keyvault secret set --vault-name <key-vault-name> --name ZohoClientSecret --value '<your-value>'
az keyvault secret set --vault-name <key-vault-name> --name ZohoRefreshToken --value '<your-value>'

# Teams App Password
az keyvault secret set --vault-name <key-vault-name> --name TeamsAppPassword --value '<your-value>'
```

## Deployed Resources

### Storage Account
- **Containers**:
  - `orders-incoming`: Raw uploaded Excel files
  - `orders-audit`: Immutable audit bundles (canonical JSON, evidence)
  - `logs-archive`: Exported diagnostic logs
  - `committee-evidence`: ML committee voting results
- **Queues**:
  - `case-processing`: Case workflow queue
  - `zoho-retry`: Retry queue for Zoho API failures
- **Lifecycle**: Hot → Cool (30d) → Archive (365d) → Delete (5 years)

### Cosmos DB
- **Database**: `order-processing`
- **Containers**:
  - `cases` (partition: `/tenantId`) - Case state and metadata
  - `fingerprints` (partition: `/fingerprint`) - Idempotency tracking
  - `events` (partition: `/caseId`) - Audit event log
  - `agentThreads` (partition: `/threadId`) - Foundry agent state (30d TTL)
  - `committeeVotes` (partition: `/caseId`) - Committee voting results

### Function Apps
1. **order-workflow-{env}-func**: Workflow orchestration and bot handling
2. **order-parser-{env}-func**: Excel parsing and validation
3. **order-zoho-{env}-func**: Zoho Books API integration

All Function Apps include:
- System-assigned Managed Identity
- RBAC access to Storage, Cosmos DB, Key Vault
- Key Vault references for secrets
- Application Insights integration
- Durable Functions support

### RBAC Assignments

Managed Identities are granted the following roles:

| Service | Role | Purpose |
|---------|------|---------|
| Storage Account | Storage Blob Data Contributor | Read/write blobs |
| Storage Account | Storage Queue Data Contributor | Read/write queue messages |
| Cosmos DB | Cosmos DB Data Contributor | Read/write documents |
| Key Vault | Key Vault Secrets User | Read secrets |

## Security Features

### Authentication & Authorization
- **Managed Identity**: All services use system-assigned managed identities
- **RBAC**: Role-based access control instead of connection strings
- **Key Vault**: All secrets stored in Key Vault with audit logging

### Network Security
- **TLS 1.2**: Enforced minimum TLS version
- **HTTPS Only**: All endpoints require HTTPS
- **Private Endpoints** (prod): Storage, Cosmos DB, Key Vault
- **VNet Integration** (prod): Function Apps integrated with VNet

### Data Protection
- **Immutable Storage**: Audit container uses WORM policy
- **Soft Delete**: 30-day retention for deleted blobs
- **Versioning**: Blob versioning enabled
- **Backup**: Cosmos DB continuous backup (7 days)
- **Encryption**: At-rest encryption for all data

### Compliance & Audit
- **Diagnostic Settings**: All resources send logs to Log Analytics
- **Audit Logging**: Key Vault access audited
- **Retention**: 5-year minimum retention for audit trails
- **Change Feed**: Blob change feed enabled (90 days)

## Monitoring & Observability

### Application Insights
- Workspace-based Application Insights
- 90-day retention in Application Insights
- Integrated with all Function Apps and Static Web App

### Log Analytics
- 2-year retention (730 days)
- Centralized logging for all resources
- KQL queries for analysis
- Export to Blob for long-term retention (5 years)

### Diagnostic Settings
All resources configured with diagnostic settings:
- Metrics → Log Analytics
- Logs → Log Analytics
- Archive → Blob Storage (logs-archive container)

## Cost Optimization

### Development Environment
- Cosmos DB: Serverless mode (free tier eligible)
- Functions: Consumption plan
- Storage: Locally redundant (LRS)
- No private endpoints
- Log retention: 90 days

### Production Environment
- Cosmos DB: Provisioned throughput (zone redundant)
- Functions: Premium plan (VNet integration)
- Storage: Zone redundant (ZRS)
- Private endpoints enabled
- Log retention: 730 days

## Disaster Recovery

### Backup Strategy
- **Cosmos DB**: Continuous backup (7 days)
- **Storage**: Blob versioning + soft delete (30 days)
- **Key Vault**: Soft delete (90 days) + purge protection

### High Availability
- **Production**: Zone-redundant resources
- **Function Apps**: Minimum 2 instances in prod
- **Storage**: ZRS replication

## Post-Deployment Steps

1. **Update Secrets in Key Vault**
   - Zoho OAuth credentials (Client ID, Secret, Refresh Token)
   - Teams App Password

2. **Register Teams App**
   - Create app registration in Azure AD (Tenant B)
   - Configure bot endpoint
   - Enable Teams channel
   - Update app manifest

3. **Deploy Application Code**
   - Build and deploy Function Apps
   - Deploy Static Web App (Teams tab)
   - Configure CI/CD pipelines

4. **Configure Foundry Agent**
   - Link to existing Foundry Hub/Project
   - Deploy agent with tools (parse_excel, validate_order, create_draft, etc.)
   - Configure committee models

5. **Test End-to-End**
   - Upload test Excel file via Teams bot
   - Verify parsing and validation
   - Test committee voting
   - Create draft sales order in Zoho sandbox

## Troubleshooting

### Common Issues

**Issue**: Template validation fails
- **Solution**: Ensure you have the latest Bicep version: `az bicep upgrade`

**Issue**: Private endpoint deployment fails
- **Solution**: Ensure VNet is created first; check subnet configuration

**Issue**: Function App can't access Key Vault
- **Solution**: Verify RBAC assignments; ensure Managed Identity is enabled

**Issue**: Cosmos DB throttling
- **Solution**: Switch from serverless to provisioned mode or increase RU/s

### Diagnostic Commands

```bash
# Check deployment status
az deployment sub show --name <deployment-name>

# View Function App logs
az functionapp log tail --name <function-app-name> --resource-group <rg-name>

# Check RBAC assignments
az role assignment list --assignee <principal-id> --all

# Test Key Vault access
az keyvault secret list --vault-name <key-vault-name>
```

## Maintenance

### Updating Infrastructure

```bash
# Make changes to Bicep templates
# Run what-if analysis
./scripts/deploy.sh prod swedencentral --what-if

# Deploy changes
./scripts/deploy.sh prod swedencentral
```

### Monitoring Costs

```bash
# View resource group costs
az consumption usage list --resource-group <rg-name>

# Set budget alerts (via portal)
```

## References

- [Azure Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [Azure Functions Best Practices](https://learn.microsoft.com/azure/azure-functions/functions-best-practices)
- [Cosmos DB Best Practices](https://learn.microsoft.com/azure/cosmos-db/best-practice-guide)
- [Teams Bot Framework](https://learn.microsoft.com/microsoftteams/platform/bots/what-are-bots)
- [Cross-Tenant Teams Deployment](../../CROSS_TENANT_TEAMS_DEPLOYMENT.md)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review deployment logs in Azure Portal
3. Check Application Insights for runtime errors
4. Consult the solution design docs in `/data/order-processing/`
