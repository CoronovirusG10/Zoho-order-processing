# Order Processing Infrastructure Overview

## Summary

This infrastructure deployment creates a complete, production-ready Teams → Excel → AI Committee → Zoho Draft Sales Orders application in Azure Sweden Central region.

## Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TENANT B (Teams Users)                      │
│  ┌──────────────┐                                                    │
│  │ Teams Client │──────────────────────┐                             │
│  └──────────────┘                      │                             │
└────────────────────────────────────────┼─────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TENANT A (Azure Hosting)                          │
│                      Sweden Central Region                           │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      Resource Group                             │  │
│  │                order-processing-{env}-rg                        │  │
│  │                                                                 │  │
│  │  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │  │
│  │  │  Azure Bot   │      │ Static Web   │      │ Application  │ │  │
│  │  │   Service    │      │     App      │      │  Insights    │ │  │
│  │  │   (Teams)    │      │ (React Tab)  │      │              │ │  │
│  │  └──────┬───────┘      └──────────────┘      └──────────────┘ │  │
│  │         │                                                       │  │
│  │         ▼                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │           Function Apps (Python 3.11)                     │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │ │  │
│  │  │  │ Workflow   │  │  Parser    │  │   Zoho     │         │ │  │
│  │  │  │Orchestrator│  │ Validator  │  │   Client   │         │ │  │
│  │  │  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘         │ │  │
│  │  └─────────┼────────────────┼────────────────┼──────────────┘ │  │
│  │            │                │                │                 │  │
│  │            ▼                ▼                ▼                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │                Storage Account                            │ │  │
│  │  │  Containers:                        Queues:              │ │  │
│  │  │  • orders-incoming                  • case-processing    │ │  │
│  │  │  • orders-audit (immutable)         • zoho-retry        │ │  │
│  │  │  • logs-archive                                          │ │  │
│  │  │  • committee-evidence                                    │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  │                                                                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │                  Cosmos DB (NoSQL)                        │ │  │
│  │  │  Containers:                                              │ │  │
│  │  │  • cases (partition: /tenantId)                          │ │  │
│  │  │  • fingerprints (partition: /fingerprint)                │ │  │
│  │  │  • events (partition: /caseId)                           │ │  │
│  │  │  • agentThreads (partition: /threadId, TTL 30d)          │ │  │
│  │  │  • committeeVotes (partition: /caseId)                   │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  │                                                                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │                    Key Vault                              │ │  │
│  │  │  Secrets:                                                 │ │  │
│  │  │  • ZohoClientId, ZohoClientSecret, ZohoRefreshToken      │ │  │
│  │  │  • TeamsAppId, TeamsAppPassword                          │ │  │
│  │  │  • Storage/Cosmos/AppInsights connection strings         │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  │                                                                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │              Log Analytics Workspace                      │ │  │
│  │  │  • Application logs (730 day retention)                  │ │  │
│  │  │  • Metrics and traces                                    │ │  │
│  │  │  • Export to blob for 5 year retention                   │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  │                                                                 │  │
│  │  [Optional: VNet + Private Endpoints for Production]           │  │
│  │                                                                 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  External Integrations:                                              │
│  • Azure AI Foundry (existing Hub/Project)                          │
│  • Zoho Books API (EU DC)                                           │
│  • External AI Providers (Google Gemini, xAI - optional)            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Files Created

### Main Templates
- `main.bicep` - Main orchestration template (subscription-level deployment)
- `main.parameters.dev.json` - Development environment parameters
- `main.parameters.prod.json` - Production environment parameters

### Module Templates (12 modules)
1. `modules/storage.bicep` - Storage account with containers, queues, lifecycle policies
2. `modules/cosmos.bicep` - Cosmos DB with 5 containers and backup policy
3. `modules/keyvault.bicep` - Key Vault with RBAC authorization
4. `modules/appinsights.bicep` - Application Insights (workspace-based)
5. `modules/loganalytics.bicep` - Log Analytics workspace with solutions
6. `modules/bot.bicep` - Azure Bot Service with Teams channel
7. `modules/functionapp.bicep` - Function App template (reusable for 3 apps)
8. `modules/staticwebapp.bicep` - Static Web App for Teams tab
9. `modules/containerapp.bicep` - Container App for bot runtime (prod)
10. `modules/vnet.bicep` - Virtual Network with subnets for private endpoints
11. `modules/secrets.bicep` - Key Vault secrets population
12. `modules/rbac.bicep` - RBAC role assignments for managed identities

### Scripts
1. `scripts/deploy.sh` - Bash deployment script with validation
2. `scripts/deploy.ps1` - PowerShell deployment script
3. `scripts/setup-secrets.sh` - Interactive secrets configuration
4. `scripts/validate.sh` - Post-deployment validation

