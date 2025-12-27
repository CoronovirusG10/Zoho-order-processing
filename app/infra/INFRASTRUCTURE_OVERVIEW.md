# Order Processing Infrastructure Overview

## Summary

This infrastructure deployment creates a complete, production-ready Teams to Excel to AI Committee to Zoho Draft Sales Orders application running on an Azure Virtual Machine in Sweden Central region.

## Architecture Diagram (Text)

**Updated December 2025:** Bot registered in user tenant to avoid cross-tenant authentication issues.

```
+-------------------------------------------------------------------------+
|              PIPPA OF LONDON TENANT (Users + Bot)                        |
|              Tenant ID: 23da91a5-0480-4183-8bc1-d7b6dd33dd2e            |
|                                                                          |
|  +----------------+     +------------------+                             |
|  | Teams Client   |     | Azure Bot        |                             |
|  | (Salespeople)  |<--->| (Single-Tenant)  |---+                         |
|  +----------------+     +------------------+   |                         |
|                                                | Messaging Endpoint:     |
|  +----------------+     +------------------+   | https://pippai-vm.      |
|  | Teams App      |     | App Registration |   | 360innovate.com/        |
|  | (Sideloaded)   |     | (Single-Tenant)  |   | api/messages            |
|  +----------------+     +------------------+   |                         |
+------------------------------------------------|--------------------------+
                                                 |
                                                 v HTTPS
+-------------------------------------------------------------------------+
|              360INNOVATE TENANT (Infrastructure)                         |
|              Tenant ID: 545acd6e-7392-4046-bc3e-d4656b7146dd            |
|                      Sweden Central Region                               |
|                                                                          |
|  +-------------------------------------------------------------------+  |
|  |                   Resource Group: pippai-rg                        |  |
|  |                                                                    |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |              Virtual Machine: pippai-vm-swedencentral         | |  |
|  |  |              Ubuntu 22.04 LTS | Standard_D4s_v3               | |  |
|  |  |              System-Assigned Managed Identity                  | |  |
|  |  |                                                                | |  |
|  |  |  +------------------+  +------------------+  +--------------+  | |  |
|  |  |  |   nginx          |  |   PM2 Process   |  | Application  |  | |  |
|  |  |  | Reverse Proxy    |  |    Manager      |  |   Logs       |  | |  |
|  |  |  | (Port 80/443)    |  |  (Node.js Apps) |  |              |  | |  |
|  |  |  +--------+---------+  +--------+--------+  +--------------+  | |  |
|  |  |           |                     |                              | |  |
|  |  |           v                     v                              | |  |
|  |  |  +------------------+  +-----------------------------------+  | |  |
|  |  |  |  Teams Bot       |  |         Temporal.io Server        |  | |  |
|  |  |  |  Endpoint        |  |  +-------------+ +-------------+  |  | |  |
|  |  |  |  /api/messages   |  |  | Workflow    | | Worker      |  |  | |  |
|  |  |  +------------------+  |  | Orchestrator| | Processes   |  |  | |  |
|  |  |                        |  +-------------+ +-------------+  |  | |  |
|  |  |                        +-----------------------------------+  | |  |
|  |  |                                     |                          | |  |
|  |  |                                     v                          | |  |
|  |  |  +----------------------------------------------------------+ | |  |
|  |  |  |              PostgreSQL (Temporal Persistence)            | | |  |
|  |  |  |  - Workflow execution history                             | | |  |
|  |  |  |  - Activity state and timers                              | | |  |
|  |  |  |  - Visibility data for queries                            | | |  |
|  |  |  +----------------------------------------------------------+ | |  |
|  |  +--------------------------------------------------------------+ |  |
|  |                                                                    |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |                    Storage Account                            | |  |
|  |  |  Containers:                        Queues:                   | |  |
|  |  |  - orders-incoming                  - case-processing         | |  |
|  |  |  - orders-audit (immutable)         - zoho-retry              | |  |
|  |  |  - logs-archive                                               | |  |
|  |  |  - committee-evidence                                         | |  |
|  |  +--------------------------------------------------------------+ |  |
|  |                                                                    |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |                    Cosmos DB (NoSQL)                          | |  |
|  |  |  Containers:                                                  | |  |
|  |  |  - cases (partition: /tenantId)                               | |  |
|  |  |  - fingerprints (partition: /fingerprint)                     | |  |
|  |  |  - events (partition: /caseId)                                | |  |
|  |  |  - agentThreads (partition: /threadId, TTL 30d)               | |  |
|  |  |  - committeeVotes (partition: /caseId)                        | |  |
|  |  +--------------------------------------------------------------+ |  |
|  |                                                                    |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |                      Key Vault                                | |  |
|  |  |  Secrets:                                                     | |  |
|  |  |  - ZohoClientId, ZohoClientSecret, ZohoRefreshToken           | |  |
|  |  |  - TeamsAppId, TeamsAppPassword                               | |  |
|  |  |  - Storage/Cosmos/AppInsights connection strings              | |  |
|  |  |  - PostgreSQL connection credentials                          | |  |
|  |  +--------------------------------------------------------------+ |  |
|  |                                                                    |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |                Log Analytics Workspace                        | |  |
|  |  |  - Application logs (730 day retention)                       | |  |
|  |  |  - VM metrics and diagnostics                                 | |  |
|  |  |  - Export to blob for 5 year retention                        | |  |
|  |  +--------------------------------------------------------------+ |  |
|  |                                                                    |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  External Integrations:                                                  |
|  - Azure AI Foundry (existing Hub/Project)                               |
|  - Zoho Books API (EU DC)                                                |
|  - External AI Providers (Google Gemini, xAI - optional)                 |
|                                                                          |
+--------------------------------------------------------------------------+
```

