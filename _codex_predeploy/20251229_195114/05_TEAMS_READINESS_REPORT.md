# 05 - Teams Readiness Report

**Run ID:** 20251229_195114
**Generated:** 2025-12-29T21:36:00Z
**Status:** READY (VM/Code side)

---

## Executive Summary

The VM-side Teams integration infrastructure is **fully operational**. The bot service is running, the messaging endpoint is accessible, and the Teams app package is ready for deployment.

**Next Step:** Complete manual steps in Pippa of London tenant (see Manual Steps section below).

---

## 1. Teams App Artifacts Verification

### Manifest Status: VALID

| Check | Status | Details |
|-------|--------|---------|
| Manifest location | OK | `/data/order-processing/_codex_predeploy/20251229_195114/manifest.json` |
| Schema version | OK | v1.17 (current stable) |
| App ID | OK | `a5017080-a433-4de7-84a4-0a72ae1be0a8` |
| Bot ID | OK | `a5017080-a433-4de7-84a4-0a72ae1be0a8` |
| Personal scope | OK | Enabled |
| File upload support | OK | `supportsFiles: true` |
| Static tabs | OK | "My Cases", "Manager View", "About" |

### Icons Status: VALID

| Icon | Dimensions | Format | Status |
|------|------------|--------|--------|
| color.png | 192x192 | PNG RGBA | OK |
| outline.png | 32x32 | PNG RGBA | OK |

### Manifest Endpoint Configuration

```json
{
  "developer": {
    "websiteUrl": "https://processing.pippaoflondon.co.uk"
  },
  "validDomains": [
    "processing.pippaoflondon.co.uk",
    "token.botframework.com",
    "login.microsoftonline.com"
  ],
  "webApplicationInfo": {
    "id": "a5017080-a433-4de7-84a4-0a72ae1be0a8",
    "resource": "api://processing.pippaoflondon.co.uk/a5017080-a433-4de7-84a4-0a72ae1be0a8"
  }
}
```

**Messaging Endpoint:** `https://processing.pippaoflondon.co.uk/api/messages` - Correctly configured

### App Package Status: VALID

```
teams-app.zip (1612 bytes):
  - manifest.json .......... OK
  - color.png .............. OK
  - outline.png ............ OK
```

---

## 2. Bot Service Status

### PM2 Process: ONLINE

| Metric | Value |
|--------|-------|
| Process name | teams-bot |
| Status | online |
| PID | 134071 |
| Uptime | ~10 minutes |
| Restarts | 0 |
| Script | `/data/order-processing/app/services/teams-bot/dist/index.js` |

### Port Binding: OK

- Port 3978 listening on all interfaces
- Node.js process bound correctly

### Health Check: PASSING

```json
{
  "status": "healthy",
  "service": "teams-bot",
  "timestamp": "2025-12-29T21:36:05.720Z"
}
```

---

## 3. Nginx Routing

### `/api/messages` Route: CONFIGURED

```nginx
location /api/messages {
    proxy_pass http://127.0.0.1:3978;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Content-Type $content_type;

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### External Endpoint Tests

| Test | Result | Expected |
|------|--------|----------|
| GET https://processing.pippaoflondon.co.uk/api/messages | 404 | OK (POST only) |
| POST with empty body | "Unauthorized Access" | OK (auth required) |

---

## 4. Bot Configuration

### Environment Variables (from code inspection)

| Variable | Purpose | Required |
|----------|---------|----------|
| `MICROSOFT_APP_ID` | Bot App registration client ID | Yes |
| `MICROSOFT_APP_PASSWORD` | Bot App client secret | Yes |
| `MICROSOFT_APP_TYPE` | Auth type (default: MultiTenant) | No |
| `MICROSOFT_APP_TENANT_ID` | Hosting tenant ID | No |

### Bot Framework Auth: MULTI-TENANT

The bot is configured for multi-tenant authentication, which is required for cross-tenant Teams deployment.

---

## 5. Cross-Tenant Deployment Summary

Based on `CROSS_TENANT_TEAMS_DEPLOYMENT.md`:

### Architecture

- **Tenant A (360innovate):** Hosts Azure resources, bot, APIs
- **Tenant B (Pippa of London):** Teams users, app distribution

### Key Identifiers

| Item | Value |
|------|-------|
| Bot App Client ID | `a5017080-a433-4de7-84a4-0a72ae1be0a8` |
| Pippa of London Tenant ID | `23da91a5-0480-4183-8bc1-d7b6dd33dd2e` |
| Messaging Endpoint | `https://processing.pippaoflondon.co.uk/api/messages` |

---

## 6. Readiness Checklist

### VM/Code Side (This Report)

- [x] Teams manifest created and valid
- [x] Icons meet Teams requirements (192x192 and 32x32 PNG)
- [x] App package (ZIP) created and valid
- [x] Bot service running (PM2 online)
- [x] Port 3978 bound and listening
- [x] Nginx routing configured for /api/messages
- [x] Multi-tenant auth configured in bot code
- [x] Personal scope enabled
- [x] File upload support enabled (`supportsFiles: true`)
- [x] Static tabs configured

### Pippa of London Tenant (Manual Steps Required)

