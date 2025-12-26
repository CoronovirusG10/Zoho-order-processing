# Order Processing Infrastructure as Code (Bicep)

This directory contains Bicep templates for deploying the Order Processing application infrastructure to Azure (Sweden Central).

## Architecture Overview

The infrastructure deploys a complete Teams -> Excel -> AI Committee -> Zoho Draft Sales Orders application using a **VM-only architecture** with the following components:

### Core Infrastructure
- **Resource Group**: `pippai-rg` - Logical container for all resources
- **Storage Account**: Blob storage for orders, audit trails, and logs
- **Cosmos DB**: NoSQL database for case state, fingerprints, events, and agent threads
- **Key Vault**: Secure storage for secrets and credentials
- **Application Insights**: Application performance monitoring
- **Log Analytics Workspace**: Centralized logging and analytics

### Compute (VM-Only Architecture)
- **Virtual Machine**: Ubuntu 22.04 LTS running all application services
  - Node.js 20 LTS application runtime
  - PM2 process manager for service orchestration
  - Nginx reverse proxy
  - Docker containers for supporting services
- **PostgreSQL**: Runs in Docker container on the VM for Temporal workflow state
- **Azure Bot Service**: Teams bot integration (messaging endpoint points to VM)
- **Static Web App**: Teams personal tab UI

### Networking
- **Virtual Network**: Private network for secure communication
- **Network Interface**: VM connectivity with accelerated networking
- **Private Endpoints** (prod only): Secure access to Storage, Cosmos DB, and Key Vault

## Directory Structure

```
infra/
├── main.bicep                      # Main orchestration template
├── deploy.sh                       # Deployment script
├── parameters.dev.json             # Development environment parameters
├── parameters.prod.json            # Production environment parameters
├── README.md                       # This file
├── modules/
│   ├── vm.bicep                   # Virtual Machine (primary compute)
│   ├── appinsights.bicep          # Application Insights
│   ├── bot.bicep                  # Azure Bot Service
│   ├── cosmos.bicep               # Cosmos DB
│   ├── keyvault.bicep             # Key Vault
│   ├── loganalytics.bicep         # Log Analytics
│   ├── rbac.bicep                 # RBAC assignments for VM Managed Identity
│   ├── secrets.bicep              # Key Vault secrets
│   ├── staticwebapp.bicep         # Static Web App
│   ├── storage.bicep              # Storage Account
│   └── vnet.bicep                 # Virtual Network
└── scripts/
    └── cloud-init.yaml            # VM initialization script
```

## VM Module (`modules/vm.bicep`)

The VM module provisions an Ubuntu 22.04 LTS virtual machine with:

### Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `vmName` | Name of the virtual machine | (required) |
| `vmSize` | VM size SKU | `Standard_D4s_v5` |
| `subnetId` | Subnet resource ID for the VM | (required) |
| `adminUsername` | Admin username | `azureuser` |
| `sshPublicKey` | SSH public key for authentication | (required) |
| `environment` | Environment (dev/staging/prod) | `dev` |
| `logAnalyticsWorkspaceId` | Log Analytics Workspace ID | (optional) |

### Available VM Sizes

- `Standard_D4s_v5` - 4 vCPU, 16 GB RAM (default)
- `Standard_D8s_v5` - 8 vCPU, 32 GB RAM
- `Standard_E4s_v5` - 4 vCPU, 32 GB RAM (memory-optimized)
- `Standard_E8s_v5` - 8 vCPU, 64 GB RAM (memory-optimized)

### Features

- System-assigned Managed Identity for Azure resource access
- Premium SSD OS disk (256 GB)
- Accelerated networking enabled
- Azure Monitor Agent extension for diagnostics
- Cloud-init for automated provisioning

### Outputs

- `vmId` - VM resource ID
- `vmName` - VM name
- `principalId` - Managed Identity principal ID (for RBAC)
- `privateIpAddress` - VM private IP address

## Cloud-Init Configuration (`scripts/cloud-init.yaml`)

The cloud-init script automatically provisions the VM with:

### Installed Packages
- `docker.io` and `docker-compose` - Container runtime
- `nginx` - Reverse proxy
- `certbot` and `python3-certbot-nginx` - TLS certificate management
- `jq`, `curl`, `git` - Utilities
- Node.js 20 LTS - Application runtime
- PM2 - Process manager

