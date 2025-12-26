# Workflow Orchestrator - Deployment Guide

Complete deployment guide for the Workflow Orchestrator service using Temporal.io on Azure VM.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Azure VM (Ubuntu 22.04)                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────────────────────────────────────┐ │
│  │   nginx     │───▶│  Temporal Web UI (:8080)                    │ │
│  │  (:80/443)  │    │  Temporal Server (:7233)                    │ │
│  └─────────────┘    │  Temporal API (:8233)                       │ │
│        │            └─────────────────────────────────────────────┘ │
│        │            ┌─────────────────────────────────────────────┐ │
│        └───────────▶│  Node.js Worker (PM2)                       │ │
│                     │  - Workflow definitions                      │ │
│                     │  - Activity implementations                  │ │
│                     └─────────────────────────────────────────────┘ │
│                     ┌─────────────────────────────────────────────┐ │
│                     │  PostgreSQL (:5432)                          │ │
│                     │  - Temporal persistence                      │ │
│                     │  - Visibility store                          │ │
│                     └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Azure VM (Ubuntu 22.04 LTS) - Standard_D2s_v3 or higher
- SSH access to VM
- Docker and Docker Compose installed
- Node.js 20+ LTS
- PM2 process manager
- nginx for reverse proxy
- Azure CLI (for Key Vault access)

## Azure Resources Required

1. **Azure Virtual Machine**
   - Size: Standard_D2s_v3 (2 vCPU, 8 GB RAM) minimum
   - OS: Ubuntu 22.04 LTS
   - Region: Sweden Central
   - Managed Identity enabled (for Key Vault access)

2. **Azure Key Vault**
   - For secrets management
   - VM managed identity granted access

3. **Cosmos DB** (existing)
   - For case state storage

4. **Application Insights** (optional but recommended)
   - For monitoring and telemetry

5. **Azure Blob Storage** (existing)
   - For file storage

## Step 1: VM Initial Setup

SSH to VM and install base dependencies:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install nginx
sudo apt install -y nginx

# Create app directory
sudo mkdir -p /opt/order-processing/workflow
sudo chown -R $USER:$USER /opt/order-processing
```

## Step 2: PostgreSQL Setup for Temporal

Create PostgreSQL container for Temporal persistence:

```bash
# Create data directory
mkdir -p /opt/order-processing/temporal/postgres-data

# Create docker-compose file
cat > /opt/order-processing/temporal/docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgresql:
    image: postgres:15-alpine
    container_name: temporal-postgres
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: temporal
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U temporal"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  temporal:
    image: temporalio/auto-setup:1.24.2
    container_name: temporal-server
    depends_on:
      postgresql:
        condition: service_healthy
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=${POSTGRES_PASSWORD}
      - POSTGRES_SEEDS=postgresql
      - DYNAMIC_CONFIG_FILE_PATH=/etc/temporal/dynamicconfig/development.yaml
    ports:
      - "127.0.0.1:7233:7233"
    volumes:
      - ./dynamicconfig:/etc/temporal/dynamicconfig
    healthcheck:
      test: ["CMD", "temporal", "workflow", "list", "--namespace", "default"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 60s
    restart: unless-stopped

  temporal-admin-tools:
    image: temporalio/admin-tools:1.24.2
    container_name: temporal-admin-tools
    depends_on:
      temporal:
        condition: service_healthy
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    stdin_open: true
    tty: true
    restart: unless-stopped

  temporal-ui:
    image: temporalio/ui:2.26.2
    container_name: temporal-ui
    depends_on:
      temporal:
        condition: service_healthy
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TEMPORAL_CORS_ORIGINS=http://localhost:8080
    ports:
      - "127.0.0.1:8080:8080"
    restart: unless-stopped

networks:
  default:
    name: temporal-network
EOF

# Create dynamic config directory
mkdir -p /opt/order-processing/temporal/dynamicconfig

# Create dynamic config file
cat > /opt/order-processing/temporal/dynamicconfig/development.yaml << 'EOF'
# Temporal dynamic configuration
system.forceSearchAttributesCacheRefreshOnRead:
  - value: true
    constraints: {}
frontend.enableUpdateWorkflowExecution:
  - value: true
    constraints: {}
EOF

# Create init script for visibility database
mkdir -p /opt/order-processing/temporal/init-db
cat > /opt/order-processing/temporal/init-db/init-visibility.sql << 'EOF'
-- Create visibility database for Temporal
CREATE DATABASE temporal_visibility;
GRANT ALL PRIVILEGES ON DATABASE temporal_visibility TO temporal;
EOF
```

## Step 3: Temporal Server Deployment

```bash
cd /opt/order-processing/temporal

# Create .env file with secrets (get from Key Vault)
cat > .env << 'EOF'
POSTGRES_PASSWORD=your-secure-password-from-keyvault
EOF
chmod 600 .env

# Start Temporal stack
docker-compose up -d

# Verify services are running
docker-compose ps

# Wait for Temporal to be healthy
echo "Waiting for Temporal server to be ready..."
until docker exec temporal-server temporal workflow list --namespace default 2>/dev/null; do
  sleep 5
  echo "Waiting..."
done
echo "Temporal server is ready!"

# Create namespace for order processing
docker exec temporal-admin-tools temporal operator namespace create \
  --namespace order-processing \
  --retention 7d \
  --description "Order Processing Workflow Namespace"
```

## Step 4: Node.js Worker Setup

Deploy the workflow worker application:

```bash
# Navigate to app directory
cd /opt/order-processing/workflow

# Clone or copy application files
# (In CI/CD, this would be done via git clone or artifact download)
rsync -av /data/order-processing/app/services/workflow/ .

# Install dependencies
npm ci --production

# Build TypeScript
npm run build
```

### PM2 Ecosystem Configuration

Create PM2 configuration file:

```bash
cat > /opt/order-processing/workflow/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'workflow-worker',
      script: './dist/worker.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        TEMPORAL_ADDRESS: 'localhost:7233',
        TEMPORAL_NAMESPACE: 'order-processing',
        TEMPORAL_TASK_QUEUE: 'order-processing-queue',
        LOG_LEVEL: 'info'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/workflow-worker-error.log',
      out_file: '/var/log/pm2/workflow-worker-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s'
    },
    {
      name: 'workflow-api',
      script: './dist/api/server.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TEMPORAL_ADDRESS: 'localhost:7233',
        TEMPORAL_NAMESPACE: 'order-processing',
        TEMPORAL_TASK_QUEUE: 'order-processing-queue',
        LOG_LEVEL: 'info'
      },
      error_file: '/var/log/pm2/workflow-api-error.log',
      out_file: '/var/log/pm2/workflow-api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
