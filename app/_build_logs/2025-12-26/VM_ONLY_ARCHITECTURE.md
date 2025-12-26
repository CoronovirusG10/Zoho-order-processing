# VM-Only Architecture Design

**Version:** 1.0
**Created:** 2025-12-26
**Status:** DRAFT - Pending Multi-Model Validation

---

## 1. Executive Overview

This document defines the target architecture for migrating the Order Processing application from Azure Functions/Container Apps to a **VM-only deployment** on the existing `pippai-vm` in the `pippai-rg` resource group.

### Architecture Principles

1. **Consolidation:** All Order Processing services run on a single VM
2. **Simplicity:** Minimize Azure PaaS dependencies where practical
3. **Cost Allocation:** All resources tagged for Order Processing project
4. **Reuse:** Leverage existing Cosmos DB, Storage, and Key Vault resources
5. **Operability:** Standard tooling (PM2, Docker, nginx, systemd)

---

## 2. Resource Placement

### pippai-rg (Existing Resource Group)

| Resource | Name | Type | Purpose | Tags |
|----------|------|------|---------|------|
| VM | pippai-vm | Standard_E8s_v5 | All Order Processing services | Project=order-processing, CostCenter=zoho |
| PostgreSQL | order-processing-temporal-db | Flexible Server GP 4vCore | Temporal workflow state | Project=order-processing |
| Cosmos DB | order-processing-{env}-cosmos | SQL API (Serverless) | Application data | Project=order-processing |
| Storage | orderstor{suffix} | Standard_LRS | Blobs and queues | Project=order-processing |
| Key Vault | orderkv{suffix} | Standard | Secrets and certificates | Project=order-processing |
| App Insights | order-processing-appinsights | Standard | Application telemetry | Project=order-processing |
| Log Analytics | log-analytics-{suffix} | Standard | Centralized logging | Project=order-processing |

### Tagging Strategy

All resources tagged with:
```
Project=order-processing
CostCenter=zoho
Environment=dev|prod
ManagedBy=claude-code
```

---

## 3. Services on VM

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         pippai-vm (E8s_v5)                          │
│                     8 vCPU | 64 GB RAM | 256 GB SSD                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    nginx (systemd)                             │  │
│  │                    Port 80/443 → Reverse Proxy                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  API Service    │  │  Teams Bot      │  │  Temporal Worker    │  │
│  │  PM2 Cluster    │  │  PM2 Single     │  │  PM2 Cluster        │  │
│  │  Port 3000      │  │  Port 3978      │  │  (no port)          │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │
│                              ↓                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                 Temporal Server (Docker Compose)               │  │
│  │  Frontend:7233 | History | Matching | Worker | UI:8080         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                 PostgreSQL (Docker or Managed)                 │  │
│  │                      Port 5432 (internal)                      │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
         ┌────────────────────┼────────────────────┐
         ↓                    ↓                    ↓
   ┌──────────┐        ┌──────────┐         ┌──────────┐
   │ Cosmos DB │        │ Storage  │         │ Key Vault│
   │  (Azure)  │        │ (Azure)  │         │  (Azure) │
   └──────────┘        └──────────┘         └──────────┘