### Directory Structure Created
```
/opt/order-processing/          # Application code
/opt/temporal/postgres-data/    # PostgreSQL data volume
```

### Services Configured
- Docker daemon enabled and started
- Nginx enabled for reverse proxy
- PM2 configured to start on boot

## Prerequisites

1. **Azure CLI**: Install from https://aka.ms/azure-cli
2. **Bicep**: Installed automatically by scripts or run `az bicep install`
3. **Azure Subscription**: Active subscription with appropriate permissions
4. **Permissions**: Contributor or Owner role on the subscription
5. **SSH Key Pair**: Generate with `ssh-keygen -t rsa -b 4096`

## Deployment

### Using Bash (Linux/macOS/WSL)

```bash
# Make script executable
chmod +x deploy.sh

# Deploy to development
./deploy.sh pippai-rg dev

# Deploy to production
./deploy.sh pippai-rg prod

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

### VM-Specific Deployment

```bash
# Deploy VM module directly to existing resource group
az deployment group create \
  --resource-group pippai-rg \
  --template-file modules/vm.bicep \
  --parameters vmName=order-processing-vm \
               subnetId=/subscriptions/{sub}/resourceGroups/pippai-rg/providers/Microsoft.Network/virtualNetworks/{vnet}/subnets/{subnet} \
               sshPublicKey="$(cat ~/.ssh/id_rsa.pub)" \
               environment=dev
```

## Parameters

### Required Parameters

Update the parameter files (`parameters.<env>.json`) with your values:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `environment` | Environment name | `dev`, `test`, `prod` |
| `location` | Azure region | `swedencentral` |
| `sshPublicKey` | SSH public key for VM access | `ssh-rsa AAAA...` |
| `teamsAppId` | Teams App ID (Microsoft App ID) | `00000000-0000-0000-0000-000000000000` |
| `teamsAppTenantId` | Teams Tenant ID (Tenant B) | `00000000-0000-0000-0000-000000000000` |

### Optional Parameters

| Parameter | Description | Default | Notes |
|-----------|-------------|---------|-------|
| `vmSize` | VM size SKU | `Standard_D4s_v5` | Increase for higher workloads |
| `cosmosThroughputMode` | Cosmos DB mode | `serverless` | Use `provisioned` for prod |
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

# AI Provider API Keys (for committee voting)
az keyvault secret set --vault-name <key-vault-name> --name OpenAiApiKey --value '<your-value>'
az keyvault secret set --vault-name <key-vault-name> --name AnthropicApiKey --value '<your-value>'
az keyvault secret set --vault-name <key-vault-name> --name GoogleAiApiKey --value '<your-value>'
```

## Deployed Resources

### Resource Group: `pippai-rg`

All resources are deployed to the `pippai-rg` resource group in Sweden Central.

### Virtual Machine
- **Name**: `order-processing-{env}-vm`
- **OS**: Ubuntu 22.04 LTS (Gen2)
- **Identity**: System-assigned Managed Identity
- **Disk**: 256 GB Premium SSD
- **Network**: Accelerated networking enabled

### PostgreSQL (Docker Container on VM)
- **Purpose**: Temporal workflow state storage
- **Data Volume**: `/opt/temporal/postgres-data`
- **Port**: 5432 (internal only)
- **Persistence**: Docker volume mounted to host

### Storage Account
- **Containers**:
  - `orders-incoming`: Raw uploaded Excel files
  - `orders-audit`: Immutable audit bundles (canonical JSON, evidence)
  - `logs-archive`: Exported diagnostic logs
  - `committee-evidence`: ML committee voting results
- **Queues**:
  - `case-processing`: Case workflow queue
  - `zoho-retry`: Retry queue for Zoho API failures
- **Lifecycle**: Hot -> Cool (30d) -> Archive (365d) -> Delete (5 years)

### Cosmos DB
- **Database**: `order-processing`
- **Containers**:
  - `cases` (partition: `/tenantId`) - Case state and metadata
  - `fingerprints` (partition: `/fingerprint`) - Idempotency tracking
  - `events` (partition: `/caseId`) - Audit event log
  - `agentThreads` (partition: `/threadId`) - Foundry agent state (30d TTL)
  - `committeeVotes` (partition: `/caseId`) - Committee voting results

