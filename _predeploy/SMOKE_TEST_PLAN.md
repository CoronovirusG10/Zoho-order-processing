# Smoke Test Plan

**Project:** Sales Order Intake Bot
**Last Updated:** 2025-12-26

---

## Overview

This smoke test plan validates core functionality after deployment. Tests are non-destructive and use sandbox/test data.

---

## Prerequisites

- [ ] Application deployed to target environment
- [ ] Test user account in Tenant B with app access
- [ ] Sample Excel order file (valid format)
- [ ] Zoho Books sandbox organization accessible
- [ ] Test customer exists in Zoho sandbox

---

## Test Suite 1: Infrastructure Health

### T1.1 - Function Apps Running

```bash
# Check each function app status
az functionapp show --name order-processing-$ENV-workflow -g order-processing-$ENV-rg --query "state"
az functionapp show --name order-processing-$ENV-parser -g order-processing-$ENV-rg --query "state"
az functionapp show --name order-processing-$ENV-zoho -g order-processing-$ENV-rg --query "state"
```

**Expected:** All return "Running"

### T1.2 - Bot Endpoint Accessible

```bash
curl -I https://<bot-endpoint>/api/messages
```

**Expected:** HTTP 200 or 405 (Method Not Allowed for GET)

### T1.3 - Tab Endpoint Accessible

```bash
curl -I https://<tab-domain>/
```

**Expected:** HTTP 200

### T1.4 - Key Vault Secrets Accessible

```bash
az keyvault secret list --vault-name order-processing-$ENV-kv --query "[].name" -o tsv
```

**Expected:** Lists zoho-client-id, zoho-client-secret, etc.

---

## Test Suite 2: Teams Bot Flow

### T2.1 - Bot Discovery

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Teams as test user | Teams loads |
| 2 | Navigate to Apps | Apps catalog opens |
| 3 | Search "Sales Order" | Bot appears in results |
| 4 | Click Add | Bot installs, chat opens |

### T2.2 - Bot Basic Response

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send "hello" to bot | Bot responds with welcome/help |
| 2 | Send "help" command | Bot shows help message |
| 3 | Send "status" command | Bot shows status (may be empty) |

### T2.3 - File Upload Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click attachment icon | File picker opens |
| 2 | Select sample .xlsx | File attaches |
| 3 | Send message with file | Bot acknowledges receipt |
| 4 | Wait for processing | Bot shows "Processing..." |
| 5 | Processing completes | Bot shows summary card |

**Sample Test File:** Use `app/tests/golden-files/fixtures/valid-order-simple.xlsx`

### T2.4 - Correction Loop (if applicable)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | If issues detected | Bot shows issues card |
| 2 | Click "View Details" | Details expand |
| 3 | Submit corrections | Bot acknowledges |
| 4 | Processing resumes | Updated summary shown |

---

## Test Suite 3: Teams Tab Flow

### T3.1 - Tab SSO

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "My Orders" tab | Tab loads |
| 2 | Observe SSO | No consent popup (if admin consented) |
| 3 | User context shown | User email/name displayed |

### T3.2 - Cases Display

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | After file upload | Case appears in "My Orders" |
| 2 | Click case | Case details open |
| 3 | View timeline | Events listed chronologically |

---

## Test Suite 4: Zoho Integration

### T4.1 - API Connectivity (Non-Destructive)

```bash
# These are GET-only checks - no data modification
curl -X GET "https://www.zohoapis.eu/books/v3/organizations" \
  -H "Authorization: Zoho-oauthtoken $ACCESS_TOKEN"

curl -X GET "https://www.zohoapis.eu/books/v3/contacts?organization_id=$ORG_ID&per_page=1" \
  -H "Authorization: Zoho-oauthtoken $ACCESS_TOKEN"

curl -X GET "https://www.zohoapis.eu/books/v3/items?organization_id=$ORG_ID&per_page=1" \
  -H "Authorization: Zoho-oauthtoken $ACCESS_TOKEN"
```

**Expected:** HTTP 200, valid JSON responses

### T4.2 - Draft Order Creation

**Use sandbox organization only**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload valid order file | Processing completes |
| 2 | Approve in Teams | Draft creation initiated |
| 3 | Check Zoho sandbox | Draft sales order appears |
| 4 | Verify draft status | Status = "Draft" |
| 5 | Delete test draft | Clean up sandbox |

**Test Customer:** Use a designated test customer in sandbox (e.g., "Test Customer - Smoke Test")

---

## Test Suite 5: Audit & Logging

### T5.1 - Correlation ID Tracking

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload file | Note case ID from bot response |
| 2 | Query Log Analytics | Events found with matching traceId |
| 3 | Check blob storage | Audit bundle created in orders-audit |

```bash
# Query Log Analytics
az monitor log-analytics query \
  --workspace order-processing-$ENV-logs \
  --analytics-query "traces | where customDimensions.caseId == '<case-id>' | take 10"
```

### T5.2 - Audit Bundle Verification

```bash
# List blobs in audit container
az storage blob list \
  --container-name orders-audit \
  --account-name orderstor$ENV<suffix> \
  --query "[?contains(name, '<case-id>')].name"
```

**Expected:** Blobs found: `<case-id>/input.xlsx`, `<case-id>/canonical.json`, `<case-id>/committee-result.json`

---

## Test Suite 6: Error Handling

### T6.1 - Invalid File Type

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload .pdf file | Bot rejects with helpful message |
| 2 | Upload .docx file | Bot rejects with helpful message |

### T6.2 - Malformed Excel

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload file with no headers | Bot shows extraction issues |
| 2 | Upload file with formulas | Bot warns about formulas |

### T6.3 - Network Resilience

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Simulate Zoho timeout | Bot shows retry/fail gracefully |
| 2 | Check error logged | Error in Log Analytics with context |

---

## Test Data

### Valid Order File (Minimal)

| Customer | Product | Quantity | Price |
|----------|---------|----------|-------|
| Test Customer - Smoke Test | Widget A | 10 | 25.00 |

**Expected extraction:**
- Customer: "Test Customer - Smoke Test"
- Line items: 1 item
- Total: 250.00

### Test Customer in Zoho Sandbox

- Name: `Test Customer - Smoke Test`
- ID: Document in CONFIG_MATRIX.md
- Contact Type: Customer
- Currency: GBP

---

## Pass/Fail Criteria

| Suite | Pass Threshold |
|-------|----------------|
| T1 Infrastructure | 100% (all checks pass) |
| T2 Teams Bot | 100% (file upload works) |
| T3 Teams Tab | 100% (SSO works) |
| T4 Zoho | 100% (draft creation works) |
| T5 Audit | 100% (correlation works) |
| T6 Error Handling | 80% (graceful failures) |

**Overall:** ALL suites must pass for production go-live.

---

## Smoke Test Execution Log

| Date | Environment | Tester | Suite | Result | Notes |
|------|-------------|--------|-------|--------|-------|
| | | | | | |

---

**Test Plan Version:** 1.0.0
**Last Updated:** 2025-12-26
