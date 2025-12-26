# Runbook: Zoho API Outage

## Overview

This runbook covers detection, response, and recovery procedures for Zoho Books API unavailability. The system is designed to gracefully handle outages by queuing orders for later processing.

## Severity Levels

| Level | Condition | Response Time |
|-------|-----------|---------------|
| SEV-1 | Complete Zoho unavailability, >50 orders queued | 15 minutes |
| SEV-2 | Partial degradation, elevated error rate | 1 hour |
| SEV-3 | Intermittent issues, auto-retry handling | 4 hours |

## Symptoms

### User-Facing

- Users see "Order queued - Zoho temporarily unavailable" messages
- Approval confirmations delayed
- No Zoho sales order links in success cards

### System Indicators

- HTTP 5xx errors from Zoho API calls
- Retry queue depth increasing
- `ZohoApiErrors` alert triggered
- Elevated latency on sales order creation

## Detection

### Application Insights Queries

#### Error Rate (Last Hour)

```kusto
dependencies
| where timestamp > ago(1h)
| where name contains "zoho" and success == false
| summarize ErrorCount=count(), ErrorRate=count()*100.0/toscalar(
    dependencies | where timestamp > ago(1h) | where name contains "zoho" | count()
  ) by resultCode, bin(timestamp, 5m)
| order by timestamp desc
```

#### Retry Queue Depth

```kusto
customMetrics
| where timestamp > ago(1h)
| where name == "ZohoRetryQueueDepth"
| summarize AvgDepth=avg(value), MaxDepth=max(value) by bin(timestamp, 5m)
| order by timestamp desc
```

#### Latency Distribution

```kusto
dependencies
| where timestamp > ago(1h)
| where name contains "zoho" and success == true
| summarize p50=percentile(duration, 50), p95=percentile(duration, 95), p99=percentile(duration, 99) by bin(timestamp, 5m)
```

### Configured Alerts

| Alert Name | Condition | Threshold |
|------------|-----------|-----------|
| `ZohoApiErrors` | Failed requests/hour | > 10 |
| `ZohoRetryQueueHigh` | Queue depth | > 25 |
| `ZohoLatencyHigh` | P95 latency | > 5000ms |
| `ZohoRateLimited` | 429 responses/hour | > 20 |

## Immediate Actions

### 1. Confirm Outage Scope

#### Check Zoho Status Page

```bash
# Check Zoho EU status
curl -s https://status.zoho.eu | grep -i "books"

# Check specific regions
curl -s https://status.zoho.com  # US
curl -s https://status.zoho.in   # India
curl -s https://status.zoho.com.au  # Australia
```

#### Test API Directly

```bash
# Get access token from Key Vault
ACCESS_TOKEN=$(az keyvault secret show \
  --vault-name order-processing-kv \
  --name zoho-access-token \
  --query value -o tsv)

ORG_ID=$(az keyvault secret show \
  --vault-name order-processing-kv \
  --name zoho-organization-id \
  --query value -o tsv)

# Test organizations endpoint (lightweight)
curl -w "\nHTTP Status: %{http_code}\nTotal time: %{time_total}s\n" \
  -X GET "https://www.zohoapis.eu/books/v3/organizations" \
  -H "Authorization: Zoho-oauthtoken $ACCESS_TOKEN"

# Test items endpoint
curl -w "\nHTTP Status: %{http_code}\n" \
  -X GET "https://www.zohoapis.eu/books/v3/items?organization_id=$ORG_ID" \
  -H "Authorization: Zoho-oauthtoken $ACCESS_TOKEN"
```

### 2. Enable Queue-Only Mode

The system automatically queues failed requests, but you can force queue mode to prevent repeated failures:

```bash
# Enable queue-only mode
az appconfig kv set --name order-processing-config \
  --key FeatureFlags:ZohoQueueOnlyMode --value true \
  --yes

# Verify setting
az appconfig kv show --name order-processing-config \
  --key FeatureFlags:ZohoQueueOnlyMode
```

**Effect**: All new orders will be queued immediately without attempting Zoho API calls.

### 3. Notify Users

Update the bot message template to inform users:

```bash
# Set outage notification message
az appconfig kv set --name order-processing-config \
  --key Messages:ZohoOutageNotice \
  --value "Orders are being queued due to Zoho Books maintenance. Your order will be created automatically when service resumes. Reference: {caseId}" \
  --yes
```

### 4. Notify Stakeholders

- Post in #order-processing-alerts Slack/Teams channel
- Update status page if customer-facing
- Email stakeholders for extended outages (>1 hour)

## Impact Assessment

### Affected Cases Query

```kusto
// Cases affected during outage
customEvents
| where timestamp > ago(4h)
| where name in ("ZohoCreateFailed", "ZohoOrderQueued")
| summarize
    FailedCount=countif(name == "ZohoCreateFailed"),
    QueuedCount=countif(name == "ZohoOrderQueued")
  by bin(timestamp, 15m)
| order by timestamp desc
```

### Queue Status

```bash
# Check current queue depth
npm run zoho:queue-status

# Or query directly
az cosmosdb sql query \
  --account-name order-processing-cosmos \
  --database-name order-processing \
  --container-name zoho-retry-queue \
  --query "SELECT c.status, COUNT(1) as count FROM c GROUP BY c.status"
```

