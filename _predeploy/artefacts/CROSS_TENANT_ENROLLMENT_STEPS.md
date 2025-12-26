# Cross-Tenant Enrollment Steps

**Last updated:** 2025-12-26
**Scenario:** Teams app (bot + personal tab) deployed in Tenant A, used by Tenant B employees.

---

## Executive Summary

This document provides step-by-step instructions for enrolling the Sales Order Intake Teams app in a cross-tenant configuration. The app is registered and hosted in Tenant A (hosting tenant), while end users are in Tenant B (Teams tenant).

### Distribution Model Recommendation

| Method | Recommended For | Complexity | Time to Deploy |
|--------|-----------------|------------|----------------|
| **Tenant B org app catalogue (custom upload)** | MVP, internal use, single partner | Low | Hours |
| **Sideloading (dev only)** | Developer testing | Very low | Minutes |
| **AppSource/Store** | ISV, multiple customers | High | Weeks (review) |

**Recommendation for MVP:** Use Tenant B admin custom app upload via Teams Admin Centre.

---

## Part 1: Tenant A (Hosting Tenant) Prerequisites

### 1.1 Complete App Registrations

Before Tenant B enrollment, Tenant A must complete:

- [ ] **Bot App registration** created (multi-tenant)
- [ ] **Tab/API App registration** created (multi-tenant)
- [ ] **Azure Bot resource** created with Teams channel enabled
- [ ] **Bot messaging endpoint** configured and accessible
- [ ] **Tab web app** deployed and accessible via HTTPS

Refer to `APP_REGISTRATIONS_RUNBOOK.md` for detailed steps.

### 1.2 Prepare Teams App Package

Create the Teams app manifest package (ZIP file):

```
teams-app-package/
  manifest.json
  color.png (192x192)
  outline.png (32x32)
```