```

### Service Details

| Service | Port | Manager | Instances | Purpose |
|---------|------|---------|-----------|---------|
| nginx | 80, 443 | systemd | 1 | SSL termination, reverse proxy |
| Temporal Server | 7233, 8080 | Docker Compose | 4 containers | Workflow orchestration engine |
| Temporal Worker | - | PM2 cluster | 2-4 | Execute workflow activities |
| API Service | 3000 | PM2 cluster | 2-4 | REST API for workflow management |
| Teams Bot | 3978 | PM2 single | 1 | Teams webhook handler |
| PostgreSQL | 5432 | Docker | 1 | Temporal state persistence |

### Port Allocation

| Port | Protocol | Service | Access |
|------|----------|---------|--------|
| 22 | TCP | SSH | Restricted (admin VPN only) |
| 80 | TCP | nginx (HTTP→HTTPS redirect) | Public |
| 443 | TCP | nginx (HTTPS) | Public |
| 3000 | TCP | API Service | Internal (via nginx) |
| 3978 | TCP | Teams Bot | Internal (via nginx) |
| 5432 | TCP | PostgreSQL | Internal only |
| 7233 | TCP | Temporal gRPC | Internal only |
| 8080 | TCP | Temporal Web UI | Internal (via nginx) |

---

## 4. Network Architecture

### Subnet Configuration

```
VNet: pippai-vnet (10.0.0.0/16)
├── private-endpoints (10.0.1.0/24) - Private endpoints for Azure services
├── vm-compute (10.0.4.0/24) - NEW: VM subnet for pippai-vm
└── [legacy subnets retained for compatibility]
```

### NSG Rules (vm-compute-nsg)

**Inbound Rules:**
| Priority | Name | Source | Port | Protocol | Action |
|----------|------|--------|------|----------|--------|
| 100 | AllowHTTPS | Internet | 443 | TCP | Allow |
| 105 | AllowHTTP | Internet | 80 | TCP | Allow |
| 110 | AllowSSH | AdminVPN | 22 | TCP | Allow |
| 4096 | DenyAllInbound | * | * | * | Deny |

**Outbound Rules:**
| Priority | Name | Destination | Port | Protocol | Action |
|----------|------|-------------|------|----------|--------|
| 100 | AllowAzureServices | AzureCloud | 443 | TCP | Allow |
| 105 | AllowZohoAPI | zoho.eu | 443 | TCP | Allow |
| 110 | AllowNTP | 0.ubuntu.pool.ntp.org | 123 | UDP | Allow |
| 4096 | DenyAllOutbound | * | * | * | Deny |

### Service Endpoints

Enabled on vm-compute subnet:
- Microsoft.Storage
- Microsoft.KeyVault
- Microsoft.AzureCosmosDB

---

## 5. Temporal Architecture

### Docker Compose Configuration

```yaml
# docker-compose.temporal.yml
version: '3.8'
services:
  postgresql:
    image: postgres:15
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: ${TEMPORAL_DB_PASSWORD}
    volumes:
      - temporal-db:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  temporal:
    image: temporalio/auto-setup:latest
    depends_on:
      - postgresql
    environment:
      - DB=postgres12
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=${TEMPORAL_DB_PASSWORD}
      - POSTGRES_SEEDS=postgresql
    ports:
      - "7233:7233"

  temporal-ui:
    image: temporalio/ui:latest
    depends_on:
      - temporal
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    ports:
      - "8080:8080"

volumes:
  temporal-db:
```

### Production Considerations

For production, consider:
1. **Managed PostgreSQL:** Use Azure PostgreSQL Flexible Server instead of Docker
2. **High Availability:** Deploy multiple Temporal frontend replicas
3. **Backup:** Enable PostgreSQL automated backups
4. **Metrics:** Configure Prometheus metrics endpoint

---

## 6. Application Architecture

### Workflow Processing Flow

```
1. Teams Bot receives Excel file
   └── POST /webhook/teams → Bot Service → File Upload

2. API Service creates workflow
   └── POST /api/workflow/start → Temporal Client → Workflow Started

3. Temporal Workflow executes activities
   └── store-file → parse-excel → run-committee → resolve-customer
       → resolve-items → apply-corrections → create-zoho-draft → notify-user

4. External events via signals
   └── POST /api/workflow/{id}/signal → Temporal Signal → Workflow Continues

5. Workflow completion
   └── Workflow Complete → Cosmos DB Updated → User Notified
```

### Code Structure

```
/opt/order-processing/
├── docker-compose.temporal.yml    # Temporal server configuration
├── ecosystem.config.js            # PM2 process configuration
├── nginx/
│   └── order-processing.conf      # nginx reverse proxy config
├── services/
│   ├── api/                       # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/           # HTTP endpoints
│   │   │   ├── controllers/      # Request handlers
│   │   │   └── config.ts         # Configuration
│   │   └── package.json
│   ├── workflow/                  # Temporal workflow service
│   │   ├── src/
│   │   │   ├── workflows/        # Temporal workflow definitions
│   │   │   ├── activities/       # Activity implementations
│   │   │   ├── worker.ts         # Worker entry point
│   │   │   └── client.ts         # Temporal client utilities
│   │   └── package.json
│   └── teams-bot/                 # Teams bot webhook handler
│       ├── src/
│       └── package.json
└── scripts/
    ├── deploy.sh                  # Deployment script
    ├── rollback.sh                # Rollback script
    └── health-check.sh            # Health verification