EOF

# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2
```

## Step 5: Environment Variables

Create environment configuration:

```bash
cat > /opt/order-processing/workflow/.env << 'EOF'
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=order-processing
TEMPORAL_TASK_QUEUE=order-processing-queue

# Service URLs
PARSER_SERVICE_URL=https://op-parser-func.azurewebsites.net/api
COMMITTEE_SERVICE_URL=https://op-committee-func.azurewebsites.net/api
ZOHO_SERVICE_URL=https://op-zoho-func.azurewebsites.net/api
TEAMS_BOT_SERVICE_URL=https://op-teams-bot.azurewebsites.net/api

# Azure Configuration
COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443/
COSMOS_DATABASE_ID=order-processing
COSMOS_KEY=@keyvault/CosmosDbKey
BLOB_STORAGE_CONNECTION_STRING=@keyvault/BlobStorageConnection

# Application Insights (optional)
APPLICATIONINSIGHTS_CONNECTION_STRING=@keyvault/AppInsightsConnectionString

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Worker Configuration
WORKER_MAX_CONCURRENT_ACTIVITIES=50
WORKER_MAX_CACHED_WORKFLOWS=500
EOF

chmod 600 /opt/order-processing/workflow/.env
```

## Step 6: nginx Configuration

Configure nginx as reverse proxy:

```bash
sudo cat > /etc/nginx/sites-available/workflow << 'EOF'
upstream workflow_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream temporal_ui {
    server 127.0.0.1:8080;
    keepalive 8;
}

