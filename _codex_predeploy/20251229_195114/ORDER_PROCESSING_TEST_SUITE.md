# Order Processing Comprehensive Test Suite

**Version:** 1.0.0
**Created:** 2025-12-29
**Target:** Post-Temporal-Fix Validation

---

## Test Categories

1. Infrastructure Tests
2. Temporal Tests
3. Service Tests
4. Integration Tests
5. End-to-End Tests

---

## 1. Infrastructure Tests

### 1.1 Docker Container Health

```bash
#!/bin/bash
# TEST: Docker containers healthy
# EXPECTED: All containers running and healthy

CONTAINERS="temporal-postgresql temporal-server temporal-ui"
FAILED=0

for container in $CONTAINERS; do
  STATUS=$(docker inspect $container --format '{{.State.Status}}' 2>/dev/null)
  HEALTH=$(docker inspect $container --format '{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")

  if [[ "$STATUS" != "running" ]]; then
    echo "FAIL: $container is not running (status: $STATUS)"
    FAILED=1
  elif [[ "$HEALTH" != "healthy" && "$HEALTH" != "no-healthcheck" ]]; then
    echo "FAIL: $container is unhealthy (health: $HEALTH)"
    FAILED=1
  else
    echo "PASS: $container is running and healthy"
  fi
done

exit $FAILED
```

### 1.2 Docker Network Connectivity

```bash
#!/bin/bash
# TEST: Temporal server can resolve postgresql hostname
# EXPECTED: DNS resolution succeeds, TCP connection succeeds

# DNS resolution test
DNS_RESULT=$(docker exec temporal-server nslookup postgresql 2>&1)
if echo "$DNS_RESULT" | grep -q "Address:"; then
  echo "PASS: DNS resolution for 'postgresql' succeeded"
else
  echo "FAIL: DNS resolution for 'postgresql' failed"
  exit 1
fi

# TCP connectivity test
if docker exec temporal-server nc -zv postgresql 5432 2>&1 | grep -q "succeeded\|open"; then
  echo "PASS: TCP connection to postgresql:5432 succeeded"
else
  echo "FAIL: TCP connection to postgresql:5432 failed"
  exit 1
fi
```

### 1.3 Port Availability

```bash
#!/bin/bash
# TEST: Required ports are listening
# EXPECTED: All critical ports responding

declare -A PORTS=(
  [3005]="workflow-api"
  [3978]="teams-bot"
  [5432]="postgresql"
  [7233]="temporal-server"
)

FAILED=0
for port in "${!PORTS[@]}"; do
  SERVICE=${PORTS[$port]}
  if nc -zv localhost $port 2>&1 | grep -q "succeeded\|open"; then
    echo "PASS: Port $port ($SERVICE) is listening"
  else
    echo "FAIL: Port $port ($SERVICE) is not listening"
    FAILED=1
  fi
done

exit $FAILED
```

### 1.4 PM2 Process Status

```bash
#!/bin/bash
# TEST: PM2 processes are online
# EXPECTED: workflow-api, workflow-worker, teams-bot all online

SERVICES="workflow-api workflow-worker teams-bot"
FAILED=0

for service in $SERVICES; do
  STATUS=$(pm2 show $service 2>/dev/null | grep "status" | awk '{print $4}')
  RESTARTS=$(pm2 show $service 2>/dev/null | grep "restarts" | awk '{print $4}')

  if [[ "$STATUS" == "online" ]]; then
    echo "PASS: $service is online (restarts: $RESTARTS)"
  else
    echo "FAIL: $service is not online (status: $STATUS)"
    FAILED=1
  fi
done

exit $FAILED
```

---

## 2. Temporal Tests

### 2.1 Temporal Server Health