- [ ] Azure Bot resource created with Teams channel
- [ ] Bot messaging endpoint configured
- [ ] Teams Admin Centre: custom apps enabled
- [ ] Teams app package uploaded
- [ ] App permission policy configured
- [ ] Admin consent granted for app
- [ ] App roles assigned to users

---

## 7. Manual Steps for Pippa of London Tenant

### Phase 1: Azure Bot Resource (Azure Portal)

1. **Create Azure Bot resource** in Pippa of London Azure subscription
   - Name: `op-teams-bot-prod`
   - Type: Multi-tenant
   - App ID: `a5017080-a433-4de7-84a4-0a72ae1be0a8` (existing registration)

2. **Configure messaging endpoint**
   - Set to: `https://processing.pippaoflondon.co.uk/api/messages`

3. **Enable Teams channel**
   - Azure Portal > Bot resource > Channels > Add Microsoft Teams

### Phase 2: Teams Admin Centre

1. **Verify org-wide settings** (https://admin.teams.microsoft.com)
   - Teams apps > Manage apps > Org-wide app settings
   - Enable "Allow interaction with custom apps"

2. **Upload Teams app package**
   - Teams apps > Manage apps > Upload new app
   - Upload: `teams-app.zip` from output directory

3. **Configure app permission policy**
   - Option A: Allow for all users (Global policy)
   - Option B: Create specific policy for Sales team

### Phase 3: Entra Admin Centre

1. **Grant admin consent** (https://entra.microsoft.com)
   - Enterprise applications > Find app by ID
   - Permissions > Grant admin consent

2. **Assign app roles** (if using role-based access)
   - Users and groups > Add user/group
   - Assign `SalesUser` or `SalesManager` roles

### Phase 4: Testing

1. **Install app in Teams**
   - Open Teams > Apps > Search "Order Processing"
   - Add to personal scope

2. **Test bot communication**
   - Send "help" message to bot
   - Verify response received

3. **Test file upload**
   - Upload test .xlsx file
   - Verify processing acknowledgment

4. **Test tabs**
   - Open "My Cases" tab
   - Verify SSO login works

---

## 8. Issues & Warnings

### Workflow Workers Errored

The `workflow-worker` PM2 processes are in errored state. This may affect order processing after Teams submission. Should be resolved before production use.

```
│ 2  │ workflow-worker    │ errored   │
│ 3  │ workflow-worker    │ errored   │
```

### Tab SSO Resource URI

The `webApplicationInfo.resource` in the manifest must match the "Expose an API" configuration in the Entra app registration:

```
api://processing.pippaoflondon.co.uk/a5017080-a433-4de7-84a4-0a72ae1be0a8
```

Verify this is configured in the app registration before deploying.

---

## 9. Files Generated

| File | Purpose |
|------|---------|
| `05_TEAMS_READINESS_REPORT.md` | This report |
| `05_TEAMS_READINESS_COMMANDS.log` | Command execution log |
| `teams-app.zip` | Ready for upload to Teams Admin Centre |
| `manifest.json` | Teams app manifest |
| `color.png` | App icon (192x192) |
| `outline.png` | App icon (32x32) |

---

## Paste-Back Summary

```
================================================================================
                        TEAMS READINESS - PASTE-BACK REPORT
================================================================================
Run ID:     20251229_195114
Status:     READY (VM/Code side complete)
Timestamp:  2025-12-29T21:36:00Z

VM-SIDE VERIFICATION
--------------------
[OK] Teams manifest valid (v1.17, personal scope, file upload)
[OK] Bot ID: a5017080-a433-4de7-84a4-0a72ae1be0a8
[OK] Messaging endpoint: https://processing.pippaoflondon.co.uk/api/messages
[OK] Icons: color.png (192x192), outline.png (32x32)
[OK] App package: teams-app.zip valid
[OK] Bot service: PM2 online, port 3978 listening
[OK] Nginx: /api/messages -> localhost:3978
[OK] Multi-tenant auth configured

MANUAL STEPS FOR PIPPA OF LONDON TENANT
----------------------------------------
1. Azure Portal (Pippa subscription):
   [ ] Create Azure Bot resource (Multi-tenant)
   [ ] Configure messaging endpoint
   [ ] Enable Teams channel

2. Teams Admin Centre (admin.teams.microsoft.com):
   [ ] Enable custom apps in org-wide settings
   [ ] Upload teams-app.zip
   [ ] Configure permission policy

3. Entra Admin Centre (entra.microsoft.com):
   [ ] Grant admin consent for app
   [ ] Assign app roles to users

4. Testing:
   [ ] Install app in Teams
   [ ] Send "help" to bot
   [ ] Upload test .xlsx file
   [ ] Verify tab SSO

WARNINGS
--------
[!] workflow-worker processes errored - fix before production
[!] Verify api:// resource URI in Entra app registration

FILES READY
-----------
Output: /data/order-processing/_codex_predeploy/20251229_195114/
  - teams-app.zip (upload to Teams Admin Centre)
  - 05_TEAMS_READINESS_REPORT.md
  - 05_TEAMS_READINESS_COMMANDS.log
================================================================================
```
