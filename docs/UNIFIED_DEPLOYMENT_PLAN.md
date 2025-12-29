# Unified Deployment Plan

**Created:** 2025-12-27
**Status:** FINAL
**Architecture:** VM-Only with Temporal.io

---

## Executive Summary

This document consolidates all deployment decisions and provides the single source of truth for the Order Processing System deployment.

---

## Architecture Overview

```
+-----------------------------------------------------------------------+
|                PIPPA OF LONDON TENANT                                  |
|                (23da91a5-0480-4183-8bc1-d7b6dd33dd2e)                  |
|                                                                        |
|  +------------------+  +------------------------------------------+   |
|  | Azure Bot        |  | App Registration (Single-Tenant)         |   |
|  | (Single-Tenant)  |  | - order-processing-bot                   |   |
|  |                  |  | - Supported Accounts: This org only      |   |
|  | Messaging URL:   |  +------------------------------------------+   |
|  | https://pippai-  |                                                  |
|  | vm.360innovate.  |  +------------------------------------------+   |
|  | com/api/messages |  | Teams App Package                         |   |
|  +--------+---------+  | - manifest.json with bot ID               |   |
|           |            | - Sideloaded by admin                     |   |
|           |            +------------------------------------------+   |
|           |                                                            |
|  +--------v------------------------------------------------------+    |
|  | Teams Users                                                    |    |
|  | - antonio@pippaoflondon.co.uk (Admin)                         |    |
|  | - Sales team members                                           |    |
|  +---------------------------------------------------------------+    |
|                                                                        |
+-----------------------------------+------------------------------------+
                                    | HTTPS (Bot Framework messages)
                                    v
+-----------------------------------------------------------------------+
|                360INNOVATE TENANT                                      |
|                (545acd6e-7392-4046-bc3e-d4656b7146dd)                  |
|                                                                        |
|  +---------------------------------------------------------------+    |
|  | pippai-vm (135.225.31.54)                                     |    |
|  | Standard_E8s_v5 | Ubuntu 22.04 | Sweden Central               |    |
|  |                                                                |    |
|  |  DEPLOYMENT ROOT: /data/order-processing/                     |    |
|  |                                                                |    |
|  |  +----------------------------------------------------------+ |    |
|  |  | nginx (Port 443)                                         | |    |
|  |  |                                                          | |    |
|  |  | /api/messages  --> localhost:3978 (Teams Bot)            | |    |
|  |  | /api/*         --> localhost:3000 (Workflow API)         | |    |
|  |  | /temporal/     --> localhost:8080 (Temporal UI)          | |    |
|  |  | /health        --> localhost:3000/health                 | |    |
|  |  +----------------------------------------------------------+ |    |
|  |                                                                |    |
|  |  +----------------------------------------------------------+ |    |
|  |  | PM2 Process Manager                                      | |    |
|  |  |                                                          | |    |
|  |  | workflow-api   (3000) - Express API server               | |    |
|  |  | workflow-worker       - Temporal workflow workers        | |    |
|  |  | teams-bot      (3978) - Bot Framework handler            | |    |
|  |  +----------------------------------------------------------+ |    |
|  |                                                                |    |
|  |  +----------------------------------------------------------+ |    |
|  |  | Docker Containers                                        | |    |
|  |  |                                                          | |    |
|  |  | temporal       (7233) - Temporal.io server               | |    |
|  |  | temporal-ui    (8080) - Web dashboard                    | |    |
|  |  | postgresql     (5432) - Temporal persistence             | |    |
|  |  +----------------------------------------------------------+ |    |
|  |                                                                |    |
|  +---------------------------------------------------------------+    |
|                                                                        |
|  Azure Services (via Managed Identity):                                |
|  - cosmos-visionarylab (Cosmos DB)                                     |
|  - pippaistoragedev (Blob Storage)                                     |
|  - pippai-keyvault-dev (Key Vault)                                     |
|  - pippai-insights (Application Insights)                              |
|                                                                        |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                EXTERNAL SERVICES                                       |
|                                                                        |
|  +------------------+  +------------------+  +------------------+      |
|  | Zoho Books       |  | Azure AI Foundry |  | External AI      |      |
|  | (EU Datacenter)  |  | (Sweden Central) |  | (Gemini, xAI)    |      |
|  +------------------+  +------------------+  +------------------+      |
|                                                                        |
+-----------------------------------------------------------------------+
```

---

## Key Configuration Values

### Tenant Configuration

| Tenant | ID | Purpose |
|--------|-----|---------|
| **Pippa of London** | `23da91a5-0480-4183-8bc1-d7b6dd33dd2e` | Bot registration + Teams users |
| **360innovate** | `545acd6e-7392-4046-bc3e-d4656b7146dd` | Azure resources (VM, Storage, etc.) |

### Resource Configuration