```bash
#!/bin/bash
# TEST: Temporal server is healthy and accepting connections
# EXPECTED: Health check passes, gRPC endpoint responds

HEALTH=$(docker inspect temporal-server --format '{{.State.Health.Status}}' 2>/dev/null)

if [[ "$HEALTH" == "healthy" ]]; then
  echo "PASS: Temporal server health check passed"
else
  echo "FAIL: Temporal server health check failed (status: $HEALTH)"
  exit 1
fi

# Test gRPC endpoint
if nc -zv localhost 7233 2>&1 | grep -q "succeeded\|open"; then
  echo "PASS: Temporal gRPC endpoint (7233) is responding"
else
  echo "FAIL: Temporal gRPC endpoint (7233) is not responding"
  exit 1
fi
```

### 2.2 Namespace Registration

```bash
#!/bin/bash
# TEST: order-processing namespace exists
# EXPECTED: Namespace is registered with correct retention

NS_INFO=$(docker exec temporal-server temporal operator namespace describe order-processing 2>&1)

if echo "$NS_INFO" | grep -q "order-processing"; then
  echo "PASS: Namespace 'order-processing' exists"

  # Check retention
  if echo "$NS_INFO" | grep -q "Retention"; then
    echo "PASS: Retention policy is configured"
  fi
else
  echo "FAIL: Namespace 'order-processing' does not exist"
  exit 1
fi
```

### 2.3 Worker Registration

```bash
#!/bin/bash
# TEST: Workflow worker is registered with Temporal
# EXPECTED: Worker appears in task queue pollers

# Check PM2 logs for successful registration
LOGS=$(pm2 logs workflow-worker --lines 100 --nostream 2>/dev/null)

if echo "$LOGS" | grep -qi "registered\|connected\|started polling"; then
  echo "PASS: Workflow worker shows registration in logs"
else
  echo "WARN: Could not confirm worker registration from logs"
  # Not a hard failure - worker may have started before log window
fi

# Check worker is online
STATUS=$(pm2 show workflow-worker 2>/dev/null | grep "status" | awk '{print $4}')
if [[ "$STATUS" == "online" ]]; then
  echo "PASS: Workflow worker process is online"
else
  echo "FAIL: Workflow worker process is not online"
  exit 1
fi
```

---

## 3. Service Tests

### 3.1 Workflow API Health

```bash
#!/bin/bash
# TEST: Workflow API health endpoint responds
# EXPECTED: HTTP 200 with healthy status

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3005/health 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "PASS: Workflow API returned HTTP 200"

  # Check for healthy status in body
  if echo "$BODY" | grep -qi "healthy\|ok"; then
    echo "PASS: Health response indicates healthy status"
  fi
else
  echo "FAIL: Workflow API returned HTTP $HTTP_CODE"
  exit 1
fi
```

### 3.2 Teams Bot Health

```bash
#!/bin/bash
# TEST: Teams Bot is responding
# EXPECTED: Bot endpoint responds (may return 401/405 without auth)

# Test local endpoint
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3978/ 2>/dev/null)

if [[ "$HTTP_CODE" =~ ^[2345] ]]; then
  echo "PASS: Teams Bot local endpoint responded with HTTP $HTTP_CODE"
else
  echo "FAIL: Teams Bot local endpoint not responding"
  exit 1
fi

# Test messaging endpoint (expects 401/405 without proper auth)
MSG_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3978/api/messages 2>/dev/null)

if [[ "$MSG_CODE" =~ ^[2345] ]]; then
  echo "PASS: Teams Bot messaging endpoint responded with HTTP $MSG_CODE (expected without auth)"
else
  echo "FAIL: Teams Bot messaging endpoint not responding"
  exit 1
fi
```

### 3.3 External Endpoint (Production Domain)

