# Claude Code Prompt: Pippa Tenant Admin - Teams App Deployment

**Created:** 2025-12-29
**Tenant:** Pippa of London (23da91a5-0480-4183-8bc1-d7b6dd33dd2e)
**Admin:** antonio@pippaoflondon.co.uk
**Priority:** HIGH - Final deployment step

---

## ✅ DEPLOYMENT COMPLETED (2025-12-29 23:30)

| Component | Status | Details |
|-----------|--------|---------|
| **App Name** | **Kozet** | Rebranded from "Pippa Order Processing" |
| **Teams App ID** | `ad7a6864-1acd-4d6a-afb4-32d53d37fed4` | |
| **Security Group** | Kozet Sales Users | `bedca107-66ae-4632-8893-efb63032f6d0` |
| **App Policy** | KozetSales | Auto-install for group members |
| **Users Added** | 13 | Payam, Pouya, Fereshteh, Narges, Sahar, Noora, Iain, Kaveh, Antonio, Sarvin, Saeed Mirzaei, Melika, Mortezagh |

### PowerShell Commands Used
```powershell
# Create AppPreset object
$KozetApp = New-Object -TypeName Microsoft.Teams.Policy.Administration.Cmdlets.Core.AppPreset -Property @{Id="ad7a6864-1acd-4d6a-afb4-32d53d37fed4"}

# Add to policy
Set-CsTeamsAppSetupPolicy -Identity 'Tag:KozetSales' -AppPresetList @($KozetApp)

# Assign to group
New-CsGroupPolicyAssignment -GroupId "bedca107-66ae-4632-8893-efb63032f6d0" -PolicyType TeamsAppSetupPolicy -PolicyName "KozetSales" -Rank 1
```

---

## Context

The Order Processing Teams app is ready for deployment to the Pippa of London tenant. All VM-side infrastructure is configured:

| Component | Status |
|-----------|--------|
| Bot Service | Online (PM2) |
| Credentials | Validated |
| Token Acquisition | Working |
| External Endpoint | https://processing.pippaoflondon.co.uk/api/messages |
| SSL Certificate | Valid |
| Teams Package | Built and validated |

---

## Pre-Requisites Check

Before proceeding, verify:

1. **You are signed in as tenant admin** (antonio@pippaoflondon.co.uk or equivalent)
2. **You have Teams admin permissions**
3. **The Teams package is accessible:**
   - Location: `/data/order-processing/_codex_predeploy/20251229_195114/teams-app.zip`
   - Size: 1612 bytes
   - Contents: manifest.json, color.png (192x192), outline.png (32x32)

---

## Phase 1: Upload Teams App Package

### Option A: Teams Admin Center (Recommended)

**Execute these steps manually or guide the admin:**

1. Navigate to **https://admin.teams.microsoft.com**

2. Sign in with tenant admin credentials

3. Go to **Teams apps > Manage apps**

4. Click **Upload new app** (or "Upload" button)

5. Select **Upload custom app**

6. Browse to and select: `teams-app.zip`
   - Full path: `/data/order-processing/_codex_predeploy/20251229_195114/teams-app.zip`

7. Wait for validation (should pass - manifest is v1.17 compliant)

8. Once uploaded, the app will appear as:
   - **Name:** Pippa Order Processing
   - **App ID:** a5017080-a433-4de7-84a4-0a72ae1be0a8

### Option B: PowerShell (If Available)

```powershell
# Connect to Microsoft Teams
Connect-MicrosoftTeams

# Upload the app package
New-TeamsApp -DistributionMethod organization -Path "teams-app.zip"

# Verify upload
Get-TeamsApp | Where-Object {$_.DisplayName -like "*Pippa*"}
```

---

## Phase 2: Configure App Policies

### 2.1 App Setup Policy

1. In Teams Admin Center, go to **Teams apps > Setup policies**

2. Either modify **Global (Org-wide default)** or create new policy

3. Under **Installed apps**, click **Add apps**

4. Search for "Pippa Order Processing"

5. Click **Add** then **Save**

### 2.2 App Permission Policy

1. Go to **Teams apps > Permission policies**

2. Ensure the policy allows **custom apps** for users who need access

3. For pilot: Create a policy for sales team only

---

## Phase 3: User Assignment

### For Pilot (Recommended)

Assign app to specific users first:

1. Go to **Users > Manage users**

2. Select pilot users (e.g., sales team members)

3. Under **Policies**, assign the app setup policy with the Pippa app

