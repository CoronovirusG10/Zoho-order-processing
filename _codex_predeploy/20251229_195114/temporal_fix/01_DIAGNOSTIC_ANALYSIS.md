# Temporal Docker Infrastructure Diagnostic Analysis

**Date:** 2025-12-29
**Working Directory:** /data/order-processing
**Status:** CRITICAL - Multiple infrastructure issues identified

---

## Executive Summary

The Temporal infrastructure has **two critical issues** preventing proper operation:

1. **PRIMARY ISSUE:** DNS resolution failure in `temporal-server` container due to misconfigured `dns` directive
2. **SECONDARY ISSUE:** Port 8080 conflict preventing `temporal-ui` from binding to host

---

## Issue #1: DNS Resolution Failure (CRITICAL)

### Symptoms

- `temporal-server` container status: **unhealthy**
- Container logs show continuous loop: `nc: bad address 'postgresql'` / `Waiting for PostgreSQL to startup.`
- Hostname `postgresql` cannot be resolved inside the container
- Health check failing: `tctl --address temporal:7233 cluster health`

### Root Cause

The `docker-compose.temporal.yml` file contains an **explicit DNS override** that breaks Docker's embedded DNS:

```yaml
temporal:
  dns:
    - 127.0.0.11
```

**Why this breaks things:**