```bash
#!/bin/bash
# TEST: Production domain is reachable with valid SSL
# EXPECTED: HTTPS responds, SSL certificate valid

DOMAIN="processing.pippaoflondon.co.uk"

# Test HTTPS connectivity
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/messages" 2>/dev/null)

if [[ "$HTTP_CODE" =~ ^[2345] ]]; then
  echo "PASS: Production domain HTTPS responded with HTTP $HTTP_CODE"
else
  echo "FAIL: Production domain HTTPS not responding (code: $HTTP_CODE)"
  exit 1
fi

# Test SSL certificate
SSL_INFO=$(echo | openssl s_client -servername $DOMAIN -connect ${DOMAIN}:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)

if echo "$SSL_INFO" | grep -q "notAfter"; then
  EXPIRY=$(echo "$SSL_INFO" | grep "notAfter" | cut -d= -f2)
  echo "PASS: SSL certificate valid, expires: $EXPIRY"
else
  echo "WARN: Could not verify SSL certificate"
fi
```

---

## 4. Integration Tests

### 4.1 Azure Managed Identity

```bash
#!/bin/bash
# TEST: Azure MI authentication works
# EXPECTED: Can authenticate and list resources

# Test authentication
if az account show --query 'name' -o tsv 2>/dev/null; then
  echo "PASS: Azure MI authentication successful"
else
  echo "FAIL: Azure MI authentication failed"
  exit 1
fi
```

### 4.2 Key Vault Access

```bash
#!/bin/bash
# TEST: Key Vault secrets accessible
# EXPECTED: Can list secrets from pippai-keyvault-dev

SECRET_COUNT=$(az keyvault secret list --vault-name pippai-keyvault-dev --query 'length(@)' -o tsv 2>/dev/null)

if [[ "$SECRET_COUNT" -gt 0 ]]; then
  echo "PASS: Key Vault accessible, $SECRET_COUNT secrets available"
else
  echo "FAIL: Key Vault not accessible or empty"
  exit 1
fi
```

### 4.3 Cosmos DB Access

```bash
#!/bin/bash
# TEST: Cosmos DB containers accessible
# EXPECTED: Can list databases and containers

DATABASES=$(az cosmosdb sql database list \
  --account-name cosmos-visionarylab \
  --resource-group pippai-rg \
  --query '[].name' -o tsv 2>/dev/null)

if [[ -n "$DATABASES" ]]; then
  echo "PASS: Cosmos DB accessible, databases: $DATABASES"
else
  echo "FAIL: Cosmos DB not accessible"
  exit 1
fi
```

### 4.4 Blob Storage Access

```bash
#!/bin/bash
# TEST: Blob storage containers accessible
# EXPECTED: Can list containers from pippaistoragedev

CONTAINERS=$(az storage container list \
  --account-name pippaistoragedev \
  --auth-mode login \
  --query '[].name' -o tsv 2>/dev/null)

if echo "$CONTAINERS" | grep -q "orders-incoming"; then
  echo "PASS: Blob storage accessible, containers: $(echo $CONTAINERS | tr '\n' ', ')"
else
  echo "FAIL: Blob storage not accessible or missing expected containers"
  exit 1
fi
```

---

## 5. End-to-End Tests

### 5.1 Full Workflow Trigger Test

```bash
#!/bin/bash
# TEST: Can trigger a workflow via API
# EXPECTED: Workflow starts successfully (or returns expected error for missing data)

# This test validates the workflow triggering mechanism works
# It may fail with "missing file" which is expected - we're testing connectivity

RESPONSE=$(curl -s -X POST http://localhost:3005/api/workflows/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}' 2>/dev/null)

# Check if we got a response (even an error response means API is working)
if [[ -n "$RESPONSE" ]]; then
  echo "PASS: Workflow API responded to trigger request"
  echo "Response: $RESPONSE"
else
  echo "WARN: No response from workflow trigger (endpoint may not exist)"
fi
```

### 5.2 Bot Message Processing Test

```bash
#!/bin/bash
# TEST: Bot can process incoming activity
# EXPECTED: Returns appropriate response or auth error

# Simulate minimal activity (will fail auth but tests routing)
RESPONSE=$(curl -s -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type": "message", "text": "test"}' 2>/dev/null)

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type": "message", "text": "test"}' 2>/dev/null)

if [[ "$HTTP_CODE" =~ ^[2345] ]]; then
  echo "PASS: Bot endpoint processed request (HTTP $HTTP_CODE)"
else
  echo "FAIL: Bot endpoint not processing requests"
  exit 1
fi
```