## VM-Only Architecture

This deployment uses a single Azure Virtual Machine to host all application components, replacing the previous serverless (Azure Functions) and container-based approaches.

### Why VM-Only?

1. **Simplified Operations**: Single deployment target, easier debugging
2. **Cost Predictable**: Fixed monthly cost vs. pay-per-execution variability
3. **Temporal.io Integration**: Native support for durable workflow execution
4. **Local PostgreSQL**: Temporal persistence without Azure Database costs
5. **Full Control**: Direct access to OS, networking, and process management

## Core Components

### Virtual Machine

| Property | Value |
|----------|-------|
| Name | `pippai-vm-swedencentral` |
| SKU | `Standard_D4s_v3` (4 vCPU, 16 GB RAM) |
| OS | Ubuntu 22.04 LTS |
| Identity | System-Assigned Managed Identity |
| Resource Group | `pippai-rg` |
| Region | Sweden Central |

### Temporal.io Server

Temporal provides durable workflow execution with automatic retries, timeouts, and state persistence.

| Component | Description |
|-----------|-------------|
| **Temporal Server** | Core workflow orchestration engine |
| **Workflow Workers** | Execute order processing workflows |
| **Activity Workers** | Run individual activities (parse, validate, submit) |
| **Web UI** | Workflow monitoring and debugging (port 8080) |
| **History Service** | Persists workflow execution history |

**Key Workflows:**
- `OrderProcessingWorkflow` - Main order lifecycle
- `ExcelParsingActivity` - Parse and validate Excel files
- `AICommitteeActivity` - Multi-model voting consensus
- `ZohoSubmissionActivity` - Create draft sales orders

### PostgreSQL (Temporal Persistence)

Local PostgreSQL instance provides persistence for Temporal.io.

| Database | Purpose |
|----------|---------|
| `temporal` | Workflow execution state |
| `temporal_visibility` | Workflow search/query index |

**Configuration:**
- Version: PostgreSQL 14+
- Data directory: `/var/lib/postgresql/data`
- Backup: Daily pg_dump to Azure Blob Storage

### PM2 Process Manager

PM2 manages all Node.js application processes with automatic restarts and monitoring.

