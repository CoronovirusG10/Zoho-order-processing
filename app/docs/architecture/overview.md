# System Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TENANT B (Teams Users)                          │
│  ┌──────────────┐    ┌──────────────┐                                        │
│  │  Salesperson │    │   Manager    │                                        │
│  │  (Teams)     │    │  (Teams)     │                                        │
│  └──────┬───────┘    └──────┬───────┘                                        │
│         │ Upload .xlsx      │ View cases                                     │
└─────────┼───────────────────┼────────────────────────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TENANT A (Azure - Sweden Central)                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Azure Bot Service                               │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │ │
│  │  │  Teams Bot  │───▶│ File Handler│───▶│ Card Builder│                 │ │
│  │  └─────────────┘    └──────┬──────┘    └─────────────┘                 │ │
│  └────────────────────────────┼───────────────────────────────────────────┘ │
│                               │                                              │
│                               ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     Azure VM (Ubuntu 22.04 LTS)                         │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │                     nginx (Reverse Proxy)                        │   │ │
│  │  │  - SSL/TLS termination                                          │   │ │
│  │  │  - Load balancing to workers                                    │   │ │
│  │  │  - Health check endpoints                                       │   │ │
│  │  └──────────────────────────┬──────────────────────────────────────┘   │ │
│  │                             │                                           │ │
│  │  ┌──────────────────────────┴──────────────────────────────────────┐   │ │
│  │  │                     PM2 Process Manager                          │   │ │
│  │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │   │ │
│  │  │  │  Bot Worker    │  │ Temporal       │  │  Health        │     │   │ │
│  │  │  │  (Node.js)     │  │  Workers (x4)  │  │  Monitor       │     │   │ │
│  │  │  └────────────────┘  └────────────────┘  └────────────────┘     │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                             │                                           │ │
│  │  ┌──────────────────────────┴──────────────────────────────────────┐   │ │
│  │  │                     Temporal.io Server                           │   │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │   │ │
│  │  │  │  Frontend  │  │  History   │  │  Matching  │                 │   │ │
│  │  │  │  Service   │  │  Service   │  │  Service   │                 │   │ │
│  │  │  └────────────┘  └────────────┘  └────────────┘                 │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                             │                                           │ │
│  │  ┌──────────────────────────┴──────────────────────────────────────┐   │ │
│  │  │                     PostgreSQL 15                                │   │ │
│  │  │  - Temporal workflow state                                       │   │ │
│  │  │  - Task queue metadata                                          │   │ │
│  │  │  - Visibility data                                              │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                               │                                              │
│         ┌─────────────────────┼─────────────────────┐                        │
│         ▼                     ▼                     ▼                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Temporal      │  │   Temporal      │  │   Temporal      │              │
│  │   Workflow:     │  │   Activity:     │  │   Activity:     │              │
│  │  OrderProcess   │  │  CommitteeVote  │  │   ZohoSync      │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                     │                       │
│           ▼                    ▼                     ▼                       │
│  ┌─────────────┐     ┌─────────────────┐    ┌─────────────┐                 │
│  │   Parser    │     │   Committee     │    │    Zoho     │                 │
│  │   Service   │     │    Engine       │    │   Service   │                 │
│  │ (ExcelJS)   │     │ (3 providers)   │    │ (OAuth/API) │                 │
│  └─────────────┘     └────────┬────────┘    └──────┬──────┘                 │
│                               │                     │                        │
│                               ▼                     ▼                        │
│                   ┌───────────────────────┐  ┌─────────────┐                │
│                   │  Azure AI Foundry     │  │ Zoho Books  │                │
│                   │  - GPT-5.x            │  │ (EU DC)     │                │
│                   │  - Claude 4.x         │  └─────────────┘                │
│                   │  - DeepSeek V3.x      │        ▲                        │
│                   │  - Grok-4             │        │                        │
│                   └───────────────────────┘        │                        │
│                                                    │                        │
│  ┌────────────────────────────────────────────────┼───────────────────────┐ │
│  │                        Storage Layer           │                        │ │
│  │  ┌─────────────┐   ┌─────────────┐   ┌────────┴────┐                   │ │
│  │  │ Blob Storage│   │  Cosmos DB  │   │  Key Vault  │                   │ │
│  │  │ (5y audit)  │   │  (cases)    │   │  (secrets)  │                   │ │
│  │  └─────────────┘   └─────────────┘   └─────────────┘                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Observability                                    │ │
│  │  ┌─────────────────┐   ┌───────────────────┐   ┌─────────────────┐     │ │
│  │  │ App Insights    │   │ Log Analytics     │   │ Temporal Web UI │     │ │
│  │  │ (traces/metrics)│   │ (2y query/5y arch)│   │ (workflow viz)  │     │ │
│  │  └─────────────────┘   └───────────────────┘   └─────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Teams Bot
- Receives file uploads in personal chat
- Posts adaptive cards for user interaction
- Handles approval/correction workflows
- Multi-tenant authentication