## Recovery

### 1. Verify Zoho is Back

```bash
# Comprehensive health check
curl -X GET "https://www.zohoapis.eu/books/v3/items?organization_id=$ORG_ID&per_page=1" \
  -H "Authorization: Zoho-oauthtoken $ACCESS_TOKEN" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"

# Check for rate limiting headers
curl -I "https://www.zohoapis.eu/books/v3/items?organization_id=$ORG_ID" \
  -H "Authorization: Zoho-oauthtoken $ACCESS_TOKEN" 2>&1 | grep -i "rate\|limit\|retry"
```

### 2. Disable Queue-Only Mode

```bash
az appconfig kv set --name order-processing-config \
  --key FeatureFlags:ZohoQueueOnlyMode --value false \
  --yes
```

### 3. Process Retry Queue

The retry job runs automatically every 5 minutes, but you can trigger manual processing:

```bash
# Trigger queue processor function
az functionapp function invoke \
  --name order-processing-func \
  --function-name ProcessZohoRetryQueue \
  --resource-group order-processing-prod-rg

# Monitor progress
az functionapp log tail \
  --name order-processing-func \
  --resource-group order-processing-prod-rg \
  --filter "ZohoRetry"
```

#### Controlled Processing (Recommended)

For large queues, process in batches to avoid rate limiting:

```bash
# Process 10 items at a time with 5-second delay
npm run zoho:process-queue -- --batch-size 10 --delay 5000

# Process only items failed before a specific time
npm run zoho:process-queue -- --failed-before "2025-12-26T10:00:00Z"
```

### 4. Clear Outage Notification

```bash
az appconfig kv delete --name order-processing-config \
  --key Messages:ZohoOutageNotice \
  --yes
```

### 5. Verify Orders Created

```kusto
// Successful orders after recovery
customEvents
| where timestamp > ago(4h)
| where name == "ZohoOrderCreated"
| summarize count() by bin(timestamp, 15m)
| render timechart

// Compare queued vs created
customEvents
| where timestamp > ago(4h)
| where name in ("ZohoOrderQueued", "ZohoOrderCreated")
| summarize count() by name, bin(timestamp, 15m)
| render timechart
```

### 6. Reconcile Orders

After recovery, verify all queued orders were processed:

```bash
# Generate reconciliation report
npm run zoho:reconcile -- --from "2025-12-26T08:00:00Z" --to "2025-12-26T12:00:00Z"

# Output includes:
# - Orders successfully created
# - Orders still in queue
# - Orders permanently failed
# - Mismatches between queue and Cosmos DB
```

## Rollback Procedures

### If Recovery Causes Issues

```bash
# Re-enable queue-only mode immediately
az appconfig kv set --name order-processing-config \
  --key FeatureFlags:ZohoQueueOnlyMode --value true --yes

# Pause queue processor
az appconfig kv set --name order-processing-config \
  --key FeatureFlags:ZohoRetryProcessorEnabled --value false --yes
```

### If Token Refresh Failed During Outage

```bash
# Force token refresh
npm run zoho:refresh-token

# Or manually update in Key Vault
az keyvault secret set \
  --vault-name order-processing-kv \
  --name zoho-refresh-token \
  --value "<new-refresh-token>"

# Restart functions to pick up new token
az functionapp restart --name order-processing-func \
  --resource-group order-processing-prod-rg
```

## Post-Incident

### 1. Document Impact

- Outage duration (start time, detection time, resolution time)
- Number of orders affected
- User complaints received
- Business impact (delayed orders, SLA breaches)

### 2. Update Metrics

```bash
# Log incident to metrics
npm run ops:log-incident -- \
  --type "zoho-outage" \
  --start "2025-12-26T08:00:00Z" \
  --end "2025-12-26T10:30:00Z" \
  --orders-affected 47 \
  --notes "Zoho EU datacenter maintenance"
```

### 3. Review and Improve

- [ ] Were alerts triggered appropriately?
- [ ] Was detection time acceptable?
- [ ] Did queue-only mode engage automatically?
- [ ] Any orders permanently lost?
- [ ] Update runbook with lessons learned

## Escalation Path

| Level | Contact | When |
|-------|---------|------|
| L1 | On-call engineer | Initial response |
| L2 | Platform team lead | >1 hour, >50 orders affected |
| L3 | Zoho support | Confirmed Zoho-side issue |
| Exec | CTO/VP Engineering | >4 hours, business impact |

### Zoho Support Contact

- **Portal**: https://help.zoho.eu/portal/en/home
- **Email**: support@zohobooks.com
- **Region**: EU (for GDPR compliance)

## Appendix: Error Codes

| HTTP Code | Zoho Code | Meaning | Action |
|-----------|-----------|---------|--------|
| 401 | - | Token expired | Refresh token |
| 403 | - | Insufficient permissions | Check API scopes |
| 429 | - | Rate limited | Backoff and retry |
| 500 | - | Server error | Retry with backoff |
| 502 | - | Bad gateway | Retry |
| 503 | - | Service unavailable | Queue and wait |
| 504 | - | Gateway timeout | Retry |
| 400 | 1000 | Invalid input | Check payload |
| 400 | 2000 | Customer not found | Verify customer ID |
| 400 | 3000 | Item not found | Verify item ID |