1. Docker's embedded DNS server runs at `127.0.0.11` and handles container-to-container name resolution
2. When you **explicitly set** `dns: 127.0.0.11`, Docker interprets this as "use a DNS server at this IP"
3. Inside the container, there is **no DNS server running at 127.0.0.11** (it's a container-local loopback)
4. Docker's embedded DNS magic only works when you **don't** specify a custom DNS

**Evidence:**

| Test | Result |
|------|--------|
| `nslookup postgresql` | `Connection refused` to 127.0.0.1 |
| `ping postgresql` | `bad address 'postgresql'` |
| `nc -zv postgresql 5432` | `bad address 'postgresql'` |
| `nc -zv 172.19.0.2 5432` | **SUCCESS** - Port open |

This confirms the network path is fine; only DNS resolution is broken.

### Evidence from Container Inspection

```bash
$ docker inspect temporal-server --format '{{json .HostConfig.Dns}}'
["127.0.0.11"]
```

The DNS override is active and causing the failure.

### Solution

**Remove the `dns` directive entirely.** Docker's default behavior handles container DNS correctly.

```yaml
# BEFORE (broken)
temporal:
  dns:
    - 127.0.0.11
  environment:
    - POSTGRES_SEEDS=postgresql

# AFTER (fixed)
temporal:
  # dns directive REMOVED - let Docker handle DNS automatically
  environment:
    - POSTGRES_SEEDS=postgresql
```

---

## Issue #2: Port 8080 Conflict (SECONDARY)

### Symptoms

- `temporal-ui` container shows no port mappings despite being configured for port 8080
- Port 8080 is occupied by `pippai-help` container

### Evidence

```bash
$ docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep 8080
temporal-ui           [empty - no ports]
pippai-help           0.0.0.0:8080->80/tcp, [::]:8080->80/tcp
```

### Root Cause

Two containers are competing for port 8080:

| Container | Configured Binding | Actual Result |
|-----------|-------------------|---------------|
| `pippai-help` | `0.0.0.0:8080->80` | **Bound** (started first) |
| `temporal-ui` | `127.0.0.1:8080->8080` | **Failed** (port in use) |

Since `pippai-help` binds to `0.0.0.0:8080`, it claims ALL interfaces including `127.0.0.1`, blocking `temporal-ui`.

### Solution Options

**Option A: Change temporal-ui to different port (Recommended)**

```yaml
temporal-ui:
  ports:
    - "127.0.0.1:8088:8080"  # Use 8088 instead
```

**Option B: Change pippai-help to localhost-only**

```yaml
# In pippai-help docker-compose
ports:
  - "127.0.0.1:8080:80"  # Bind only to localhost
```

**Option C: Stop pippai-help before starting temporal stack**

```bash
docker stop pippai-help
cd /data/order-processing/app/services/workflow
docker compose -f docker-compose.temporal.yml up -d
```

---

## Container Status Summary

| Container | Status | Health | Issue |
|-----------|--------|--------|-------|
| `temporal-postgresql` | Up | **healthy** | None |
| `temporal-server` | Up | **unhealthy** | DNS resolution broken |
| `temporal-ui` | Up | N/A | Port binding failed |

---

## Network Topology

```
temporal-network (172.19.0.0/16)
├── temporal-postgresql (172.19.0.2)
│   ├── DNS aliases: postgresql, temporal-postgresql
│   └── Ports: 127.0.0.1:5432->5432/tcp
├── temporal-server (172.19.0.3)
│   ├── DNS aliases: temporal, temporal-server
│   ├── Ports: 127.0.0.1:7233->7233/tcp
│   └── Links: temporal-postgresql:postgresql
└── temporal-ui (172.19.0.x)
    ├── Ports: FAILED (8080 conflict)
    └── Connects to: temporal:7233
```

---

## Recommended Fix Approach

### Step 1: Fix docker-compose.temporal.yml

```yaml
version: '3.8'

services:
  postgresql:
    # ... (unchanged)

  temporal:
    image: temporalio/auto-setup:latest
    container_name: temporal-server
    restart: unless-stopped
    depends_on:
      postgresql:
        condition: service_healthy
    links:
      - postgresql
    # REMOVED: dns: - 127.0.0.11   <-- This was the bug
    environment:
      - DB=postgres12
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=${TEMPORAL_DB_PASSWORD:-temporal_password}
      - POSTGRES_SEEDS=postgresql
      - DYNAMIC_CONFIG_FILE_PATH=config/dynamicconfig/development-sql.yaml
    ports:
      - "127.0.0.1:7233:7233"
    healthcheck:
      test: ["CMD", "tctl", "--address", "temporal:7233", "cluster", "health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      temporal-network:
        aliases:
          - temporal

  temporal-ui:
    image: temporalio/ui:latest
    container_name: temporal-ui
    restart: unless-stopped
    depends_on:
      - temporal
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TEMPORAL_CORS_ORIGINS=http://localhost:3000
    ports:
      - "127.0.0.1:8088:8080"  # Changed from 8080 to 8088
    networks:
      temporal-network:
        aliases:
          - temporal-ui

networks:
  temporal-network:
    driver: bridge
    name: temporal-network
```

### Step 2: Restart Temporal Stack

```bash
cd /data/order-processing/app/services/workflow

# Stop existing containers
docker compose -f docker-compose.temporal.yml down

# Start fresh
docker compose -f docker-compose.temporal.yml up -d

# Verify health
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep temporal
```

### Step 3: Verify Fix

```bash
# Check DNS resolution works
docker exec temporal-server nslookup postgresql

# Check connectivity
docker exec temporal-server nc -zv postgresql 5432

# Check health status
docker inspect temporal-server --format '{{.State.Health.Status}}'

# Check temporal-ui port binding
curl -s http://127.0.0.1:8088 | head -5
```

---

## Alternative Quick Fix (Without Config Change)

If you need to get Temporal working immediately without modifying the compose file:

```bash
# Stop the broken temporal-server
docker stop temporal-server

# Start with IP address instead of hostname (workaround)
docker run -d --name temporal-server-temp \
  --network temporal-network \
  -e DB=postgres12 \
  -e DB_PORT=5432 \
  -e POSTGRES_USER=temporal \
  -e POSTGRES_PWD=temporal_password \
  -e POSTGRES_SEEDS=172.19.0.2 \
  -p 127.0.0.1:7233:7233 \
  temporalio/auto-setup:latest
```

**Note:** This is a temporary workaround. The IP address may change on container restart. Fix the compose file for a permanent solution.

---

## Verification Commands

After applying fixes, run these commands to verify:

```bash
# 1. Verify temporal-server health
docker inspect temporal-server --format '{{.State.Health.Status}}'
# Expected: healthy

# 2. Verify DNS resolution
docker exec temporal-server nslookup postgresql
# Expected: Address: 172.19.0.2

# 3. Verify gRPC endpoint
docker exec temporal-server tctl --address temporal:7233 cluster health
# Expected: SERVING

# 4. Verify UI accessible
curl -s http://127.0.0.1:8088 | grep -o '<title>.*</title>'
# Expected: <title>Temporal UI</title>

# 5. Check all containers healthy
docker compose -f docker-compose.temporal.yml ps
# Expected: All services "healthy" or "Up"
```

---

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| DNS failure | Explicit `dns: 127.0.0.11` breaks Docker DNS | Remove `dns` directive |
| Port conflict | pippai-help on 0.0.0.0:8080 | Change temporal-ui to port 8088 |

**Priority:** Fix Issue #1 first (DNS) as it's the primary blocker. Issue #2 only affects the UI dashboard.