| Process | Description | Instances |
|---------|-------------|-----------|
| `temporal-server` | Temporal.io server | 1 |
| `temporal-worker` | Workflow/activity workers | 2 |
| `teams-bot` | Teams bot API endpoint | 2 |
| `web-ui` | Admin dashboard | 1 |

**PM2 Features Used:**
- Cluster mode for multi-instance scaling
- Auto-restart on failure
- Log rotation and management
- Startup script for system boot
- Resource monitoring

**Common Commands:**
```bash
pm2 list                    # Show all processes
pm2 logs                    # Stream all logs
pm2 monit                   # Real-time monitoring
pm2 restart all             # Restart all processes
pm2 save && pm2 startup     # Persist configuration
```

### nginx Reverse Proxy

nginx handles incoming HTTP/HTTPS traffic and routes to backend services.

| Route | Backend | Description |
|-------|---------|-------------|
| `/api/messages` | `localhost:3978` | Teams bot webhook |
| `/temporal` | `localhost:8080` | Temporal Web UI |
| `/health` | `localhost:3000` | Health check endpoint |
| `/` | `localhost:3000` | Admin dashboard |

**Configuration:** `/etc/nginx/sites-available/order-processing`

**SSL/TLS:**
- Certificates managed via Let's Encrypt (certbot)
- Auto-renewal via systemd timer
- TLS 1.2+ enforced

## Networking

### Virtual Network Integration

| Component | Value |
|-----------|-------|
| VNet | `pippai-vnet` |
| Subnet | `default` (10.0.0.0/24) |
| NSG | `pippai-vm-nsg` |
| Public IP | Static, associated with VM |

### Network Security Group Rules

| Priority | Name | Port | Source | Action |
|----------|------|------|--------|--------|
| 100 | AllowHTTPS | 443 | Any | Allow |
| 110 | AllowHTTP | 80 | Any | Allow |
| 120 | AllowSSH | 22 | Admin IPs | Allow |
| 200 | DenyAllInbound | * | Any | Deny |

### DNS

- Custom domain: `order-processing.pippai.com` (A record to VM public IP)
- Azure Private DNS zones for internal service resolution

## Security

### System-Assigned Managed Identity

The VM uses a System-Assigned Managed Identity for Azure service authentication.

| Service | Role | Purpose |
|---------|------|---------|
| Key Vault | Key Vault Secrets User | Read secrets |
| Storage Account | Storage Blob Data Contributor | Read/write blobs |
| Cosmos DB | Cosmos DB Data Contributor | Read/write documents |
| Application Insights | Monitoring Contributor | Write telemetry |

**Benefits:**
- No credential storage on VM
- Automatic token refresh
- Azure AD-based access control
- Audit trail in Azure AD logs

### Key Vault Integration

Secrets are fetched at application startup using Managed Identity:

```javascript
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

const credential = new DefaultAzureCredential();
const client = new SecretClient(vaultUrl, credential);
const secret = await client.getSecret("ZohoClientSecret");
```

### Data Protection

- TLS 1.2+ for all external connections
- Disk encryption (Azure Disk Encryption)
- PostgreSQL data encrypted at rest
- Immutable storage for audit blobs

## Resource Tagging

All resources are tagged for cost tracking and organization.

| Tag | Value |
|-----|-------|
| `Project` | `order-processing` |
| `CostCenter` | `zoho` |
| `Environment` | `dev` or `prod` |
| `ManagedBy` | `bicep` |

## Files Created

### Infrastructure Templates
- `main.bicep` - Main orchestration template
- `main.parameters.dev.json` - Development parameters
- `main.parameters.prod.json` - Production parameters

### Module Templates
1. `modules/vm.bicep` - Virtual Machine with extensions
2. `modules/storage.bicep` - Storage account with containers
3. `modules/cosmos.bicep` - Cosmos DB configuration
4. `modules/keyvault.bicep` - Key Vault with RBAC
5. `modules/appinsights.bicep` - Application Insights
6. `modules/loganalytics.bicep` - Log Analytics workspace
7. `modules/vnet.bicep` - Virtual Network configuration
8. `modules/nsg.bicep` - Network Security Group rules
9. `modules/rbac.bicep` - Role assignments for Managed Identity

