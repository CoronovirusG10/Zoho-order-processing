# Infrastructure Tests Report

**Test Suite:** Order Processing v2 - Infrastructure Tests
**Generated:** 2025-12-29 23:58:55

---

## Test Results

### 1.1 Container Health Tests

[2025-12-29 23:58:55] [CONTAINER_HEALTH_temporal-postgresql] [RESULT: PASS]
  Container: temporal-postgresql\nStatus: running\nHealth: healthy

[2025-12-29 23:58:55] [CONTAINER_HEALTH_temporal-server] [RESULT: PASS]
  Container: temporal-server\nStatus: running\nHealth: healthy

[2025-12-29 23:58:55] [CONTAINER_HEALTH_temporal-ui] [RESULT: WARN]
  Container: temporal-ui\nStatus: running\nHealth: 
  no-healthcheck

### 1.2 Docker DNS Resolution Tests

[2025-12-29 23:58:55] [DNS_GETENT_HOSTS] [RESULT: PASS]
  172.19.100.2      postgresql  postgresql

[2025-12-29 23:58:55] [DNS_PING_POSTGRESQL] [RESULT: PASS]
  PING postgresql (172.19.100.2): 56 data bytes
  64 bytes from 172.19.100.2: seq=0 ttl=64 time=0.059 ms

### 1.3 Docker TCP Connectivity Tests

[2025-12-29 23:58:55] [TCP_POSTGRESQL_5432] [RESULT: PASS]
  postgresql (172.19.100.2:5432) open

### 1.4 Port Availability Tests

[2025-12-29 23:58:55] [PORT_AVAILABLE_3005] [RESULT: PASS]
  Connection to localhost (127.0.0.1) 3005 port [tcp/*] succeeded!

[2025-12-29 23:58:55] [PORT_AVAILABLE_3978] [RESULT: PASS]
  Connection to localhost (127.0.0.1) 3978 port [tcp/*] succeeded!

[2025-12-29 23:58:55] [PORT_AVAILABLE_7233] [RESULT: PASS]
  Connection to localhost (127.0.0.1) 7233 port [tcp/*] succeeded!

[2025-12-29 23:58:55] [PORT_AVAILABLE_8088] [RESULT: PASS]
  Connection to localhost (127.0.0.1) 8088 port [tcp/omniorb] succeeded!

### 1.5 PM2 Status Tests

[2025-12-29 23:58:55] [PM2_STATUS] [RESULT: WARN]
  High restart count services: workflow-worker
  workflow-worker\nworkflow-api: status=online, restarts=1
  workflow-api: status=online, restarts=1
  workflow-worker: status=online, restarts=15
  workflow-worker: status=online, restarts=15
  teams-bot: status=online, restarts=0

---

## Summary

| Result | Count |
|--------|-------|
| PASS   | 9 |
| FAIL   | 0 |
| WARN   | 2 |
| **Total** | 11 |

---
**Test execution completed at:** 2025-12-29 23:58:55