| Resource | Value | Tenant |
|----------|-------|--------|
| VM Name | `pippai-vm` | 360innovate |
| VM IP | `135.225.31.54` | 360innovate |
| Resource Group | `pippai-rg` | 360innovate |
| Cosmos DB | `cosmos-visionarylab` | 360innovate |
| Storage | `pippaistoragedev` | 360innovate |
| Key Vault | `pippai-keyvault-dev` | 360innovate |
| Bot Registration | `order-processing-bot` | **Pippa of London** |
| App Registration | `order-processing-bot-app` | **Pippa of London** |

### Deployment Paths

| Environment | Path | Purpose |
|-------------|------|---------|
| Development | `/data/order-processing/` | Source code + deployment |
| PostgreSQL Data | `/data/order-processing/temporal/postgres-data/` | Temporal persistence |

**IMPORTANT**: All deployment uses `/data/order-processing/`, NOT `/opt/order-processing/`.

---

## Bot Registration Architecture

### Why Bot in Pippa of London Tenant?

Since Microsoft deprecated multi-tenant bot creation (July 31, 2025), the solution is:

1. **Register Azure Bot in the SAME tenant as the users** (Pippa of London)
2. **Point the messaging endpoint to the VM** (in 360innovate tenant)
3. **No cross-tenant authentication required** - Bot and users are in same tenant

This eliminates the 401 authorization errors that occur with single-tenant bots serving external tenants.

### Configuration on pippai-vm

```bash
# Bot credentials (from Pippa of London tenant)
MicrosoftAppId=<app-id-from-pippa-tenant>
MicrosoftAppPassword=<secret-from-pippa-tenant>
MicrosoftAppType=SingleTenant
MicrosoftAppTenantId=23da91a5-0480-4183-8bc1-d7b6dd33dd2e
```

---

## Deployment Sequence

### Phase 1: Bot Registration (Pippa of London Tenant)

**Performed by:** antonio@pippaoflondon.co.uk

1. **Create App Registration**
   - Azure Portal > App registrations > New registration
   - Name: `order-processing-bot`
   - Supported account types: "Accounts in this organizational directory only"
   - Generate client secret (copy immediately)

2. **Create Azure Bot**
   - Azure Portal > Create resource > Azure Bot
   - Bot handle: `order-processing-bot`
   - Type: **Single Tenant**
   - Microsoft App ID: (use App Registration ID from step 1)
   - Messaging endpoint: `https://processing.pippaoflondon.co.uk/api/messages`

3. **Configure Teams Channel**
   - Azure Bot > Channels > Microsoft Teams
   - Enable messaging

4. **Package Teams App**
   - Update manifest.json with Bot ID
   - Create .zip with manifest + icons
   - Upload to Teams Admin Center

### Phase 2: VM Configuration (360innovate Tenant)

**Performed by:** DevOps team

1. **Update Environment Variables**
   ```bash
   cd /data/order-processing/app/services/teams-bot

   cat >> .env << 'EOF'
   MicrosoftAppId=<from-pippa-tenant>
   MicrosoftAppPassword=<from-pippa-tenant>
   MicrosoftAppType=SingleTenant
   MicrosoftAppTenantId=23da91a5-0480-4183-8bc1-d7b6dd33dd2e
   EOF
   ```

2. **Start Services**
   ```bash
   cd /data/order-processing

   # Start Temporal stack
   docker compose -f app/services/workflow/docker-compose.temporal.yml up -d

   # Start Node.js services
   pm2 start ecosystem.config.js
   pm2 save
   ```

3. **Configure SSL**
   ```bash
   sudo certbot --nginx -d processing.pippaoflondon.co.uk
   ```

4. **Verify Health**
   ```bash
   curl https://processing.pippaoflondon.co.uk/health
   curl https://processing.pippaoflondon.co.uk/api/workflow/health
   ```

### Phase 3: Teams App Deployment (Pippa of London Tenant)

**Performed by:** antonio@pippaoflondon.co.uk

1. Upload Teams app package to Teams Admin Center
2. Approve app for organization
3. Test bot in Teams chat

---

## Environment Variables Reference

### Workflow Service (.env)

```bash
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=order-processing
TEMPORAL_TASK_QUEUE=order-processing-queue

# Azure Services (accessed via Managed Identity)
COSMOS_ENDPOINT=https://cosmos-visionarylab.documents.azure.com:443/
COSMOS_DATABASE_ID=order-processing
AZURE_STORAGE_ACCOUNT=pippaistoragedev
KEY_VAULT_URL=https://pippai-keyvault-dev.vault.azure.net/

# Application Settings
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
```

### Teams Bot Service (.env)

```bash
# Bot Framework (from Pippa of London tenant)
MicrosoftAppId=<pippa-tenant-app-id>
MicrosoftAppPassword=<pippa-tenant-app-secret>
MicrosoftAppType=SingleTenant
MicrosoftAppTenantId=23da91a5-0480-4183-8bc1-d7b6dd33dd2e

# Internal API
WORKFLOW_API_URL=http://localhost:3000

# Application Settings
NODE_ENV=production
PORT=3978
```

