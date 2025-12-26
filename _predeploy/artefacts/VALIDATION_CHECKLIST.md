# Validation Checklist

**Last updated:** 2025-12-26
**Purpose:** Verify app registrations, cross-tenant enrollment, and bot functionality before go-live.

---

## Overview

This checklist provides CLI commands and portal verification steps for both Tenant A (hosting) and Tenant B (Teams users). It includes common pitfalls and error patterns.

---

## Part 1: Tenant A Validations (Hosting Tenant)

### 1.1 App Registration Verification

**Azure CLI commands:**

```bash
# Login to Tenant A
az login --tenant <TENANT_A_ID>

# Verify Bot App registration exists
az ad app show --id <BOT_APP_CLIENT_ID> --query "{name:displayName, appId:appId, signInAudience:signInAudience}"

# Expected output should show:
# signInAudience: "AzureADMultipleOrgs" (multi-tenant)

# Verify Tab/API App registration
az ad app show --id <TAB_APP_CLIENT_ID> --query "{name:displayName, appId:appId, signInAudience:signInAudience, identifierUris:identifierUris}"

# Check exposed API scopes
az ad app show --id <TAB_APP_CLIENT_ID> --query "api.oauth2PermissionScopes[].{value:value, adminConsentDisplayName:adminConsentDisplayName}"

# Check app roles defined
az ad app show --id <TAB_APP_CLIENT_ID> --query "appRoles[].{displayName:displayName, value:value}"
```

**Portal verification:**
- [ ] Entra ID > App registrations > Bot App: Supported account types = "Accounts in any organizational directory"
- [ ] Entra ID > App registrations > Tab App: Supported account types = "Accounts in any organizational directory"
- [ ] Tab App > Expose an API: Scope `access_as_user` exists
- [ ] Tab App > App roles: `SalesUser`, `SalesManager`, `OpsAuditor` defined

### 1.2 Azure Bot Resource Verification

```bash
# Verify Azure Bot resource
az bot show --name <BOT_NAME> --resource-group <RG_NAME> --query "{name:name, endpoint:properties.endpoint, msaAppId:properties.msaAppId}"

# Verify Teams channel is enabled
az bot directline show --name <BOT_NAME> --resource-group <RG_NAME>
# Note: Direct check for Teams channel via CLI is limited; verify in portal
```

**Portal verification:**
- [ ] Azure Portal > Azure Bot > Channels: Microsoft Teams channel is enabled and "Running"
- [ ] Azure Portal > Azure Bot > Configuration: Microsoft App ID matches Bot App client ID
- [ ] Azure Portal > Azure Bot > Configuration: Messaging endpoint is correct HTTPS URL

### 1.3 Bot Endpoint Health Check

```bash
# Test bot endpoint is reachable (should return 200 or method not allowed for GET)
curl -I https://<your-function-app>.azurewebsites.net/api/messages

# Expected: HTTP/2 200 or 405 Method Not Allowed (bots expect POST)
```

### 1.4 Key Vault Secrets Verification

```bash
# Login with identity that has access to Key Vault
az login

# List secrets (should include bot and tab credentials)
az keyvault secret list --vault-name <KEYVAULT_NAME> --query "[].name"

# Verify specific secrets exist (don't output values in logs)
az keyvault secret show --vault-name <KEYVAULT_NAME> --name BotAppClientId --query "name"
az keyvault secret show --vault-name <KEYVAULT_NAME> --name TabAppClientId --query "name"
```

### 1.5 Tab Web App Health Check

```bash
# Verify tab is accessible
curl -I https://<your-tab-domain>/

# Expected: HTTP/2 200
```

---

## Part 2: Tenant B Validations (Teams Tenant)

### 2.1 Teams Admin Centre Checks

**Manual verification (no CLI equivalent):**

- [ ] Teams Admin Centre > Teams apps > Manage apps: Sales Order Bot appears as "Custom app"
- [ ] Teams Admin Centre > Teams apps > Permission policies: Custom apps allowed (or specific app allowed)
- [ ] Teams Admin Centre > Teams apps > Org-wide settings: "Allow interaction with custom apps" is On

### 2.2 Enterprise Application (Service Principal) Verification

```bash
# Login to Tenant B
az login --tenant <TENANT_B_ID>

# Check if service principal exists for Tab/API App
az ad sp show --id <TAB_APP_CLIENT_ID> --query "{displayName:displayName, appId:appId}"

# If this returns an error, service principal hasn't been created yet (needs consent)

# Check admin consent status
az ad sp show --id <TAB_APP_CLIENT_ID> --query "appRoleAssignmentRequired"
```

**Portal verification:**
- [ ] Entra ID > Enterprise applications > (search Tab App name): Service principal exists
- [ ] Enterprise application > Permissions: "Grant admin consent" completed (green checkmarks)
- [ ] Enterprise application > Users and groups: App roles assigned

### 2.3 App Role Assignments

```bash
# List app role assignments for the service principal
az ad sp show --id <TAB_APP_CLIENT_ID> --query "appRoles[].{displayName:displayName, value:value, id:id}"

# For detailed role assignments, use Microsoft Graph API or portal
```