```

---

## 7. PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'order-api',
      script: './services/api/dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'order-worker',
      script: './services/workflow/dist/worker.js',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        TEMPORAL_ADDRESS: 'localhost:7233'
      },
      wait_ready: true,
      listen_timeout: 30000
    },
    {
      name: 'teams-bot',
      script: './services/teams-bot/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3978
      }
    }
  ]
};
```

---

## 8. nginx Configuration

```nginx
# /etc/nginx/sites-available/order-processing
upstream api_servers {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream bot_server {
    server 127.0.0.1:3978;
}

upstream temporal_ui {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name order-processing.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name order-processing.example.com;

    ssl_certificate /etc/letsencrypt/live/order-processing.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/order-processing.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # API endpoints
    location /api/ {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Teams Bot webhook
    location /api/messages {
        proxy_pass http://bot_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Temporal Web UI (restricted access)
    location /temporal/ {
        auth_basic "Temporal Admin";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://temporal_ui/;
        proxy_http_version 1.1;
    }

    # Health check
    location /health {
        proxy_pass http://api_servers/health;
    }
}
```

---

## 9. Security Architecture

### Identity & Access

```
┌─────────────────────────────────────────────────────────────────┐
│                    Managed Identity Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  pippai-vm                                                       │
│  (System-Assigned MI)                                            │
│        │                                                         │
│        ├──────► Cosmos DB (Data Contributor)                     │
│        │        - Read/write all containers                      │
│        │                                                         │
│        ├──────► Storage (Blob + Queue Data Contributor)          │
│        │        - Upload/download blobs                          │
│        │        - Queue operations                               │
│        │                                                         │
│        └──────► Key Vault (Secrets User)                         │
│                 - Read secrets at startup                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### SSL/TLS

- **Provider:** Let's Encrypt via Certbot
- **Renewal:** Automatic via systemd timer (every 60 days)
- **Protocols:** TLS 1.2, TLS 1.3 only
- **HSTS:** Enabled with 1-year max-age

### Secrets Management

| Secret | Source | Rotation |
|--------|--------|----------|
| ZOHO_CLIENT_ID | Key Vault | Quarterly |
| ZOHO_CLIENT_SECRET | Key Vault | Quarterly |
| ZOHO_REFRESH_TOKEN | Key Vault | Quarterly |
| TEAMS_BOT_APP_ID | Key Vault | On change |
| TEAMS_BOT_APP_PASSWORD | Key Vault | On change |
| TEMPORAL_DB_PASSWORD | Key Vault | Quarterly |

---

## 10. Monitoring Architecture

### Observability Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    Monitoring Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Application Layer                                               │
│  └── @azure/monitor-opentelemetry → Application Insights         │
│      - Request tracing                                           │
│      - Dependency tracking                                       │
│      - Custom events                                             │
│                                                                  │
│  Temporal Layer                                                  │
│  └── Prometheus metrics (:9090) → Grafana                        │
│      - Workflow metrics                                          │
│      - Activity metrics                                          │
│      - Worker health                                             │
│                                                                  │
│  Infrastructure Layer                                            │
│  └── Azure Monitor Agent → Log Analytics                         │
│      - VM performance                                            │
│      - Syslog events                                             │
│      - Docker container logs                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| VM Heartbeat | No heartbeat for 5 min | Critical |
| High CPU | >85% for 10 min | Warning |
| High Memory | >90% for 10 min | Warning |
| Workflow Failure | Error rate >5% | Critical |
| API Latency | P95 >2s | Warning |
| Temporal Unavailable | Health check fails | Critical |

---

## 11. Deployment Strategy

### Blue-Green on Single VM

```
Port 3000 ──► Blue Instance (current)
Port 3001 ──► Green Instance (new deployment)

1. Deploy to Green
2. Health check Green
3. nginx upstream switch
4. Monitor for issues
5. Rollback if needed
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

# 1. Pull latest code
cd /opt/order-processing
git pull origin main

# 2. Install dependencies
npm ci --production --prefix services/api
npm ci --production --prefix services/workflow
npm ci --production --prefix services/teams-bot