**manifest.json structure:**

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "manifestVersion": "1.17",
  "version": "1.0.0",
  "id": "<UNIQUE-GUID-FOR-APP>",
  "developer": {
    "name": "Your Company Name",
    "websiteUrl": "https://your-company.com",
    "privacyUrl": "https://your-company.com/privacy",
    "termsOfUseUrl": "https://your-company.com/terms"
  },
  "name": {
    "short": "Sales Order Bot",
    "full": "Sales Order Intake Bot and Portal"
  },
  "description": {
    "short": "Upload Excel orders and create Zoho drafts",
    "full": "Upload Excel spreadsheets containing sales orders. The bot validates, extracts data, and creates draft sales orders in Zoho Books."
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "accentColor": "#0078D4",
  "bots": [
    {
      "botId": "<BOT_APP_CLIENT_ID>",
      "scopes": ["personal"],
      "supportsFiles": true,
      "isNotificationOnly": false
    }
  ],
  "staticTabs": [
    {
      "entityId": "my-cases",
      "name": "My Cases",
      "contentUrl": "https://<your-tab-domain>/tab?context={context}",
      "websiteUrl": "https://<your-tab-domain>/",
      "scopes": ["personal"]
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": [
    "<your-tab-domain>",
    "token.botframework.com"
  ],
  "webApplicationInfo": {
    "id": "<TAB_APP_CLIENT_ID>",
    "resource": "api://<your-tab-domain>/<TAB_APP_CLIENT_ID>"
  }
}
```

**Key fields for cross-tenant:**
- `bots[0].botId`: Must match the Bot App registration client ID
- `webApplicationInfo.id`: Must match the Tab/API App registration client ID
- `validDomains`: All domains the app uses (your tab domain, bot framework)

### 1.3 Package the App

```bash
cd teams-app-package
zip -r ../sales-order-bot.zip manifest.json color.png outline.png
```

### 1.4 Test in Tenant A First (Optional but Recommended)

Before cross-tenant deployment:
1. Sideload the app in Tenant A Teams
2. Verify bot responds to messages
3. Verify tab loads and SSO works
4. Test file upload and processing

---

## Part 2: Tenant B Admin Actions

### 2.1 Verify Org-Wide Settings Allow Custom Apps

**Teams Admin Centre** (`https://admin.teams.microsoft.com`):

1. Navigate to **Teams apps** > **Manage apps** > **Org-wide app settings**
2. Verify:
   - [ ] **Custom apps** section: "Allow interaction with custom apps" is **On**
   - [ ] **Third-party apps** section: Not blocking external multi-tenant apps

If custom apps are disabled, enable them:
1. Toggle "Allow interaction with custom apps" to **On**
2. Changes take up to 24 hours to propagate

### 2.2 Upload the Custom App

1. Navigate to **Teams apps** > **Manage apps**
2. Click **Upload new app** (top right)
3. Select **Upload** and choose the `sales-order-bot.zip` package
4. Wait for validation to complete

**Post-upload status:**
- The app appears in the app list with status "Custom app"
- Note the **App ID** shown (matches manifest ID)

### 2.3 Configure App Permission Policy

Determine which users can access the app:

**Option A: Allow for all users**
1. Navigate to **Teams apps** > **Permission policies**
2. Edit **Global (Org-wide default)** policy
3. Under **Custom apps**, set to **Allow all apps**

**Option B: Allow for specific groups (recommended)**
1. Create a new permission policy: **Sales Team App Access**
2. Under **Custom apps**, select **Allow specific apps and block all others**
3. Add the Sales Order Bot app
4. Save and assign policy to relevant users/groups

### 2.4 Configure App Setup Policy (Optional)

Pin the app for easy access:

1. Navigate to **Teams apps** > **Setup policies**
2. Edit or create a policy
3. Under **Pinned apps**, add the Sales Order Bot
4. Choose position (personal apps bar)
5. Assign policy to relevant users

### 2.5 Grant Admin Consent for Entra App (Critical)

When users first use the app, consent is required. Admin consent is recommended:

1. Navigate to **Entra ID** (`https://entra.microsoft.com`)
2. Go to **Enterprise applications**
3. Search for the Tab/API app name or client ID
4. If not present, the service principal will be created on first user access
5. To grant admin consent proactively:
   - Navigate to **Permissions** > **Grant admin consent for [Tenant B]**
   - Review requested permissions
   - Click **Grant admin consent**

**Permissions to review:**
- `User.Read` - Read user profile
- `openid`, `profile`, `email` - Standard OIDC claims
- Your custom scope: `api://<TAB_APP_CLIENT_ID>/access_as_user`

### 2.6 Assign App Roles (Authorization)

Assign roles to control access levels:

1. Navigate to **Entra ID** > **Enterprise applications**
2. Find the Tab/API App service principal
3. Navigate to **Users and groups** > **Add user/group**
4. Assign roles:

| Role | Assign To |
|------|-----------|
| `SalesUser` | Default for all sales staff |
| `SalesManager` | Sales managers/team leads |
| `OpsAuditor` | Operations/compliance team |

**Using groups (recommended):**
1. Create security groups in Tenant B Entra:
   - `SG-SalesOrderBot-Users`
   - `SG-SalesOrderBot-Managers`
   - `SG-SalesOrderBot-Auditors`
2. Assign groups to corresponding app roles
3. Add users to appropriate groups

### 2.7 Verify Cross-Tenant Access Settings (If Issues Occur)

If consent or sign-in fails, check cross-tenant access policies:

1. Navigate to **Entra ID** > **External Identities** > **Cross-tenant access settings**
2. Check **Outbound access settings**:
   - Ensure Tenant A is not blocked
   - Or explicitly add Tenant A with "Allow" configuration
3. Check **Default settings**:
   - Outbound access for "B2B collaboration" should allow applications

---

## Part 3: User Onboarding

### 3.1 First-Time User Experience

When users access the app for the first time:

1. User opens Teams > Apps > Finds "Sales Order Bot"
2. User clicks **Add** to add to personal scope
3. **If admin consent not granted:**
   - Consent prompt appears
   - User consents (or is blocked if admin consent required)
4. **If admin consent granted:**
   - App opens directly
   - Tab SSO acquires token silently

### 3.2 User Communication Template

Send to users after setup:

```
Subject: New Sales Order Bot Available in Teams

Hi Team,

A new tool is available to streamline order entry. The Sales Order Bot lets you:
- Upload Excel order spreadsheets via Teams chat
- Review extracted data and resolve issues
- Create draft sales orders in Zoho Books

To get started:
1. Open Microsoft Teams
2. Click Apps (left sidebar)
3. Search for "Sales Order Bot"
4. Click Add
5. Start a chat with the bot and upload an .xlsx file

For help, contact [support email].
```

---

## Part 4: Distribution Methods Comparison

### 4.1 Org App Catalogue (Custom Upload) - Recommended

**Pros:**
- Full control over deployment
- No Microsoft review required
- Immediate availability after upload

**Cons:**
- Manual update process (re-upload new package)
- Only available in one tenant

**Process:**
1. Tenant B admin uploads package
2. Users find app in org catalogue
3. Admin manages updates

### 4.2 Sideloading (Development Only)

**Pros:**
- Fastest for developer testing
- No admin action required (if sideloading enabled)

**Cons:**
- Not suitable for production
- User-specific installation
- No central management

**Process:**
1. User uploads package in Teams
2. Only that user sees the app

**Enable sideloading (dev tenants only):**
1. Teams Admin Centre > **Teams apps** > **Setup policies**
2. Edit policy > Enable **Upload custom apps**
3. Assign to developers only

### 4.3 AppSource / Microsoft Teams Store

**Pros:**
- Discoverable by any organization
- Microsoft-validated
- Automatic updates possible

**Cons:**
- Requires Microsoft review (weeks)
- Must meet store policies
- Public visibility (may not be desired)

**Process:**
1. Submit via Partner Center
2. Pass Microsoft validation
3. Publish to store
4. Other orgs can install from store

**Not recommended for:** Internal/single-customer apps like this scenario.

---

## Part 5: Consent Workflow Details

### 5.1 Consent Types

| Consent Type | When Used | Who Consents |
|--------------|-----------|--------------|
| **User consent** | Default for delegated permissions | Each user |
| **Admin consent** | Required for admin-only permissions | Tenant B admin |
| **Admin consent for all users** | Recommended for org-wide apps | Tenant B admin (once) |

### 5.2 Admin Consent Flow

**Proactive admin consent (recommended):**
1. Tenant B admin navigates to:
   ```
   https://login.microsoftonline.com/{tenant-b-id}/adminconsent?client_id={TAB_APP_CLIENT_ID}
   ```
2. Admin reviews permissions
3. Admin clicks Accept
4. Service principal created in Tenant B
5. All users can now use the app without consent prompts

**Admin consent via Enterprise Apps:**
1. Navigate to Enterprise Applications
2. Find the app (after first user access)
3. Grant admin consent from Permissions blade

### 5.3 Conditional Access Considerations

If Tenant B uses Conditional Access:

1. The Tab/API App and Bot App service principals are subject to CA policies
2. Review policies that might affect:
   - External cloud applications
   - Unmanaged devices (if accessing from personal devices)
   - Location-based restrictions

**Common CA issues:**
- Policy blocking external apps → Add exception for Sales Order Bot
- MFA requirement → Users prompted for MFA on first access (expected)
- Compliant device required → May block personal device access

---

## Part 6: Troubleshooting Enrollment

### 6.1 App Not Appearing After Upload

| Check | Resolution |
|-------|------------|
| Upload successful? | Check for validation errors during upload |
| Permission policy? | Ensure policy allows the custom app |
| Propagation time? | Wait up to 24 hours for policy changes |
| User refresh? | User may need to restart Teams |

### 6.2 Consent Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `AADSTS65001` | User consent required, not granted | Grant admin consent |
| `AADSTS50011` | Redirect URI mismatch | Update app registration in Tenant A |
| `AADSTS700016` | App not found | Verify multi-tenant setting |
| `AADSTS90094` | Admin consent required | Admin must consent; user cannot |

### 6.3 Bot Not Responding

| Check | Resolution |
|-------|------------|
| Bot ID correct in manifest? | Must match Bot App client ID |
| Messaging endpoint reachable? | Test HTTPS URL externally |
| Teams channel enabled? | Check Azure Bot channels |
| Bot App credentials valid? | Verify in Key Vault |

### 6.4 Tab SSO Failing

| Check | Resolution |
|-------|------------|
| `webApplicationInfo.id` correct? | Must match Tab App client ID |
| Valid domains listed? | Add tab domain to `validDomains` |
| Admin consent granted? | Check Enterprise Apps in Tenant B |
| Scope exposed correctly? | Verify "Expose an API" configuration |

---

## Part 7: Checklist Summary

### Tenant A Checklist

- [ ] Bot App registration created (multi-tenant)
- [ ] Tab/API App registration created (multi-tenant)
- [ ] Azure Bot resource created with Teams channel
- [ ] Bot messaging endpoint deployed and accessible
- [ ] Tab web app deployed and accessible
- [ ] Teams app package (ZIP) created
- [ ] Package tested via sideload in Tenant A (optional)
- [ ] Package provided to Tenant B admin

### Tenant B Checklist

- [ ] Org-wide settings allow custom apps
- [ ] Teams app package uploaded via Admin Centre
- [ ] App permission policy configured
- [ ] App setup policy configured (optional)
- [ ] Admin consent granted for Tab/API App
- [ ] App roles assigned (SalesUser, SalesManager, OpsAuditor)
- [ ] User communication sent
- [ ] First user onboarding verified