**Portal verification:**
- [ ] Enterprise application > Users and groups: Users/groups assigned to SalesUser, SalesManager, OpsAuditor roles

### 2.4 Cross-Tenant Access Settings Check

**Portal verification (if issues):**
- [ ] Entra ID > External Identities > Cross-tenant access settings > Outbound access: Not blocking Tenant A
- [ ] Default settings allow outbound B2B collaboration with external cloud applications

---

## Part 3: End-to-End Functional Tests

### 3.1 Minimal Viable Path (MVP Testing)

Run these tests to verify basic functionality:

| Test | Steps | Expected Result |
|------|-------|-----------------|
| **Bot appears in Teams** | Tenant B user > Apps > Search "Sales Order Bot" | App appears |
| **Bot can be added** | Click Add | App installs, chat opens |
| **Bot responds** | Send "Hello" | Bot acknowledges |
| **File upload works** | Upload .xlsx file | Bot acknowledges receipt |
| **Tab SSO works** | Open personal tab | Tab loads with user context |
| **Tab shows cases** | View "My Cases" | User's cases displayed |

### 3.2 Detailed Test Script

**Test 1: Bot installation and basic response**
```
1. Tenant B user opens Teams
2. Navigate to Apps
3. Search for "Sales Order Bot"
4. Click Add
5. Wait for chat to open
6. Send message: "Hello"
7. Verify bot responds

Pass criteria: Bot responds with acknowledgment
```

**Test 2: File upload handling**
```
1. In bot chat, click attachment icon
2. Select a sample .xlsx order file
3. Send the file
4. Wait for bot response

Pass criteria:
- Bot acknowledges file receipt
- Bot shows processing status
- Bot posts summary card or issues card
```

**Test 3: Tab SSO and case display**
```
1. In Teams, click the Sales Order Bot icon in left rail (if pinned) or find in personal apps
2. Click "My Cases" tab
3. Wait for tab to load

Pass criteria:
- No consent popup (if admin consent granted)
- Tab loads with user's email/name displayed
- Cases list shows (may be empty if no cases yet)
```

**Test 4: Cross-tenant file download (critical path)**
```
1. Upload file in Tenant B Teams chat
2. Monitor bot backend logs

Pass criteria:
- Bot successfully downloads file using Teams attachment URL
- File stored in Blob Storage
- No 403/401 errors in logs
```

### 3.3 Production-Hardened Path (Additional Tests)

| Test | Purpose |
|------|---------|
| **Manager role access** | Verify SalesManager can see team cases |
| **Auditor role access** | Verify OpsAuditor can access all audit bundles |
| **Role denial** | Verify SalesUser cannot access manager features |
| **Certificate auth** | Verify bot works with certificate (not secret) |
| **Token expiry** | Verify token refresh works correctly |
| **Zoho integration** | Verify draft order creation end-to-end |
| **Error handling** | Verify graceful handling of Zoho outage |
| **Audit bundle** | Verify all artefacts stored correctly |

---

## Part 4: Common Pitfalls and Error Patterns

### 4.1 Authentication Errors

| Error Code | Message | Cause | Resolution |
|------------|---------|-------|------------|
| `AADSTS50011` | Invalid reply URL | Redirect URI mismatch | Update redirect URIs in Tab App registration |
| `AADSTS50012` | Invalid client secret | Secret expired or wrong | Rotate secret in Key Vault |
| `AADSTS50013` | Assertion expired | Token lifetime issue | Check server time sync |
| `AADSTS65001` | User does not consent | No consent granted | Grant admin consent or enable user consent |
| `AADSTS70011` | Invalid scope | Scope not exposed | Add scope to "Expose an API" |
| `AADSTS700016` | App not found | App ID wrong or not multi-tenant | Verify app ID; check multi-tenant setting |
| `AADSTS700024` | Client assertion invalid | Certificate issue | Verify certificate in Key Vault matches Entra |
| `AADSTS7000215` | Invalid client secret | Secret wrong or expired | Check Key Vault secret value |
| `AADSTS90094` | Admin consent required | User consent disabled | Admin must grant consent |

### 4.2 Bot Framework Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `BotFrameworkHttpClient: (401) Unauthorized` | Bot credentials invalid | Verify Microsoft App ID and password/cert |
| `Activity id is required` | Malformed request | Check bot endpoint implementation |
| `Endpoint not found (404)` | Wrong messaging endpoint | Verify endpoint in Azure Bot configuration |
| `Service principal not found` | Bot App SP missing in Tenant B | Access bot once to create SP; or admin consent |

### 4.3 Teams-Specific Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| App not visible in Teams | Permission policy blocking | Update permission policy |
| Custom apps disabled | Org setting | Enable in org-wide settings |
| Bot not responding in chat | Bot not running or endpoint wrong | Check Azure Function/Container App status |
| File upload shows error | Bot doesn't support files | Verify `supportsFiles: true` in manifest |
| Tab shows blank page | CSP or CORS issues | Add domain to Content Security Policy |
| Tab SSO popup blocked | Pop-up blocker | Implement silent SSO correctly |