### Documentation
1. `README.md` - Comprehensive deployment guide
2. `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment checklist
3. `INFRASTRUCTURE_OVERVIEW.md` - This file

### Configuration
1. `.bicepconfig.json` - Bicep linting and analyzer rules

## Resource Naming Convention

| Resource Type | Naming Pattern | Example (dev) |
|--------------|----------------|---------------|
| Resource Group | `order-processing-{env}-rg` | `order-processing-dev-rg` |
| Storage Account | `orderstor{unique6}` | `orderstorabc123` |
| Cosmos DB | `order-processing-{env}-cosmos` | `order-processing-dev-cosmos` |
| Key Vault | `orderkv{unique6}` | `orderkvabc123` |
| Function App | `order-{function}-{env}-func` | `order-workflow-dev-func` |
| Bot Service | `order-processing-{env}-bot` | `order-processing-dev-bot` |
| Static Web App | `order-processing-{env}-swa` | `order-processing-dev-swa` |
| Log Analytics | `order-processing-{env}-logs` | `order-processing-dev-logs` |
| App Insights | `order-processing-{env}-ai` | `order-processing-dev-ai` |

## Key Features

### Security
- **Managed Identity**: All services use system-assigned managed identities
- **RBAC**: Role-based access control (no connection string access)
- **Key Vault**: Centralized secrets management with audit logging
- **Private Endpoints**: Storage, Cosmos, Key Vault (production only)
- **TLS 1.2**: Enforced minimum TLS version
- **Immutable Storage**: Audit container with WORM policy
- **Soft Delete**: 30-90 day retention for accidental deletions

### Compliance & Audit
- **5-Year Retention**: All audit artifacts stored for minimum 5 years
- **Lifecycle Management**: Hot → Cool → Archive → Delete
- **Diagnostic Settings**: All resources log to Log Analytics
- **Change Feed**: Blob change tracking (90 days)
- **Continuous Backup**: Cosmos DB point-in-time restore (7 days)
- **Idempotency**: Fingerprint-based duplicate prevention

### High Availability (Production)
- **Zone Redundancy**: Cosmos DB and Storage in prod
- **Multi-Instance**: Function Apps with minimum 2 instances
- **Auto-Scaling**: Elastic scaling for Function Apps and Container Apps
- **Health Probes**: Liveness and readiness checks

### Monitoring & Observability
- **Application Insights**: Full distributed tracing
- **Log Analytics**: 730-day retention with KQL queries
- **Metrics**: Real-time metrics for all resources
- **Alerts**: Configurable alerts for failures and thresholds
- **Dashboards**: Azure Monitor workbooks support

## Cost Optimization

### Development Environment
- Cosmos DB: Serverless (pay per request)
- Functions: Consumption plan (pay per execution)
- Storage: LRS (locally redundant)
- No private endpoints
- Reduced log retention (90 days)
- **Estimated Monthly Cost**: $50-150 (low usage)

### Production Environment
- Cosmos DB: Provisioned (dedicated capacity)
- Functions: Premium plan (always-on, VNet)
- Storage: ZRS (zone redundant)
- Private endpoints enabled
- Full log retention (730 days)
- **Estimated Monthly Cost**: $500-1500 (moderate usage, 100-200 orders/day)

### Cost Savings Tips
1. Use serverless Cosmos DB for dev/test
2. Enable Cosmos DB free tier for dev
3. Use Consumption plan for low-volume scenarios
4. Configure lifecycle policies to archive old data
5. Set daily quota on Log Analytics workspace
6. Review and delete unused resources regularly

## Deployment Time

| Phase | Time | Notes |
|-------|------|-------|
| Validation | 1-2 min | Template validation and what-if |
| Infrastructure | 15-25 min | All Azure resources |
| RBAC Propagation | 5-10 min | Role assignments to take effect |
| Secrets Setup | 5 min | Manual secret configuration |
| Code Deployment | 10-15 min | Function Apps and Static Web App |
| **Total** | **35-55 min** | First-time deployment |

Subsequent deployments are faster (5-10 minutes) as only changed resources are updated.

## Dependencies

### External Services
1. **Azure AI Foundry**: Existing Hub and Project (referenced by resource ID)
2. **Zoho Books**: Active account in EU datacenter with OAuth app
3. **Teams**: Tenant B with app registration permissions

### Azure Services (all in Sweden Central)
- Storage Account
- Cosmos DB
- Key Vault
- Function Apps (Python 3.11)
- Bot Service
- Static Web App
- Application Insights
- Log Analytics
- (Optional) Container Apps
- (Optional) Virtual Network

## Security Considerations

### Secrets Management
- Never commit secrets to source control
- Use Key Vault for all secrets
- Use parameter files only for non-sensitive configuration
- Rotate secrets regularly (Zoho refresh token, Teams app secret)

### Network Security
- Enable private endpoints for production
- Use VNet integration for Function Apps in production
- Configure NSG rules appropriately
- Disable public access when using private endpoints

### Access Control
- Use managed identities for all Azure service-to-service auth
- Enable RBAC on Key Vault (not access policies)
- Follow principle of least privilege
- Regularly review RBAC assignments

### Data Protection
- Enable immutable storage for audit trail
- Configure lifecycle policies for data retention
- Use encryption at rest (default for all services)
- Enable soft delete on Key Vault (90 days)
- Configure Cosmos DB backup retention

## Testing Strategy

### Unit Tests
- Bicep template syntax validation
- Parameter file schema validation
- Resource naming convention checks

### Integration Tests
1. Deploy to dev environment
2. Validate all resources created
3. Check RBAC assignments
4. Verify Key Vault access
5. Test Function App connectivity to dependencies

### End-to-End Tests
1. Upload Excel file via Teams bot
2. Verify blob storage upload
3. Check Cosmos DB case record
4. Test parser function execution
5. Verify audit bundle creation
6. Test Zoho API integration (sandbox)

## Troubleshooting Guide

### Common Issues

**Issue**: Deployment fails with "conflict" error
- **Cause**: Resource already exists or name collision
- **Solution**: Delete existing resource or change uniqueSuffix

**Issue**: Function App can't access Key Vault
- **Cause**: RBAC assignments not propagated yet
- **Solution**: Wait 5-10 minutes for RBAC to propagate

**Issue**: Private endpoint DNS resolution fails
- **Cause**: DNS not configured correctly
- **Solution**: Use Azure Private DNS zones (auto-configured in template)

**Issue**: Cosmos DB throttling (429 errors)
- **Cause**: Exceeded RU/s in serverless mode
- **Solution**: Switch to provisioned mode or increase RU/s

**Issue**: Storage lifecycle policy not working
- **Cause**: Policy syntax error or timing
- **Solution**: Verify policy JSON and wait 24 hours for first run

### Diagnostic Commands

```bash
# Check deployment status
az deployment sub show --name <deployment-name> --query properties.provisioningState

