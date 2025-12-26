# Troubleshooting Guide

## Overview

This guide covers common issues, error codes, log locations, and correlation ID tracing for the Order Processing application.

## Quick Reference: Error Codes

### Parser Error Codes

| Code | Severity | Description | Resolution |
|------|----------|-------------|------------|
| `FORMULAS_BLOCKED` | blocker | Spreadsheet contains formulas | User must save as values-only |
| `PROTECTED_SHEET` | blocker | Sheet is password protected | User must unprotect and re-upload |
| `NO_SUITABLE_SHEET` | blocker | No sheet with order data found | Verify file contains order data |
| `UNSUPPORTED_FORMAT` | blocker | File is not .xlsx format | Convert to .xlsx |
| `FILE_TOO_LARGE` | blocker | File exceeds 25MB limit | Split into smaller files |
| `NO_HEADER_ROW` | error | Header row not detected | Check file has headers |
| `MISSING_CUSTOMER` | error | Customer name not found | Add customer to spreadsheet |
| `MISSING_QUANTITY` | error | Line missing quantity | Add quantity column |
| `MISSING_ITEM_IDENTIFIER` | error | Line missing SKU and GTIN | Add product identifier |
| `ARITHMETIC_MISMATCH` | warning | Line total mismatch | Review prices/quantities |
| `SUBTOTAL_MISMATCH` | warning | Subtotal doesn't match sum | Check totals |
| `NEGATIVE_QUANTITY` | warning | Negative quantity detected | Verify intentional |

### Zoho Error Codes

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `ZOHO_UNAUTHORIZED` | 401 | Token expired or invalid | System will auto-refresh |
| `ZOHO_FORBIDDEN` | 403 | Insufficient API permissions | Check OAuth scopes |
| `ZOHO_NOT_FOUND` | 404 | Resource not found | Verify entity exists in Zoho |
| `ZOHO_RATE_LIMITED` | 429 | API rate limit exceeded | Auto-retry with backoff |
| `ZOHO_SERVER_ERROR` | 5xx | Zoho server error | Order queued for retry |
| `CUSTOMER_NOT_FOUND` | - | Customer not in Zoho | User must select or create |
| `ITEM_NOT_FOUND` | - | Item/SKU not in Zoho | User must select or create |
| `DUPLICATE_ORDER` | - | Order already exists | Show existing order link |

### Committee Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `NO_CONSENSUS` | Providers disagree | User must resolve conflicts |
| `PROVIDER_TIMEOUT` | Provider didn't respond | Retry with remaining providers |
| `INVALID_RESPONSE` | Provider returned bad JSON | Treated as failed provider |
| `INSUFFICIENT_PROVIDERS` | Too many provider failures | Escalate for investigation |
| `CONFIDENCE_LOW` | All providers low confidence | User must verify mappings |

### Workflow Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `WORKFLOW_TIMEOUT` | Orchestration timed out | Check dependent services |
| `ACTIVITY_FAILED` | Activity function failed | Check activity-specific error |
| `EVENT_TIMEOUT` | Waiting for user input timeout | Case expires after 7 days |
| `INVALID_STATE` | Case in unexpected state | Check case history |

## Common Issues

### Bot Not Responding

**Symptoms**: User uploads file, no response in Teams

**Diagnostic Steps**:

1. Check Azure Bot health:
```bash
az bot show --name order-processing-bot \
  --resource-group order-processing-prod-rg \
  --query "properties.healthState"
```

2. Verify messaging endpoint:
```bash
curl -X POST https://order-processing-api.azurecontainerapps.io/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type": "healthCheck"}'
```

3. Check Function App status:
```bash
az functionapp show --name order-processing-func \
  --resource-group order-processing-prod-rg \
  --query "state"
```

4. Query recent errors:
```kusto
exceptions
| where timestamp > ago(1h)
| where cloud_RoleName contains "bot"
| project timestamp, problemId, outerMessage
| order by timestamp desc
| take 20
```

**Common Solutions**:

- **Restart Function App**: `az functionapp restart --name order-processing-func --resource-group order-processing-prod-rg`
- **Check Bot credentials**: Verify `MicrosoftAppId` and `MicrosoftAppPassword` in Key Vault
- **Review App Insights exceptions**: Look for authentication or connectivity errors

---

### File Download Fails

**Symptoms**: "Unable to download file" error after upload

**Diagnostic Query**:
```kusto
traces
| where timestamp > ago(1h)
| where message contains "download" and severityLevel >= 3
| project timestamp, message, correlationId=customDimensions.correlationId
| order by timestamp desc
```

**Common Causes**:

1. **Download URL expired (>1 hour)**
   - Teams attachment URLs expire
   - Solution: System downloads immediately on receive

2. **Cross-tenant restrictions**
   - File in different tenant than bot
   - Solution: Enable Graph API fallback with OBO token

3. **File too large (>25MB)**
   - Teams attachment limit
   - Solution: Notify user of size limit