### 4.4 Cross-Tenant Specific Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| "App not available" for Tenant B users | Not enrolled in Tenant B | Admin must upload app package |
| Consent blocked | Cross-tenant access policy | Check outbound access settings |
| Token audience mismatch | Bot not configured multi-tenant | Verify `MicrosoftAppType = MultiTenant` |
| File download fails (403) | Tenant restriction on external access | Implement Graph OBO fallback |
| Tab SSO fails silently | webApplicationInfo.id wrong | Match Tab App client ID |

### 4.5 Tenant Mismatch Debugging

```bash
# Decode a JWT to check tenant and audience claims
# (Use jwt.ms or jwt.io, or CLI tools)

# Example: Check issuer and audience in token
# iss: https://login.microsoftonline.com/{tenant-id}/v2.0
# aud: should match your app client ID

# For bot activities, check activity.channelData.tenant.id
# This tells you which tenant the user is in
```

---

## Part 5: Validation Checklist Summary

### Pre-Deployment Checklist

**Tenant A:**
- [ ] Bot App registration: multi-tenant, credentials in Key Vault
- [ ] Tab App registration: multi-tenant, API exposed, app roles defined
- [ ] Azure Bot: created, Teams channel enabled, endpoint configured
- [ ] Bot endpoint: returns 200/405 on health check
- [ ] Tab web app: accessible via HTTPS
- [ ] Teams app package: created and validated

**Tenant B:**
- [ ] Org-wide settings: custom apps enabled
- [ ] App package: uploaded via Admin Centre
- [ ] Permission policy: allows the custom app
- [ ] Admin consent: granted for Tab App
- [ ] App roles: assigned to users/groups

### Post-Deployment Validation

- [ ] Test user can find and add app
- [ ] Bot responds to messages
- [ ] File upload works and bot processes file
- [ ] Tab loads with SSO (no consent popup)
- [ ] Manager role has correct access
- [ ] Audit bundle is created for processed orders

### Go-Live Criteria

| Criterion | Threshold | Status |
|-----------|-----------|--------|
| Bot responds to messages | 100% success | [ ] |
| File upload works cross-tenant | 100% success | [ ] |
| Tab SSO succeeds | 100% success | [ ] |
| No AADSTS errors in logs | 0 errors | [ ] |
| Zoho draft creation works | 100% success | [ ] |
| Audit bundle complete | 100% of cases | [ ] |

---

## Part 6: Quick Reference Commands

### Tenant A (Azure CLI)

```bash
# Verify bot app registration
az ad app show --id $BOT_APP_CLIENT_ID

# Verify tab app registration
az ad app show --id $TAB_APP_CLIENT_ID

# Check bot resource
az bot show -n $BOT_NAME -g $RG_NAME

# Test endpoint
curl -I https://$FUNCTION_APP.azurewebsites.net/api/messages

# Check Key Vault secrets
az keyvault secret list --vault-name $KEYVAULT_NAME
```

### Tenant B (Azure CLI)

```bash
# Check service principal exists
az ad sp show --id $TAB_APP_CLIENT_ID

# List enterprise apps (requires graph permissions)
az rest --method GET --url "https://graph.microsoft.com/v1.0/servicePrincipals?\$filter=appId eq '$TAB_APP_CLIENT_ID'"
```

### PowerShell (Alternative)

```powershell
# Tenant A
Connect-AzureAD -TenantId $TenantAId
Get-AzureADApplication -Filter "AppId eq '$BotAppClientId'"
Get-AzureADApplication -Filter "AppId eq '$TabAppClientId'"

# Tenant B
Connect-AzureAD -TenantId $TenantBId
Get-AzureADServicePrincipal -Filter "AppId eq '$TabAppClientId'"
```

### Microsoft Graph API

```bash
# Check app roles assigned (Tenant B)
curl -X GET "https://graph.microsoft.com/v1.0/servicePrincipals/{sp-id}/appRoleAssignedTo" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## Part 7: Troubleshooting Decision Tree

```
Issue: App not working
|
+-- App not visible in Teams?
|   +-- Check: Permission policy
|   +-- Check: Org-wide custom apps setting
|   +-- Check: App uploaded in Admin Centre
|
+-- Bot not responding?
|   +-- Check: Messaging endpoint reachable
|   +-- Check: Bot App credentials valid
|   +-- Check: Azure Bot Teams channel enabled
|   +-- Check: Function/Container App running
|
+-- Consent/Auth error?
|   +-- AADSTS error code? (see section 4.1)
|   +-- Check: Admin consent granted
|   +-- Check: Multi-tenant setting on apps
|   +-- Check: Cross-tenant access policies
|
+-- Tab not loading?
|   +-- Check: Tab URL accessible
|   +-- Check: webApplicationInfo in manifest
|   +-- Check: Tab App redirect URIs
|   +-- Check: Authorized client applications
|
+-- File download fails?
    +-- Check: supportsFiles in manifest
    +-- Check: Download URL received in activity
    +-- Fallback: Implement Graph OBO flow
```