### nginx Reverse Proxy
- SSL/TLS termination with Let's Encrypt certificates
- Routes requests to appropriate backend services
- Health check endpoints for Azure Load Balancer
- Rate limiting and request buffering
- WebSocket support for Temporal Web UI

### PM2 Process Manager
- Manages all Node.js application processes
- Auto-restart on failure with exponential backoff
- Log aggregation and rotation
- Cluster mode for multi-core utilization
- Zero-downtime deployments

### Temporal.io Server
- Orchestrates durable workflow execution
- Persists workflow state to PostgreSQL
- Provides exactly-once execution guarantees
- Built-in retry policies with exponential backoff
- Workflow versioning for safe deployments
- Web UI for workflow visualization and debugging

### PostgreSQL Database
- Stores Temporal workflow execution state
- Task queue metadata and scheduling
- Visibility data for workflow queries
- Configured with streaming replication for HA

### Temporal Workflows

#### OrderProcessWorkflow
- Main orchestration workflow for order processing
- Coordinates activities in sequence with compensation
- Handles human-in-the-loop approval patterns
- Timeout handling for user interactions

#### Activities
| Activity | Purpose |
|----------|---------|
| `parseExcelActivity` | Extract data from uploaded Excel files |
| `committeeVoteActivity` | Run AI committee voting in parallel |
| `resolveEntitiesActivity` | Match customers/items in Zoho |
| `createDraftActivity` | Create draft sales order in Zoho |
| `sendNotificationActivity` | Send Teams notifications via Bot |

### Parser Service
- Deterministic Excel parsing
- Formula detection and blocking
- Schema inference (English + Farsi)
- Evidence collection for every value

### Committee Engine
- Runs 3 AI providers in parallel
- Aggregates votes with weighted voting
- Detects consensus/disagreement
- Forces human input when uncertain

### Zoho Service
- OAuth token management with auto-refresh
- Customer/item resolution with caching
- Draft sales order creation
- Retry logic handled by Temporal activities

### Storage Layer
- **Blob Storage**: Raw files, audit bundles, model outputs
- **Cosmos DB**: Case state, fingerprints, cache
- **Key Vault**: All secrets and credentials

## Data Flow

1. User uploads Excel file in Teams
2. Bot downloads file to Blob Storage
3. Bot triggers Temporal OrderProcessWorkflow
4. **ParseExcelActivity**: Extracts data with evidence
5. **CommitteeVoteActivity**: Reviews mappings (3 providers in parallel)
6. Workflow signals for user corrections if needed
7. **ResolveEntitiesActivity**: Matches in Zoho
8. Workflow signals for user approval
9. **CreateDraftActivity**: Creates draft in Zoho Books
10. **SendNotificationActivity**: Confirms to user in Teams

## Integration Points

### Azure Cosmos DB
- **Connection**: DefaultAzureCredential via Managed Identity
- **Database**: `order-processing`
- **Containers**: `cases`, `fingerprints`, `cache`
- **Consistency**: Session consistency for case operations
- **Partition Key**: `/tenantId` for multi-tenant isolation

### Azure Blob Storage
- **Connection**: DefaultAzureCredential via Managed Identity
- **Containers**:
  - `uploads`: Raw uploaded files (7-day retention)
  - `audit`: Immutable audit bundles (5-year retention)
  - `outputs`: AI model outputs (90-day retention)
- **Access Tier**: Hot for active, Cool for audit

### Azure Key Vault
- **Connection**: DefaultAzureCredential via Managed Identity
- **Secrets Stored**:
  - `zoho-client-id`, `zoho-client-secret`
  - `teams-app-id`, `teams-app-password`
  - `ai-foundry-api-key`
  - `postgres-connection-string`
- **Access Policy**: VM Managed Identity with Get/List