4. **Network timeout**
   - Transient connectivity issue
   - Solution: Automatic retry (3 attempts)

**Resolution Commands**:
```bash
# Check case for download status
npm run case:inspect -- --id <case-id> --stage download

# Retry download manually
npm run case:retry-download -- --id <case-id>
```

---

### Parser Blocks File (Formulas)

**Symptoms**: "Formulas detected - file blocked" message

**This is expected behavior** - formulas are blocked by design to prevent manipulation.

**User Instructions**:

1. Open file in Excel
2. Select all cells (Ctrl+A)
3. Copy (Ctrl+C)
4. Paste Special > Values Only (Ctrl+Shift+V)
5. Save and re-upload

**Alternative for Mac**:

1. Open file in Excel
2. Select all (Cmd+A)
3. Copy (Cmd+C)
4. Edit > Paste Special > Values
5. Save and re-upload

**Configurable Override** (not recommended):
```bash
# Disable formula blocking (development only!)
az appconfig kv set --name order-processing-config \
  --key Parser:BlockFormulas --value false --yes
```

---

### Customer Not Found

**Symptoms**: "Unable to resolve customer" issue requiring user selection

**Diagnostic Steps**:

1. Search for customer in Zoho:
```bash
npm run zoho:search -- --type customer --query "ACME"
```

2. Check cache freshness:
```bash
npm run cache:status -- --type customers
# Shows last refresh time and item count
```

3. Test name matching:
```bash
npm run match:test -- --input "ACME Corp" --type customer
# Shows match scores and candidates
```

**Causes and Solutions**:

| Cause | Solution |
|-------|----------|
| Customer doesn't exist in Zoho | Create customer in Zoho Books |
| Name variant not recognized | Add alias to Zoho customer record |
| Cache stale | Refresh cache: `npm run cache:refresh -- --type customers` |
| Fuzzy match threshold too strict | User selects from candidates |

---

### Item Not Found (SKU/GTIN)

**Symptoms**: Line items show "unresolved" status

**Diagnostic Steps**:

1. Search for item in Zoho:
```bash
npm run zoho:search -- --type item --query "ABC-123"
```

2. Check if GTIN custom field exists:
```bash
npm run zoho:check-field -- --name cf_gtin
```

3. Test matching:
```bash
npm run match:test -- --sku "ABC-123" --gtin "5901234123457"
```

**Resolution**:

- **SKU match**: Ensure item exists with exact SKU in Zoho
- **GTIN match**: Populate `cf_gtin` custom field in Zoho item
- **Manual selection**: User picks from candidate items
- **Cache refresh**: `npm run cache:refresh -- --type items`

---

### Committee Disagrees

**Symptoms**: "No consensus" status requiring human input

**This is expected behavior** when AI providers disagree on field mappings.

**Diagnostic Query**:
```kusto
customEvents
| where timestamp > ago(24h)
| where name == "CommitteeVote"
| where customDimensions.consensus == "no_consensus"
| extend field = tostring(customDimensions.field)
| summarize count() by field
| order by count_ desc
```

**Common Patterns**:

| Pattern | Cause | Resolution |
|---------|-------|------------|
| Same field repeatedly | Ambiguous header | Update synonym dictionary |
| New customer template | Unseen format | Add to golden files |
| Mixed languages | Headers in multiple languages | Check language detection |

**If Frequent on Same Field**:

1. Review golden files for that pattern
2. Adjust synonym dictionary in parser config
3. Recalibrate provider weights
4. Consider adding explicit mapping rules

---

### Zoho Draft Creation Fails

**Symptoms**: "Failed to create draft" error

**Diagnostic Query**:
```kusto
dependencies
| where timestamp > ago(1h)
| where name contains "zoho" and success == false
| project timestamp, resultCode, data=customDimensions.responseBody
| order by timestamp desc
```

**Common HTTP Codes**:

| Code | Cause | Action |
|------|-------|--------|
| 429 | Rate limited | Auto-retry with backoff |
| 401 | Token expired | Auto-refresh token |
| 400 | Invalid payload | Check case data for errors |
| 500-504 | Zoho server issue | Order queued for retry |

**Manual Investigation**:
```bash
# Check case payload
npm run case:inspect -- --id <case-id> --stage zoho-payload

# View Zoho API response
npm run case:inspect -- --id <case-id> --stage zoho-response

# Retry creation
npm run case:retry-zoho -- --id <case-id>
```

---

### Duplicate Order Warning

**Symptoms**: "Order may already exist" message

**This is the idempotency check working correctly.**

**Diagnostic Steps**:
```bash
# Check fingerprint
npm run fingerprint:check -- --case-id <case-id>

# View existing order if any
npm run fingerprint:lookup -- --hash <fingerprint-hash>
```

**Resolution Options**:

1. **Legitimate duplicate**: Show existing Zoho order link
2. **False positive**: User confirms this is a new order (creates anyway)
3. **Modified resubmission**: Different file hash = new order allowed

---