### Key Vault
- **Purpose**: Secure storage for all secrets and API keys
- **Secrets Stored**:
  - Zoho OAuth credentials
  - Teams App credentials
  - AI provider API keys
  - Connection strings (if needed)

## RBAC Assignments

The VM's Managed Identity is granted the following roles:

| Service | Role | Purpose |
|---------|------|---------|
| Storage Account | Storage Blob Data Contributor | Read/write blobs |
| Storage Account | Storage Queue Data Contributor | Read/write queue messages |
| Cosmos DB | Cosmos DB Data Contributor | Read/write documents |
| Key Vault | Key Vault Secrets User | Read secrets |

### Updating RBAC Module for VM

The `modules/rbac.bicep` should be updated to accept VM principal ID:

```bicep
@description('VM principal ID')
param vmPrincipalId string

// VM Storage RBAC
resource storageVmBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, vmPrincipalId, storageBlobDataContributor)
  scope: storageAccount
  properties: {
    roleDefinitionId: storageBlobDataContributor
    principalId: vmPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Similar assignments for Queue, Cosmos DB, and Key Vault...
```

## Security Features

### Authentication & Authorization
- **Managed Identity**: VM uses system-assigned managed identity
- **RBAC**: Role-based access control instead of connection strings
- **Key Vault**: All secrets stored in Key Vault with audit logging
- **SSH Key Authentication**: Password authentication disabled

### Network Security
- **TLS 1.2**: Enforced minimum TLS version
- **HTTPS Only**: All endpoints require HTTPS (via Nginx + Certbot)
- **Private Endpoints** (prod): Storage, Cosmos DB, Key Vault
- **VNet Integration**: VM deployed in private subnet
- **No Public IP**: VM accessible only via VNet or bastion (recommended)

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
- Integrated with VM via Node.js SDK

### Log Analytics
- 2-year retention (730 days)
- Centralized logging for all resources
- KQL queries for analysis
- Export to Blob for long-term retention (5 years)

### VM Diagnostics
- Azure Monitor Agent installed via cloud-init
- Boot diagnostics enabled
- Custom metrics from PM2 process manager

### Diagnostic Settings
All resources configured with diagnostic settings:
- Metrics -> Log Analytics
- Logs -> Log Analytics
- Archive -> Blob Storage (logs-archive container)

## Cost Optimization

### Development Environment
- VM: Standard_D4s_v5 (4 vCPU, 16 GB RAM)
- Cosmos DB: Serverless mode (free tier eligible)
- Storage: Locally redundant (LRS)
- No private endpoints
- Log retention: 90 days

### Production Environment
- VM: Standard_D8s_v5 or E-series (memory optimized)
- Cosmos DB: Provisioned throughput (zone redundant)
- Storage: Zone redundant (ZRS)
- Private endpoints enabled
- Log retention: 730 days

### Cost Comparison: VM vs Functions

| Component | VM-Only | Functions (Previous) |
|-----------|---------|---------------------|
| Compute | ~$120/month (D4s_v5) | ~$150-300/month (Premium) |
| PostgreSQL | Included (Docker) | N/A |
| Flexibility | Full control | Limited |
| Cold starts | None | 1-10 seconds |

## Disaster Recovery

### Backup Strategy
- **VM**: Azure Backup (optional, configure separately)
- **PostgreSQL**: Daily pg_dump to blob storage (configure in cron)
- **Cosmos DB**: Continuous backup (7 days)
- **Storage**: Blob versioning + soft delete (30 days)
- **Key Vault**: Soft delete (90 days) + purge protection

### High Availability
- **Production**: Zone-redundant storage
- **VM**: Consider Availability Zone or VM Scale Set for HA
- **PostgreSQL**: Consider Azure Database for PostgreSQL for prod HA

## Post-Deployment Steps

1. **Verify VM Provisioning**
   ```bash
   # Check cloud-init status
   ssh azureuser@<vm-ip> 'sudo cloud-init status --wait'

   # Verify services
   ssh azureuser@<vm-ip> 'docker ps && pm2 list'
   ```