### Configuration Scripts
1. `scripts/vm-setup.sh` - VM initialization (nginx, PM2, PostgreSQL)
2. `scripts/temporal-install.sh` - Temporal.io installation
3. `scripts/deploy-app.sh` - Application deployment
4. `scripts/backup-postgres.sh` - PostgreSQL backup to blob

### Documentation
1. `README.md` - Deployment guide
2. `DEPLOYMENT_CHECKLIST.md` - Step-by-step checklist
3. `INFRASTRUCTURE_OVERVIEW.md` - This file

## Resource Naming Convention

| Resource Type | Naming Pattern | Example |
|--------------|----------------|---------|
| Resource Group | `pippai-rg` | `pippai-rg` |
| Virtual Machine | `pippai-vm-{region}` | `pippai-vm-swedencentral` |
| Storage Account | `orderstor{unique6}` | `orderstorabc123` |
| Cosmos DB | `order-processing-{env}-cosmos` | `order-processing-dev-cosmos` |
| Key Vault | `pippai-keyvault-{env}` | `pippai-keyvault-dev` |
| Log Analytics | `order-processing-{env}-logs` | `order-processing-dev-logs` |
| App Insights | `order-processing-{env}-ai` | `order-processing-dev-ai` |
| VNet | `pippai-vnet` | `pippai-vnet` |
| NSG | `pippai-vm-nsg` | `pippai-vm-nsg` |

## Cost Optimization

### VM-Only Costs

| Resource | Monthly Cost (Est.) |
|----------|---------------------|
| VM (Standard_D4s_v3) | $140-160 |
| Managed Disk (128 GB) | $10 |
| Public IP | $4 |
| Bandwidth (50 GB) | $5 |
| Storage Account | $10-30 |
| Cosmos DB (Serverless) | $10-50 |
| Key Vault | $1 |
| Log Analytics | $10-30 |
| **Total** | **$190-290/month** |

### Cost Savings vs. Serverless

| Architecture | Monthly Cost | Complexity |
|--------------|--------------|------------|
| Azure Functions + Container Apps | $500-1500 | High |
| VM-Only (this approach) | $190-290 | Low |
| **Savings** | **60-80%** | Simplified |

### Additional Savings Tips

1. **Reserved Instance**: 1-year reservation saves 30-40%
2. **Auto-shutdown**: Schedule VM shutdown for non-business hours (dev)
3. **Right-sizing**: Monitor CPU/memory and adjust VM SKU
4. **Blob lifecycle**: Archive old audit data to cool/archive tier

## Deployment Time

| Phase | Time | Notes |
|-------|------|-------|
| VM Provisioning | 5-10 min | Including extensions |
| Software Setup | 10-15 min | nginx, PM2, PostgreSQL, Temporal |
| Application Deploy | 5-10 min | Code and configuration |
| DNS Propagation | 5-30 min | External DNS updates |
| **Total** | **25-65 min** | First-time deployment |

Subsequent deployments: 5-10 minutes (application updates only).

## Dependencies

### External Services
1. **Azure AI Foundry**: Existing Hub and Project
2. **Zoho Books**: Active account in EU datacenter with OAuth app
3. **Teams**: Tenant B with app registration permissions

### Azure Services (Sweden Central)
- Virtual Machine (pippai-rg)
- Storage Account
- Cosmos DB
- Key Vault
- Application Insights
- Log Analytics
- Virtual Network

## Monitoring & Observability

### Application Insights

- Distributed tracing for all requests
- Custom metrics for workflow execution
- Dependency tracking (Cosmos, Storage, Zoho)
- Live metrics stream

### Log Analytics Queries