### Azure AI Foundry
- **Endpoint**: Sweden Central regional endpoint
- **Models**: GPT-5.x, Claude 4.x, DeepSeek V3.x, Grok-4
- **Authentication**: API key from Key Vault
- **Rate Limits**: Managed via Temporal activity retries

## Security Model

- Multi-tenant Entra apps
- Managed Identity for Azure services
- All secrets in Key Vault
- RBAC for data access
- Immutable audit storage
- nginx TLS 1.3 only
- PostgreSQL encrypted at rest

## Scaling Characteristics

- Designed for 100-200 orders/day
- Temporal task queues for burst handling
- Committee calls are parallelized via activities
- Zoho rate limits handled by activity retry policy
- PM2 cluster mode (4 workers) for Node.js scaling
- PostgreSQL connection pooling (PgBouncer)

## Resource Tagging Strategy

All Azure resources follow a consistent tagging strategy for cost tracking, compliance, and operations.

### Required Tags

| Tag | Purpose | Example Values |
|-----|---------|----------------|
| `Environment` | Deployment stage | `dev`, `staging`, `prod` |
| `Project` | Project identifier | `order-processing` |
| `Owner` | Responsible team/person | `platform-team` |
| `CostCenter` | Billing allocation | `engineering-001` |
| `ManagedBy` | Deployment method | `terraform`, `bicep`, `manual` |

### Optional Tags

| Tag | Purpose | Example Values |
|-----|---------|----------------|
| `DataClassification` | Data sensitivity | `public`, `internal`, `confidential` |
| `Compliance` | Regulatory requirements | `gdpr`, `iso27001` |
| `AutoShutdown` | Non-prod cost saving | `true`, `false` |
| `BackupPolicy` | Backup tier | `daily`, `weekly`, `none` |

### Tag Application

```hcl
# Terraform example
locals {
  common_tags = {
    Environment        = var.environment
    Project           = "order-processing"
    Owner             = "platform-team"
    CostCenter        = "engineering-001"
    ManagedBy         = "terraform"
    DataClassification = "confidential"
  }
}

resource "azurerm_resource_group" "main" {
  name     = "rg-order-processing-${var.environment}"
  location = "swedencentral"
  tags     = local.common_tags
}
```

## VM Infrastructure Details

### VM Specifications
- **Size**: Standard_D4s_v5 (4 vCPU, 16 GB RAM)
- **OS**: Ubuntu 22.04 LTS
- **Disk**: 128 GB Premium SSD (P10)
- **Network**: VNet with NSG, private subnet

### Installed Components
| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 LTS | Application runtime |
| PM2 | Latest | Process management |
| Temporal Server | 1.24.x | Workflow orchestration |
| PostgreSQL | 15 | Workflow state persistence |
| nginx | Latest | Reverse proxy |
| Azure CLI | Latest | Azure resource access |

### PM2 Ecosystem Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'bot-worker',
      script: './dist/bot/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3978
      }
    },
    {
      name: 'temporal-worker',
      script: './dist/temporal/worker.js',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        TEMPORAL_ADDRESS: 'localhost:7233'
      }
    },
    {
      name: 'health-monitor',
      script: './dist/health/monitor.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 */6 * * *'
    }
  ]
};
```

### nginx Configuration

```nginx
# /etc/nginx/sites-available/order-processing
upstream bot_backend {
    server 127.0.0.1:3978;
    keepalive 32;
}

upstream temporal_ui {
    server 127.0.0.1:8080;
    keepalive 8;
}

server {
    listen 443 ssl http2;
    server_name order-processing.example.com;

    ssl_certificate /etc/letsencrypt/live/order-processing.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/order-processing.example.com/privkey.pem;
    ssl_protocols TLSv1.3;

    location /api/messages {
        proxy_pass http://bot_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /temporal/ {
        proxy_pass http://temporal_ui/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

## Disaster Recovery

### Backup Strategy
- **PostgreSQL**: Daily automated backups to Blob Storage (30-day retention)
- **Cosmos DB**: Continuous backup with point-in-time restore
- **Blob Storage**: Geo-redundant storage (GRS) for audit data
- **VM**: Azure Backup with daily snapshots (7-day retention)

### Recovery Objectives
- **RTO**: 4 hours (VM rebuild from image + restore)
- **RPO**: 1 hour (PostgreSQL WAL archiving)

### Failover Procedure
1. Provision new VM from golden image
2. Restore PostgreSQL from latest backup
3. Update DNS/Load Balancer to new VM
4. Temporal workflows resume automatically (durable by design)