# 3. Build TypeScript
npm run build --prefix services/api
npm run build --prefix services/workflow
npm run build --prefix services/teams-bot

# 4. Update Temporal (if needed)
docker compose -f docker-compose.temporal.yml pull
docker compose -f docker-compose.temporal.yml up -d --wait

# 5. Graceful reload PM2 apps
pm2 reload ecosystem.config.js --update-env

# 6. Wait for ready
pm2 wait-ready order-api --timeout 30000
pm2 wait-ready order-worker --timeout 30000

# 7. Health check
curl -f http://localhost:3000/health || exit 1

echo "Deployment complete"
```

### Rollback Script

```bash
#!/bin/bash
# rollback.sh

cd /opt/order-processing
git checkout HEAD~1
npm ci --production
pm2 restart ecosystem.config.js --env previous
```

---

## 12. Disaster Recovery

### Backup Strategy

| Component | Backup Method | Retention |
|-----------|---------------|-----------|
| Cosmos DB | Continuous backup | 7 days (dev), 30 days (prod) |
| Storage Account | Soft delete + versioning | 7 days |
| PostgreSQL | Azure Backup | Daily, 7 days |
| VM OS Disk | Azure Backup snapshot | Weekly, 4 weeks |
| Code Repository | Git (GitHub) | Unlimited |

### Recovery Time Objectives

| Component | RTO | RPO |
|-----------|-----|-----|
| Cosmos DB | 1 hour | 0 (continuous) |
| Storage | 1 hour | 0 (versioned) |
| PostgreSQL | 2 hours | 24 hours |
| VM | 4 hours | 1 week |
| Full System | 4 hours | 24 hours |

### Recovery Procedure

1. **Data Corruption:** Restore from Cosmos/Storage backup
2. **Temporal Failure:** Restore PostgreSQL, restart Temporal
3. **VM Failure:** Redeploy from backup or rebuild from scratch
4. **Code Bug:** Git rollback + PM2 restart

---

## 13. Cost Summary

### Monthly Cost Breakdown

| Resource | Configuration | Monthly Cost |
|----------|---------------|--------------|
| VM (shared) | E8s_v5 allocation | $0 (existing) |
| PostgreSQL | Flexible Server 4 vCore | $260 |
| Cosmos DB | Serverless (RU usage) | $25 |
| Storage | LRS + lifecycle | $10 |
| Key Vault | Standard | $0.03/10K ops |
| App Insights | Standard | $2.30/GB |
| Log Analytics | Standard | $2.76/GB |
| Networking | LB + bandwidth | $20 |
| **Total** | | **~$340/mo** |

*Note: VM cost is $0 because pippai-vm already exists and hosts other services.*

---

## 14. Migration Checklist

### Pre-Migration
- [ ] Confirm business approval for +$340/mo cost
- [ ] Provision PostgreSQL Flexible Server
- [ ] Create VM subnet in VNet
- [ ] Configure NSG rules
- [ ] Set up SSL certificate

### Migration
- [ ] Deploy Temporal Server (Docker Compose)
- [ ] Convert workflow code to Temporal
- [ ] Convert activities to Temporal format
- [ ] Create Express routes for triggers
- [ ] Deploy PM2 configuration
- [ ] Configure nginx reverse proxy

### Post-Migration
- [ ] Verify all workflows executing correctly
- [ ] Monitor for errors (24-48 hours)
- [ ] Update documentation
- [ ] Remove Azure Functions resources
- [ ] Final cost validation

---

## 15. Validation Criteria

This architecture requires approval from multi-model consensus before implementation:

### Validation Questions
1. Is the architecture sound and scalable?
2. Are all Durable Functions features properly replaced by Temporal?
3. Is the deployment process well-documented and reproducible?
4. Are there any security gaps?
5. Is cost tracking properly configured?
6. Is disaster recovery adequately addressed?
7. Are there any missing components?

### Approval Required
- [ ] Model 1: APPROVE/REJECT with feedback
- [ ] Model 2: APPROVE/REJECT with feedback
- [ ] Model 3: APPROVE/REJECT with feedback

---

*Document Status: DRAFT - Pending Multi-Model Validation*
*Created: 2025-12-26*