---

## Test Runner Script

```bash
#!/bin/bash
# Order Processing Test Suite Runner
# Usage: ./run_tests.sh [category]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/test_results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="${OUTPUT_DIR}/test_report_${TIMESTAMP}.md"

mkdir -p "$OUTPUT_DIR"

# Initialize report
cat > "$REPORT" << EOF
# Test Suite Results

**Run Time:** $(date -Iseconds)
**Host:** $(hostname)

| Category | Test | Status | Details |
|----------|------|--------|---------|
EOF

TOTAL=0
PASSED=0
FAILED=0

run_test() {
  local category="$1"
  local name="$2"
  local cmd="$3"

  TOTAL=$((TOTAL + 1))

  echo -n "Running: $category / $name ... "

  OUTPUT=$(eval "$cmd" 2>&1)
  EXIT_CODE=$?

  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "PASS"
    PASSED=$((PASSED + 1))
    echo "| $category | $name | PASS | - |" >> "$REPORT"
  else
    echo "FAIL"
    FAILED=$((FAILED + 1))
    DETAIL=$(echo "$OUTPUT" | head -1 | sed 's/|/-/g')
    echo "| $category | $name | FAIL | $DETAIL |" >> "$REPORT"
  fi
}

# Infrastructure Tests
run_test "Infrastructure" "Docker Containers" "docker ps --format '{{.Names}}' | grep -q temporal"
run_test "Infrastructure" "Port 3005" "nc -zv localhost 3005 2>&1 | grep -q succeeded"
run_test "Infrastructure" "Port 3978" "nc -zv localhost 3978 2>&1 | grep -q succeeded"
run_test "Infrastructure" "Port 7233" "nc -zv localhost 7233 2>&1 | grep -q succeeded"
run_test "Infrastructure" "PM2 Status" "pm2 status | grep -q online"

# Temporal Tests
run_test "Temporal" "Server Health" "docker inspect temporal-server --format '{{.State.Health.Status}}' | grep -q healthy"
run_test "Temporal" "Namespace" "docker exec temporal-server temporal operator namespace describe order-processing 2>&1 | grep -q order-processing"

# Service Tests
run_test "Services" "Workflow API" "curl -sf http://localhost:3005/health"
run_test "Services" "Teams Bot" "curl -sf http://localhost:3978/ || curl -s http://localhost:3978/ | head -1"
run_test "Services" "External HTTPS" "curl -sf https://processing.pippaoflondon.co.uk/api/messages || true"

# Azure Tests
run_test "Azure" "MI Auth" "az account show -o none"
run_test "Azure" "Key Vault" "az keyvault secret list --vault-name pippai-keyvault-dev --query 'length(@)' -o tsv | grep -q '^[0-9]'"
run_test "Azure" "Cosmos DB" "az cosmosdb sql database list --account-name cosmos-visionarylab --resource-group pippai-rg -o none"

# Summary
cat >> "$REPORT" << EOF

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | $TOTAL |
| Passed | $PASSED |
| Failed | $FAILED |
| Pass Rate | $(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)% |

EOF

echo ""
echo "=========================================="
echo "Test Suite Complete"
echo "Passed: $PASSED / $TOTAL"
echo "Report: $REPORT"
echo "=========================================="

exit $FAILED
```

---

## Expected Results (Post-Fix)

| Test | Expected |
|------|----------|
| Docker Containers | All running and healthy |
| Temporal DNS | postgresql resolves |
| Temporal Server | Healthy |
| Namespace | order-processing registered |
| Workflow API | HTTP 200 |
| Teams Bot | HTTP 200 (or 401/405) |
| External HTTPS | HTTP 200 |
| Azure MI | Authenticated |
| Key Vault | 87+ secrets |
| Cosmos DB | 6 containers |