```kusto
// VM performance metrics
Perf
| where Computer == "pippai-vm-swedencentral"
| where CounterName in ("% Processor Time", "Available MBytes")
| summarize avg(CounterValue) by CounterName, bin(TimeGenerated, 5m)

// Application errors
AppTraces
| where SeverityLevel >= 3
| order by TimeGenerated desc
| take 100

// Temporal workflow execution
customEvents
| where name == "WorkflowCompleted"
| summarize count() by bin(timestamp, 1h)
```

### Alerting

| Alert | Condition | Action |
|-------|-----------|--------|
| VM Down | Heartbeat missing > 5 min | Email, SMS |
| High CPU | CPU > 80% for 10 min | Email |
| Disk Full | Disk > 90% | Email |
| Workflow Failures | > 5 failures/hour | Email |

## Troubleshooting Guide

### Common Issues

**Issue**: VM not responding
- **Cause**: Service crash or network issue
- **Solution**: Check Azure portal, restart VM, review boot diagnostics

**Issue**: Temporal workflows stuck
- **Cause**: PostgreSQL connection or worker crash
- **Solution**: `pm2 restart temporal-worker`, check PostgreSQL logs

**Issue**: Teams bot not responding
- **Cause**: nginx misconfiguration or bot process down
- **Solution**: Check nginx logs, `pm2 logs teams-bot`

**Issue**: Cannot authenticate to Azure services
- **Cause**: Managed Identity not assigned roles
- **Solution**: Verify RBAC assignments in Azure portal

### Diagnostic Commands

```bash
# SSH to VM
ssh azureuser@<vm-public-ip>

# Check all services
pm2 list
systemctl status nginx
systemctl status postgresql

# View application logs
pm2 logs --lines 100

# Check Temporal server
curl http://localhost:8080/health

# Test managed identity
curl -H "Metadata: true" "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2019-08-01&resource=https://vault.azure.net"

# PostgreSQL status
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname = 'temporal';"
```

## Maintenance

### Regular Tasks

- [ ] Review PM2 logs for errors (daily)
- [ ] Check disk space usage (weekly)
- [ ] Review Application Insights for trends (weekly)
- [ ] Verify PostgreSQL backups (weekly)
- [ ] Update OS packages (monthly)
- [ ] Rotate secrets (quarterly)
- [ ] Test disaster recovery (annually)

### Backup Strategy

| Data | Method | Frequency | Retention |
|------|--------|-----------|-----------|
| PostgreSQL | pg_dump to Blob | Daily | 30 days |
| Application Code | Git + deployment script | On deploy | Git history |
| Configuration | Git + Key Vault | On change | Versioned |
| Audit Blobs | Immutable storage | N/A | 5 years |

### Updates

1. **OS Updates**: `sudo apt update && sudo apt upgrade`
2. **Node.js Updates**: Use nvm for version management
3. **Temporal Updates**: Follow Temporal upgrade guide
4. **Application Updates**: `git pull && pm2 reload all`

## Next Steps After Deployment

1. **Verify VM Access** - SSH and confirm all services running
2. **Configure DNS** - Point domain to VM public IP
3. **Setup SSL** - Run certbot for Let's Encrypt certificates
4. **Configure Secrets** - Populate Key Vault via portal or CLI
5. **Deploy Application** - Run deployment script
6. **Register Teams App** - Create app registration in Tenant B
7. **Test End-to-End** - Upload Excel file and verify workflow
8. **Setup Monitoring** - Configure alerts in Application Insights

## Support and Resources

- **Azure VM Documentation**: https://learn.microsoft.com/azure/virtual-machines/
- **Temporal.io Documentation**: https://docs.temporal.io/
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/
- **nginx Documentation**: https://nginx.org/en/docs/
- **Zoho Books API**: https://www.zoho.com/books/api/v3/
- **Solution Design**: `/data/order-processing/SOLUTION_DESIGN.md`

---

**Version**: 2.0.0
**Last Updated**: 2025-12-26
**Architecture**: VM-Only (Temporal.io + PM2)
**Target Region**: Sweden Central
**Resource Group**: pippai-rg
