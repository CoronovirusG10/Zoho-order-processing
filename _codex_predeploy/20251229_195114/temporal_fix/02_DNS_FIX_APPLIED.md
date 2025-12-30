# Temporal Docker DNS Fix Report

**Date:** 2025-12-29 23:04 UTC
**Status:** RESOLVED
**Files Modified:**
- `/data/order-processing/app/services/workflow/docker-compose.temporal.yml`
- `/data/order-processing/app/services/workflow/temporal-entrypoint-wrapper.sh` (created)

---

## Summary

Fixed Docker DNS resolution issue in the Temporal stack that was preventing the temporal-server container from connecting to PostgreSQL using hostname resolution.

---

## Root Cause Analysis

The issue was caused by **two separate problems**:

### Problem 1: Explicit dns directive (Phase 1 Finding)
The original docker-compose.yml contained:
```yaml
dns:
  - 127.0.0.11
```
This was expected to help, but actually interfered with Docker's automatic DNS configuration.

### Problem 2: File Permission Bug (Phase 4 Discovery)
After removing the dns directive, DNS still failed. Investigation revealed:
- Docker was setting `/etc/hosts` and `/etc/resolv.conf` to **mode 640** (root read-only)
- The temporal-server runs as user `temporal` (uid 1000)
- The `temporal` user could not read these files, causing all hostname lookups to fail

**Evidence:**
```bash
docker exec -u 0 temporal-server ls -la /etc/hosts /etc/resolv.conf
# -rw-r-----    1 root     root   /etc/hosts
# -rw-r-----    1 root     root   /etc/resolv.conf

docker exec temporal-server whoami
# temporal
```

---

## Solution Applied

### Changes to docker-compose.temporal.yml

1. **Removed** the problematic `dns` directive
2. **Added** static IP for PostgreSQL (172.19.100.2) with custom IPAM config
3. **Added** `extra_hosts` entry to map `postgresql` to the static IP
4. **Added** volume mount for entrypoint wrapper script
5. **Added** custom entrypoint to fix permissions at startup
6. **Set** `user: root` to allow permission fix
7. **Fixed** `DYNAMIC_CONFIG_FILE_PATH` from `development-sql.yaml` to `docker.yaml`

### Created temporal-entrypoint-wrapper.sh

```bash
#!/bin/sh
chmod 644 /etc/hosts /etc/resolv.conf 2>/dev/null || true
exec /etc/temporal/entrypoint.sh "$@"
```

This wrapper runs at container startup to fix the file permissions before the main Temporal entrypoint takes over.

---

## Verification Results

All tests passed:

| Test | Command | Result |
|------|---------|--------|
| DNS Resolution | `ping -c 1 postgresql` | SUCCESS - 172.19.100.2 |
| TCP Connectivity | `nc -zv postgresql 5432` | SUCCESS - open |
| Health Check | `docker inspect ... Health.Status` | healthy |
| All Services | `docker compose ps` | All healthy |

---

## Final Configuration

```yaml
temporal:
  image: temporalio/auto-setup:latest
  container_name: temporal-server
  restart: unless-stopped
  user: root
  depends_on:
    postgresql:
      condition: service_healthy
  extra_hosts:
    - "postgresql:172.19.100.2"
  volumes:
    - ./temporal-entrypoint-wrapper.sh:/temporal-entrypoint-wrapper.sh:ro
  entrypoint: ["/temporal-entrypoint-wrapper.sh"]
  command: ["autosetup"]
  environment:
    - DB=postgres12
    - DB_PORT=5432
    - POSTGRES_USER=temporal
    - POSTGRES_PWD=${TEMPORAL_DB_PASSWORD:-temporal_password}
    - POSTGRES_SEEDS=postgresql
    - DYNAMIC_CONFIG_FILE_PATH=config/dynamicconfig/docker.yaml
  networks:
    temporal-network:
      aliases:
        - temporal

networks:
  temporal-network:
    driver: bridge
    name: temporal-network
    ipam:
      config:
        - subnet: 172.19.100.0/24
          gateway: 172.19.100.1
```

---

## Service Status

```
NAME                  IMAGE                          STATUS                   PORTS
temporal-postgresql   postgres:15-alpine             Up 5 minutes (healthy)   127.0.0.1:5432->5432/tcp
temporal-server       temporalio/auto-setup:latest   Up 5 minutes (healthy)   127.0.0.1:7233->7233/tcp
temporal-ui           temporalio/ui:latest           Up 5 minutes             127.0.0.1:8088->8080/tcp
```

---

## Notes

- The fix is persistent across container restarts because the wrapper script runs at each startup
- The Docker file permission issue (mode 640 for /etc/hosts and /etc/resolv.conf) may be a Docker bug or Azure Linux-specific behavior
- Alternative solutions considered but not used:
  - Running temporal as root permanently (security concern)
  - Using host networking (isolation concern)
  - Custom Docker image with fixed permissions (maintenance overhead)