---

## nginx Configuration

File: `/etc/nginx/sites-available/order-processing`

```nginx
upstream workflow_api {
    server 127.0.0.1:3000;
    keepalive 8;
}

upstream teams_bot {
    server 127.0.0.1:3978;
}

upstream temporal_ui {
    server 127.0.0.1:8080;
    keepalive 2;
}

server {
    listen 443 ssl http2;
    server_name processing.pippaoflondon.co.uk;

    ssl_certificate /etc/letsencrypt/live/processing.pippaoflondon.co.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/processing.pippaoflondon.co.uk/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Teams Bot Webhook (MUST be first - specific route)
    location /api/messages {
        proxy_pass http://teams_bot;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Workflow API
    location /api/ {
        proxy_pass http://workflow_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
    }

    # Temporal UI (with basic auth)
    location /temporal/ {
        auth_basic "Temporal Admin";
        auth_basic_user_file /etc/nginx/conf.d/.htpasswd-temporal;

        rewrite ^/temporal(/.*)$ $1 break;
        proxy_pass http://temporal_ui;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        proxy_pass http://workflow_api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

server {
    listen 80;
    server_name processing.pippaoflondon.co.uk;
    return 301 https://$server_name$request_uri;
}
```

---

## PM2 Ecosystem Configuration

File: `/data/order-processing/ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'workflow-api',
      script: './app/services/workflow/dist/server.js',
      instances: 2,
      exec_mode: 'cluster',
      cwd: '/data/order-processing',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TEMPORAL_ADDRESS: 'localhost:7233',
        TEMPORAL_NAMESPACE: 'order-processing'
      },
      error_file: '/data/order-processing/logs/workflow-api-error.log',
      out_file: '/data/order-processing/logs/workflow-api-out.log',
      merge_logs: true,
      autorestart: true
    },
    {
      name: 'workflow-worker',
      script: './app/services/workflow/dist/worker.js',
      instances: 2,
      exec_mode: 'cluster',
      cwd: '/data/order-processing',
      env: {
        NODE_ENV: 'production',
        TEMPORAL_ADDRESS: 'localhost:7233',
        TEMPORAL_NAMESPACE: 'order-processing',
        TEMPORAL_TASK_QUEUE: 'order-processing-queue'
      },
      error_file: '/data/order-processing/logs/workflow-worker-error.log',
      out_file: '/data/order-processing/logs/workflow-worker-out.log',
      merge_logs: true,
      autorestart: true
    },
    {
      name: 'teams-bot',
      script: './app/services/teams-bot/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      cwd: '/data/order-processing',
      env: {
        NODE_ENV: 'production',
        PORT: 3978
      },
      error_file: '/data/order-processing/logs/teams-bot-error.log',
      out_file: '/data/order-processing/logs/teams-bot-out.log',
      autorestart: true
    }
  ]
};
```

---

## Deprecated/Incorrect References to Remove

### Files with Outdated References

| File | Issue | Fix |
|------|-------|-----|
| `app/services/workflow/DEPLOYMENT.md` | Uses `/opt` path | Change to `/data` |
| `app/services/workflow/DEPLOYMENT.md` | Azure Functions URLs (lines 332-335) | Remove |
| `README.md` | `MICROSOFT_APP_TYPE=MultiTenant` | Change to `SingleTenant` |
| `app/infra/scripts/cloud-init.yaml` | Creates `/opt` directories | Change to `/data` |
| `SOLUTION_DESIGN.md` | Azure Functions architecture | Mark as ARCHIVED |
| `MVP_AND_HOWTO.md` | Azure Functions approach | Mark as ARCHIVED |

---

## Verification Checklist

### Pre-Deployment

- [ ] Bot App Registration created in Pippa of London tenant
- [ ] Azure Bot created in Pippa of London tenant
- [ ] Teams channel enabled on Azure Bot
- [ ] App ID and secret copied to Key Vault
- [ ] DNS A record for `processing.pippaoflondon.co.uk` → `135.225.31.54`

### Deployment

- [ ] Docker containers running (temporal, postgresql, temporal-ui)
- [ ] PM2 processes running (workflow-api, workflow-worker, teams-bot)
- [ ] SSL certificate configured
- [ ] nginx proxy working
- [ ] Health endpoints responding

### Post-Deployment

- [ ] Teams app uploaded to Pippa of London tenant
- [ ] Test message to bot successful
- [ ] File upload workflow working
- [ ] Temporal UI accessible at /temporal/
- [ ] Zoho integration verified

---

## Support Contacts

| Role | Contact |
|------|---------|
| Pippa of London Admin | antonio@pippaoflondon.co.uk |
| Azure Infrastructure | 360innovate DevOps |
| Application Support | Development team |

---

*Last Updated: 2025-12-27*
*Architecture: VM-Only with Temporal.io*
*Bot Pattern: Single-tenant bot in user tenant, resources in infrastructure tenant*