## Log Locations

### Application Insights

| Log Type | Table | Query Filter |
|----------|-------|--------------|
| Traces | `traces` | `cloud_RoleName` |
| Exceptions | `exceptions` | `cloud_RoleName` |
| Dependencies | `dependencies` | `name contains "zoho"` |
| Custom Events | `customEvents` | `name` |
| Custom Metrics | `customMetrics` | `name` |

### Azure Storage (Blob)

| Container | Purpose | Retention |
|-----------|---------|-----------|
| `orders-incoming` | Raw uploaded files | 5 years |
| `orders-audit` | Canonical JSON, evidence | 5 years |
| `committee-outputs` | Provider responses | 5 years |
| `zoho-audit-logs` | API request/response logs | 5 years |
| `logs-archive` | Exported diagnostic logs | 5 years |

### Cosmos DB

| Container | Purpose | Partition Key |
|-----------|---------|---------------|
| `cases` | Case state | `/tenantId` |
| `events` | Audit events | `/caseId` |
| `fingerprints` | Idempotency | `/fingerprint` |
| `agentThreads` | Agent state | `/threadId` |

---

## Correlation ID Tracing

### Finding Correlation ID

1. **From Teams message**: Included in all adaptive cards
2. **From case ID**: Case ID = Correlation ID
3. **From API response**: `x-correlation-id` header
4. **From logs**: `correlationId` field in structured logs

### End-to-End Trace Query

```kusto
// Replace <correlation-id> with your ID
let correlationId = "<correlation-id>";

union traces, exceptions, dependencies
| where customDimensions.correlationId == correlationId
   or customDimensions.caseId == correlationId
| project
    timestamp,
    source = cloud_RoleName,
    type = itemType,
    message = coalesce(message, outerMessage, name),
    level = severityLevel
| order by timestamp asc
```

### Trace Through Services

```kusto
// Trace a case through all services
let caseId = "<case-id>";

customEvents
| where customDimensions.caseId == caseId
| project
    timestamp,
    event = name,
    service = cloud_RoleName,
    data = tostring(customDimensions)
| order by timestamp asc
```

### Find Failed Cases

```kusto
// Find cases that failed in the last 24 hours
customEvents
| where timestamp > ago(24h)
| where name == "CaseStatusChanged"
| where customDimensions.newStatus == "failed"
| project
    timestamp,
    caseId = tostring(customDimensions.caseId),
    reason = tostring(customDimensions.reason),
    stage = tostring(customDimensions.stage)
| order by timestamp desc
```

---

## Diagnostic Commands

### Case Inspection

```bash
# View case status and history
npm run case:status -- --id <case-id>

# View full case details
npm run case:inspect -- --id <case-id>

# View audit trail
npm run audit:view -- --case-id <case-id>

# View specific stage output
npm run case:inspect -- --id <case-id> --stage parser
npm run case:inspect -- --id <case-id> --stage committee
npm run case:inspect -- --id <case-id> --stage zoho-payload
```

### Workflow Inspection

```bash
# View workflow instance
npm run workflow:status -- --instance-id <workflow-id>

# Replay workflow from checkpoint
npm run workflow:replay -- --instance-id <workflow-id>

# Terminate stuck workflow
npm run workflow:terminate -- --instance-id <workflow-id> --reason "Manual termination"
```

### Retry Operations

```bash
# Force retry case from current stage
npm run retry:force -- --case-id <case-id>

# Retry specific stage only
npm run retry:stage -- --case-id <case-id> --stage committee

# Process Zoho retry queue
npm run zoho:process-queue
```

### Cache Operations

```bash
# View cache status
npm run cache:status

# Refresh customer cache
npm run cache:refresh -- --type customers

# Refresh item cache
npm run cache:refresh -- --type items

# Clear cache (force reload)
npm run cache:clear -- --type all
```

---

## Health Checks

### Endpoint Health

```bash
# API health
curl https://order-processing-api.azurecontainerapps.io/health

# Bot health
curl https://order-processing-api.azurecontainerapps.io/api/messages/health

# Workflow health
curl https://order-processing-func.azurewebsites.net/api/health
```

### Component Status

```bash
# All components
npm run health:check

# Specific component
npm run health:check -- --component zoho
npm run health:check -- --component committee
npm run health:check -- --component cosmos
```

---

## Escalation Matrix

| Issue Type | L1 | L2 | L3 |
|------------|----|----|-----|
| Bot unresponsive | On-call | Platform | Microsoft |
| Parser errors | On-call | Dev team | - |
| Committee failures | On-call | Dev team | AI provider |
| Zoho API issues | On-call | Platform | Zoho support |
| Data inconsistency | Platform | Security | Management |
| Performance degradation | On-call | Platform | - |
| Security incident | Security | Management | Legal |

### Contact Information

- **On-call rotation**: PagerDuty / #order-processing-oncall
- **Platform team**: #platform-team
- **Dev team**: #order-processing-dev
- **Security**: security@company.com