# View deployment errors
az deployment sub show --name <deployment-name> --query properties.error

# List resources in group
az resource list --resource-group order-processing-<env>-rg --output table

# Check Function App logs
az functionapp log tail --name <function-name> --resource-group <rg-name>

# Test Key Vault access
az keyvault secret list --vault-name <kv-name>

# Check RBAC assignments
az role assignment list --assignee <principal-id> --all
```

## Maintenance

### Regular Tasks
- [ ] Review Application Insights for errors (weekly)
- [ ] Check Cosmos DB RU consumption (weekly)
- [ ] Verify backup retention policies (monthly)
- [ ] Review storage costs and lifecycle (monthly)
- [ ] Rotate secrets (quarterly)
- [ ] Update Function App runtime (quarterly)
- [ ] Review RBAC assignments (quarterly)
- [ ] Test disaster recovery (annually)

### Updates
- Keep Bicep templates in version control
- Use semantic versioning for template releases
- Test updates in dev before prod
- Document all infrastructure changes
- Use what-if analysis before production deployments

## Next Steps After Deployment

1. **Configure Secrets** - Run `scripts/setup-secrets.sh`
2. **Deploy Application Code** - Build and deploy Function Apps
3. **Register Teams App** - Create app registration in Tenant B
4. **Configure Foundry** - Link to Hub/Project and deploy agent
5. **Test End-to-End** - Upload Excel file and create draft order
6. **Setup Monitoring** - Configure alerts and dashboards
7. **Document Runbooks** - Create operational procedures
8. **Train Team** - Onboard operations and support staff

## Support and Resources

- **Azure Documentation**: https://learn.microsoft.com/azure/
- **Bicep Documentation**: https://learn.microsoft.com/azure/azure-resource-manager/bicep/
- **Teams Platform**: https://learn.microsoft.com/microsoftteams/platform/
- **Zoho Books API**: https://www.zoho.com/books/api/v3/
- **Solution Design**: `/data/order-processing/SOLUTION_DESIGN.md`
- **MVP Guide**: `/data/order-processing/MVP_AND_HOWTO.md`

---

**Version**: 1.0.0
**Last Updated**: 2025-12-25
**Target Region**: Sweden Central
**Terraform Alternative**: Not provided (Bicep only)