2. **Update Secrets in Key Vault**
   - Zoho OAuth credentials (Client ID, Secret, Refresh Token)
   - Teams App Password
   - AI provider API keys

3. **Deploy Application Code**
   ```bash
   # SCP or git clone to VM
   scp -r ./app azureuser@<vm-ip>:/opt/order-processing/

   # Start application
   ssh azureuser@<vm-ip> 'cd /opt/order-processing && npm install && pm2 start ecosystem.config.js'
   ```

4. **Configure PostgreSQL**
   ```bash
   # Start PostgreSQL container
   ssh azureuser@<vm-ip> 'docker-compose -f /opt/order-processing/docker-compose.yml up -d postgres'
   ```

5. **Register Teams App**
   - Create app registration in Azure AD (Tenant B)
   - Configure bot endpoint to point to VM
   - Enable Teams channel
   - Update app manifest

6. **Configure TLS Certificates**
   ```bash
   # Run certbot on VM
   ssh azureuser@<vm-ip> 'sudo certbot --nginx -d order-processing.yourdomain.com'
   ```

7. **Test End-to-End**
   - Upload test Excel file via Teams bot
   - Verify parsing and validation
   - Test committee voting
   - Create draft sales order in Zoho sandbox

## Troubleshooting

### Common Issues

**Issue**: Cloud-init fails to complete
- **Solution**: Check `/var/log/cloud-init-output.log` on the VM

**Issue**: Docker not running
- **Solution**: `sudo systemctl start docker && sudo systemctl enable docker`

**Issue**: PostgreSQL container fails to start
- **Solution**: Check permissions on `/opt/temporal/postgres-data`

**Issue**: VM can't access Key Vault
- **Solution**: Verify RBAC assignments; ensure Managed Identity is enabled

**Issue**: Cosmos DB throttling
- **Solution**: Switch from serverless to provisioned mode or increase RU/s

### Diagnostic Commands

```bash
# Check deployment status
az deployment sub show --name <deployment-name>

# View VM boot diagnostics
az vm boot-diagnostics get-boot-log --name <vm-name> --resource-group pippai-rg

# Check RBAC assignments
az role assignment list --assignee <principal-id> --all

# Test Key Vault access from VM
az keyvault secret list --vault-name <key-vault-name>

# Check PM2 logs
ssh azureuser@<vm-ip> 'pm2 logs'

# Check Docker containers
ssh azureuser@<vm-ip> 'docker ps -a && docker logs postgres'
```

## Maintenance

### Updating Infrastructure

```bash
# Make changes to Bicep templates
# Run what-if analysis
./deploy.sh whatif

# Deploy changes
./deploy.sh pippai-rg prod
```

### VM Updates

```bash
# SSH to VM and update packages
ssh azureuser@<vm-ip> 'sudo apt update && sudo apt upgrade -y'

# Update Node.js application
ssh azureuser@<vm-ip> 'cd /opt/order-processing && git pull && npm install && pm2 reload all'
```

### PostgreSQL Maintenance

```bash
# Backup PostgreSQL
ssh azureuser@<vm-ip> 'docker exec postgres pg_dump -U postgres temporal > /tmp/temporal_backup.sql'

# Copy backup to blob storage
az storage blob upload --account-name <storage> --container-name logs-archive --file temporal_backup.sql
```

### Monitoring Costs

```bash
# View resource group costs
az consumption usage list --resource-group pippai-rg

# Set budget alerts (via portal)
```

## References

- [Azure Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [Azure Virtual Machines Best Practices](https://learn.microsoft.com/azure/virtual-machines/linux/best-practices)
- [Cloud-init Documentation](https://cloudinit.readthedocs.io/)
- [Cosmos DB Best Practices](https://learn.microsoft.com/azure/cosmos-db/best-practice-guide)
- [Teams Bot Framework](https://learn.microsoft.com/microsoftteams/platform/bots/what-are-bots)
- [Cross-Tenant Teams Deployment](../../CROSS_TENANT_TEAMS_DEPLOYMENT.md)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review deployment logs in Azure Portal
3. Check Application Insights for runtime errors
4. SSH to VM and check PM2/Docker logs
5. Consult the solution design docs in `/data/order-processing/`