### For Organization-Wide

After successful pilot:

1. Add app to **Global** setup policy

2. All users will see the app in their Teams client

---

## Phase 4: Verify Deployment

### 4.1 App Visibility Check

1. Open Microsoft Teams as a pilot user

2. Go to **Apps** (left sidebar)

3. Search for "Pippa Order Processing"

4. The app should appear with correct icon

### 4.2 Bot Conversation Test

1. Click the app and select **Chat**

2. Start a 1:1 conversation with the bot

3. Send: `help`

4. **Expected Response:** Bot should reply with help information

5. **If no response:**
   - Check bot service is running: `pm2 status teams-bot`
   - Check logs: `pm2 logs teams-bot --lines 50`

### 4.3 File Upload Test

1. In the bot conversation, click the attachment icon

2. Upload a test `.xlsx` file

3. **Expected:** Bot acknowledges receipt and begins processing

### 4.4 Personal Tab Test

1. Click the app and select the personal tab

2. **Expected:** Tab loads showing case list (empty initially)

3. Verify role-based view works (SalesUser vs SalesManager)

---

## Phase 5: Troubleshooting Guide

### Issue: App Not Visible to Users

**Cause:** App policy not applied or propagation delay

**Fix:**
1. Verify app is in setup policy
2. Verify user is assigned the policy
3. Wait 24 hours for policy propagation
4. User can try: Teams > Settings > General > Clear cache

### Issue: Bot Not Responding

**Cause:** Bot service down or endpoint misconfigured

**Fix:**
1. SSH to VM and check: `pm2 status teams-bot`
2. Check logs: `pm2 logs teams-bot --lines 100`
3. Verify endpoint: `curl -X POST https://processing.pippaoflondon.co.uk/api/messages`
4. Restart if needed: `pm2 restart teams-bot`

### Issue: Bot Returns Error

**Cause:** Authentication or configuration issue

**Fix:**
1. Verify credentials in `.env` match Azure Bot registration
2. Check token acquisition: Look for "token" in bot logs
3. Verify tenant ID matches: `23da91a5-0480-4183-8bc1-d7b6dd33dd2e`

### Issue: Tab Not Loading

**Cause:** Tab not deployed or CORS issue

**Fix:**
1. Tab is served via nginx - check config
2. Verify SSO configuration in manifest
3. Check browser console for errors

---

## Validation Checklist

Complete these checks to confirm successful deployment:

| Check | Status | Notes |
|-------|--------|-------|
| App uploaded to Teams Admin Center | [ ] | |
| App visible in Teams client | [ ] | |
| Bot responds to "help" command | [ ] | |
| Bot acknowledges file upload | [ ] | |
| Personal tab loads | [ ] | |
| Role-based view works | [ ] | |

---

## Post-Deployment Tasks

After successful deployment:

1. **Document pilot users** - Who has access initially

2. **Collect feedback** - First-day issues

3. **Monitor bot logs** - Watch for errors
   ```bash
   pm2 logs teams-bot --lines 0 -f
   ```

4. **Check workflow processing** - Once Temporal is fixed
   ```bash
   pm2 logs workflow-worker --lines 50
   ```

5. **Plan rollout** - Timeline for organization-wide deployment

---

## Key Information Reference

| Item | Value |
|------|-------|
| **App Name** | Kozet |
| **Teams App ID** | ad7a6864-1acd-4d6a-afb4-32d53d37fed4 |
| **Tenant ID** | 23da91a5-0480-4183-8bc1-d7b6dd33dd2e |
| **Bot App ID** | a5017080-a433-4de7-84a4-0a72ae1be0a8 |
| **Bot Resource** | pippa-order-bot |
| **Messaging Endpoint** | https://processing.pippaoflondon.co.uk/api/messages |
| **Security Group** | Kozet Sales Users (`bedca107-66ae-4632-8893-efb63032f6d0`) |
| **App Policy** | KozetSales |
| **Teams Package** | /data/order-processing/_codex_predeploy/20251229_195114/teams-app.zip |
| **Admin Email** | antonio@pippaoflondon.co.uk |

---

## Support Contacts

| Issue Type | Contact |
|------------|---------|
| Teams Admin | antonio@pippaoflondon.co.uk |
| VM/Infrastructure | DevOps (360innovate) |
| Bot Issues | Check PM2 logs first |

---

*Prompt created: 2025-12-29*
*For use by: Pippa of London tenant administrator*