# Workflow API
server {
    listen 80;
    server_name workflow.your-domain.com;

    # Redirect to HTTPS in production
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://workflow_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /health {
        proxy_pass http://workflow_api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# Temporal UI (internal access only - restrict in production)
server {
    listen 8088;
    server_name localhost;

    # Allow only internal access
    allow 127.0.0.1;
    allow 10.0.0.0/8;
    deny all;

    location / {
        proxy_pass http://temporal_ui;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/workflow /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
sudo systemctl enable nginx
```

## Step 7: Start Services

```bash
# Navigate to workflow directory
cd /opt/order-processing/workflow

# Start PM2 applications
pm2 start ecosystem.config.js

# Save PM2 configuration for auto-restart on reboot
pm2 save

# Set up PM2 startup script
pm2 startup systemd -u $USER --hp /home/$USER
# Run the command that PM2 outputs

# Verify all services are running
pm2 status
docker-compose -f /opt/order-processing/temporal/docker-compose.yml ps
```

## Step 8: Health Check Verification

```bash
#!/bin/bash
# health-check.sh

echo "=== Checking Temporal Server ==="
docker exec temporal-server temporal workflow list --namespace order-processing 2>/dev/null && echo "OK" || echo "FAILED"

echo ""
echo "=== Checking PostgreSQL ==="
docker exec temporal-postgres pg_isready -U temporal && echo "OK" || echo "FAILED"

echo ""
echo "=== Checking Temporal UI ==="
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200" && echo "OK" || echo "FAILED"

echo ""
echo "=== Checking Worker API ==="
curl -s http://localhost:3000/health | jq .

echo ""
echo "=== PM2 Status ==="
pm2 jlist | jq '.[] | {name: .name, status: .pm2_env.status, restarts: .pm2_env.restart_time}'

echo ""
echo "=== Docker Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### API Health Check Endpoints

```bash
# Test workflow API health
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "healthy",
#   "temporal": "connected",
#   "timestamp": "2025-12-26T10:00:00.000Z"
# }

# Test start workflow endpoint
curl -X POST http://localhost:3000/api/workflow/start \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "test-case-123",
    "blobUrl": "https://test.blob.core.windows.net/test.xlsx",
    "tenantId": "tenant-123",
    "userId": "user-123",
    "teams": {
      "chatId": "chat-123",
      "messageId": "msg-123",
      "activityId": "activity-123"
    }
  }'

# Get workflow status
curl http://localhost:3000/api/workflow/test-case-123/status
```

## Step 9: Monitoring Setup

### PM2 Monitoring

```bash
# Real-time logs
pm2 logs

# Monitor dashboard
pm2 monit

# Metrics
pm2 show workflow-worker
```

### Temporal Monitoring

Access Temporal UI at `http://<vm-ip>:8088` (internal only) or via SSH tunnel:

```bash
# SSH tunnel for Temporal UI access
ssh -L 8088:localhost:8088 user@vm-ip
# Then access http://localhost:8088 in browser
```

### Log Aggregation

```bash
# View all logs
tail -f /var/log/pm2/*.log

# View Docker logs
docker-compose -f /opt/order-processing/temporal/docker-compose.yml logs -f
```

## Step 10: CI/CD Configuration (GitHub Actions)

Create `.github/workflows/deploy-workflow.yml`:

```yaml
name: Deploy Workflow Service

on:
  push:
    branches:
      - main
    paths:
      - 'app/services/workflow/**'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: app/services/workflow/package-lock.json

      - name: Install dependencies
        run: |
          cd app/services/workflow
          npm ci

      - name: Build
        run: |
          cd app/services/workflow
          npm run build

      - name: Run tests
        run: |
          cd app/services/workflow
          npm test

      - name: Package application
        run: |
          cd app/services/workflow
          tar -czf ../../../workflow-dist.tar.gz dist package.json package-lock.json ecosystem.config.js

      - name: Deploy to VM
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.VM_HOST }}
          username: ${{ secrets.VM_USER }}
          key: ${{ secrets.VM_SSH_KEY }}
          source: "workflow-dist.tar.gz"
          target: "/tmp"

      - name: Execute deployment
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VM_HOST }}
          username: ${{ secrets.VM_USER }}
          key: ${{ secrets.VM_SSH_KEY }}
          script: |
            cd /opt/order-processing/workflow

            # Backup current deployment
            if [ -d dist ]; then
              mv dist dist.backup.$(date +%Y%m%d%H%M%S)
            fi

            # Extract new deployment
            tar -xzf /tmp/workflow-dist.tar.gz -C .
            rm /tmp/workflow-dist.tar.gz

            # Install production dependencies
            npm ci --production

            # Reload PM2 applications
            pm2 reload ecosystem.config.js --update-env

            # Health check
            sleep 10
            curl -f http://localhost:3000/health || exit 1

            # Cleanup old backups (keep last 5)
            ls -dt dist.backup.* 2>/dev/null | tail -n +6 | xargs rm -rf
```

## Rollback Procedures

### Quick Rollback (PM2)

```bash
cd /opt/order-processing/workflow

# List backups
ls -la dist.backup.*

# Rollback to specific backup
pm2 stop all
mv dist dist.failed
mv dist.backup.YYYYMMDDHHMMSS dist
npm ci --production
pm2 start ecosystem.config.js
pm2 save

# Verify health
curl http://localhost:3000/health
```

### Temporal Server Rollback

```bash
cd /opt/order-processing/temporal

# Stop services
docker-compose down

# Rollback to previous image version
# Edit docker-compose.yml to use previous image tag

# Start services
docker-compose up -d

# Verify
docker-compose ps
```

### Full System Rollback

```bash
#!/bin/bash
# rollback.sh - Full system rollback

set -e

BACKUP_DATE=$1

if [ -z "$BACKUP_DATE" ]; then
  echo "Usage: ./rollback.sh YYYYMMDDHHMMSS"
  exit 1
fi

echo "=== Rolling back to $BACKUP_DATE ==="

# Stop worker
cd /opt/order-processing/workflow
pm2 stop all

# Restore application
if [ -d "dist.backup.$BACKUP_DATE" ]; then
  rm -rf dist
  mv dist.backup.$BACKUP_DATE dist
  npm ci --production
else
  echo "Backup not found: dist.backup.$BACKUP_DATE"
  exit 1
fi

# Restart services
pm2 start ecosystem.config.js

# Health check
sleep 10
curl -f http://localhost:3000/health || {
  echo "Health check failed!"
  exit 1
}

echo "=== Rollback complete ==="
```

### Database Rollback (PostgreSQL)

```bash
# Create backup before major changes
docker exec temporal-postgres pg_dump -U temporal temporal > temporal_backup.sql

# Restore from backup
docker exec -i temporal-postgres psql -U temporal temporal < temporal_backup.sql
```

## Scaling Considerations

### VM Sizing

| Size | vCPU | RAM | Use Case |
|------|------|-----|----------|
| Standard_D2s_v3 | 2 | 8 GB | Dev/Test (10-20 orders/day) |
| Standard_D4s_v3 | 4 | 16 GB | Production (100-200 orders/day) |
| Standard_D8s_v3 | 8 | 32 GB | High volume (500+ orders/day) |

### Worker Scaling

Adjust PM2 instances in `ecosystem.config.js`:

```javascript
{
  name: 'workflow-worker',
  instances: 4,  // Increase for more parallelism
  // ...
}
```

### Temporal Tuning

Edit `/opt/order-processing/temporal/dynamicconfig/development.yaml`:

```yaml
# Increase concurrent activities
worker.maxConcurrentActivityExecutionSize:
  - value: 100
    constraints: {}

# Increase workflow cache
worker.maxConcurrentWorkflowTaskExecutionSize:
  - value: 100
    constraints: {}
```

## Troubleshooting

### Common Issues

1. **Worker not connecting to Temporal**
   ```bash
   # Check Temporal is running
   docker exec temporal-server temporal workflow list

   # Check network connectivity
   nc -zv localhost 7233

   # Check worker logs
   pm2 logs workflow-worker
   ```

2. **PostgreSQL connection issues**
   ```bash
   # Check PostgreSQL is running
   docker exec temporal-postgres pg_isready -U temporal

   # Check logs
   docker logs temporal-postgres
   ```

3. **Workflow not starting**
   ```bash
   # Check namespace exists
   docker exec temporal-admin-tools temporal operator namespace list

   # Check task queue has workers
   docker exec temporal-admin-tools temporal task-queue describe \
     --namespace order-processing \
     --task-queue order-processing-queue
   ```

4. **High memory usage**
   ```bash
   # Check PM2 memory
   pm2 monit

   # Restart workers if needed
   pm2 restart workflow-worker

   # Check Docker memory
   docker stats
   ```

### Debug Commands

```bash
# Temporal CLI - list workflows
docker exec temporal-admin-tools temporal workflow list \
  --namespace order-processing

# Temporal CLI - describe workflow
docker exec temporal-admin-tools temporal workflow describe \
  --namespace order-processing \
  --workflow-id <workflow-id>

# Temporal CLI - show workflow history
docker exec temporal-admin-tools temporal workflow show \
  --namespace order-processing \
  --workflow-id <workflow-id>

# Cancel stuck workflow
docker exec temporal-admin-tools temporal workflow cancel \
  --namespace order-processing \
  --workflow-id <workflow-id>
```

## Security Checklist

- [ ] VM managed identity enabled
- [ ] Key Vault access configured for secrets
- [ ] PostgreSQL password stored in Key Vault
- [ ] nginx configured with SSL/TLS (production)
- [ ] Temporal UI restricted to internal access only
- [ ] SSH key-based authentication only
- [ ] Firewall rules configured (ports 80, 443 only external)
- [ ] PM2 running as non-root user
- [ ] Log files have appropriate permissions
- [ ] Regular security updates scheduled

## Post-Deployment Verification

1. Test workflow start endpoint
2. Verify workflows appear in Temporal UI
3. Check PM2 status shows all processes running
4. Test external event signaling
5. Verify case state updates in Cosmos DB
6. Confirm audit events are logged
7. Test failure scenarios and retries
8. Verify health check endpoints respond correctly
9. Test rollback procedure works

## Support

For issues or questions:
- Check PM2 logs: `pm2 logs`
- Review Temporal UI for workflow state
- Check Docker logs: `docker-compose logs -f`
- Consult Temporal documentation: https://docs.temporal.io
- Review workflow event history in Temporal UI
