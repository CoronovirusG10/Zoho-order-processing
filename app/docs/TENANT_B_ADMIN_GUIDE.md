# Tenant B Administrator Onboarding Guide

**Order Processing Teams Application - Cross-Tenant Deployment**

---

## Overview

This guide provides step-by-step instructions for administrators of **Tenant B** (the Teams tenant) to deploy and configure the Order Processing application. The application is hosted in **Tenant A** (the Azure hosting tenant) and made available to users in your tenant.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              TENANT A                                    │
│                        (Azure Hosting Tenant)                            │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Bot App Reg    │    │  Tab/API App Reg │    │  Azure Resources │  │
│  │  (Multi-tenant)  │    │  (Multi-tenant)  │    │  (Sweden Central)│  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
│           │                       │                       │             │
└───────────┼───────────────────────┼───────────────────────┼─────────────┘
            │                       │                       │
            ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              TENANT B                                    │
│                          (Your Teams Tenant)                             │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  Service Principal│    │ Service Principal│    │   Teams Users    │  │
│  │    (Bot App)     │    │   (Tab/API App)  │    │                  │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Teams App (Custom Upload)                      │  │
│  │  ┌─────────────────┐              ┌─────────────────────────┐    │  │
│  │  │   Bot (1:1 Chat) │              │   Personal Tab (SSO)   │    │  │
│  │  │  - File upload   │              │   - My Orders           │    │  │
│  │  │  - Status cards  │              │   - Team Orders         │    │  │
│  │  └─────────────────┘              └─────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### What You Will Need

Before starting, ensure you have:

1. **Global Administrator** or **Teams Administrator** + **Application Administrator** roles in Tenant B
2. The Teams app package (`.zip` file) provided by the Tenant A administrator
3. The following information from Tenant A administrator:
   - Bot App Client ID
   - Tab/API App Client ID
   - Tab Domain URL
   - Bot Endpoint URL

---

## Prerequisites Checklist

| Requirement | Status |
|-------------|--------|
| Teams Admin Center access | [ ] |
| Azure Portal access (Entra ID) | [ ] |
| Teams app package (.zip file) | [ ] |
| App Client IDs from Tenant A | [ ] |
| Custom app policy allows upload | [ ] |

---

## Step 1: Review Tenant Policies

Before uploading the app, verify your tenant allows custom Teams apps.

### 1.1 Check Org-Wide App Settings

1. Navigate to [Teams Admin Center](https://admin.teams.microsoft.com)
2. Go to **Teams apps** > **Manage apps**
3. Click **Org-wide app settings**
4. Verify:
   - **Custom apps** is set to **On** (or allowed for specific users/groups)
   - **Third-party apps** is enabled (the app uses Bot Framework which is a Microsoft service)

### 1.2 Check App Permission Policies

1. Go to **Teams apps** > **Permission policies**
2. Review the **Global (Org-wide default)** policy or your custom policy
3. Ensure **Custom apps** are allowed:
   - Either: "Allow all apps" is selected
   - Or: Specific custom apps are allowed (you'll add this app after upload)

### 1.3 Check Cross-Tenant Access Settings (If Required)

If your organization has strict external collaboration policies:

1. Go to [Azure Portal](https://portal.azure.com) > **Microsoft Entra ID**
2. Navigate to **External Identities** > **Cross-tenant access settings**
3. Check **Outbound access settings**:
   - Ensure applications from Tenant A are not blocked
   - If using allowlists, add the Bot App and Tab/API App Client IDs

---

## Step 2: Upload the Teams App Package

### 2.1 Upload via Teams Admin Center

1. Navigate to [Teams Admin Center](https://admin.teams.microsoft.com)
2. Go to **Teams apps** > **Manage apps**
3. Click **+ Upload new app**
4. Select **Upload custom app**
5. Choose the `teams-app.zip` file provided
6. Click **Upload**

### 2.2 Verify Upload Success

After upload, you should see:

- App name: **Order Processing**
- Publisher: Order Processing Team
- Status: **Blocked** (initially - this is normal)

### 2.3 Approve the App

1. Find "Order Processing" in the app list
2. Click on the app name to open details
3. Change **Status** from "Blocked" to **Allowed**
4. Click **Save**

---

## Step 3: Grant Admin Consent for Enterprise Applications

The Teams app requires service principals (enterprise applications) to be created in your tenant. This happens automatically when users sign in, or you can pre-consent.

### 3.1 Grant Consent for Tab/API Application (Required for SSO)

1. Go to [Azure Portal](https://portal.azure.com) > **Microsoft Entra ID**
2. Navigate to **Enterprise applications**
3. Search for the Tab/API App by Client ID: `[TAB_APP_CLIENT_ID]`
4. If not found, you may need to add it:
   - Click **+ New application**
   - Click **Create your own application**
   - Name: "Order Processing Tab"
   - Select "Register an application to integrate with Microsoft Entra ID"
   - In the registration wizard, use the Client ID from Tenant A
5. Once found/created, click on the application
6. Go to **Permissions**
7. Click **Grant admin consent for [Your Tenant]**
8. Review and accept the permissions

### 3.2 Grant Consent for Bot Application (If Using OAuth)

If the bot requires user sign-in (for Microsoft Graph access or other delegated flows):

1. In **Enterprise applications**, search for Bot App Client ID: `[BOT_APP_CLIENT_ID]`
2. Follow the same consent process as above

---

## Step 4: Assign App Roles to Users

The application uses app roles for authorization. Assign these to control access.

### Available Roles

| Role | Description | Typical Assignment |
|------|-------------|-------------------|
| **SalesUser** | Can create orders and view their own cases | All sales team members |
| **SalesManager** | Can view team orders and access reports | Sales team leads |
| **OpsAuditor** | Read-only access to all audit bundles | Compliance/Operations staff |

### 4.1 Assign Roles via Azure Portal

1. Go to [Azure Portal](https://portal.azure.com) > **Microsoft Entra ID**
2. Navigate to **Enterprise applications**
3. Find and click on the Tab/API application
4. Go to **Users and groups**
5. Click **+ Add user/group**
6. Select users or groups
7. Select a role (SalesUser, SalesManager, or OpsAuditor)
8. Click **Assign**

### 4.2 Bulk Assignment via Groups (Recommended)

For easier management, create security groups and assign roles to groups:

1. Create security groups:
   - `OrderProcessing-SalesUsers`
   - `OrderProcessing-SalesManagers`
   - `OrderProcessing-Auditors`
2. Add users to appropriate groups
3. Assign each group to the corresponding app role

---

## Step 5: Configure App Setup Policies

Control which users see the app pinned in Teams.

### 5.1 Create or Modify App Setup Policy

1. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
2. Navigate to **Teams apps** > **Setup policies**
3. Click **+ Add** to create a new policy, or edit existing
4. Name: "Sales Team App Setup"
5. Under **Pinned apps**:
   - Click **+ Add apps**
   - Search for "Order Processing"
   - Select and add the app
6. Set the order/position as desired
7. Click **Save**

### 5.2 Assign Policy to Users

1. In the policy list, click the policy name
2. Click **Manage users**
3. Add users or groups who should have this policy
4. Click **Apply**

> **Note:** Policy changes may take up to 24 hours to propagate to all users.

---

## Step 6: Verify Deployment

### 6.1 Test as End User

1. Log in to Teams as a test user who has been granted access
2. Go to **Apps** in the left sidebar
3. Search for "Order Processing"
4. Click to install the app
5. Verify:
   - Bot appears in personal chat
   - Personal tabs load correctly
   - SSO works (no separate login prompt in tab)

### 6.2 Test Bot Functionality

1. Open a 1:1 chat with the Order Processing bot
2. Type "help" to verify the bot responds
3. Try uploading a test Excel file
4. Verify processing status is returned

### 6.3 Test Tab Functionality

1. Click on the "My Orders" tab
2. Verify you can see your orders (if any)
3. If you have SalesManager role, verify "Team Orders" tab works

---

## Troubleshooting

### App Not Appearing for Users

**Symptoms:** Users cannot find the app in Teams

**Solutions:**
1. Verify app is set to "Allowed" in Manage apps
2. Check user is covered by an app permission policy that allows custom apps
3. Wait up to 24 hours for policy propagation
4. Have user clear Teams cache and restart

### SSO Not Working (Login Loop or Errors)

**Symptoms:** Tab shows login prompts or authentication errors

**Solutions:**
1. Verify admin consent was granted for the Tab/API app
2. Check the Tab/API app has correct redirect URIs configured
3. Ensure the user has an app role assigned
4. Check browser popup blockers are not interfering

### Bot Not Responding

**Symptoms:** Messages to bot go unanswered

**Solutions:**
1. Verify the Azure Bot Service is running in Tenant A
2. Check the bot messaging endpoint is accessible
3. Verify the Bot App Client ID in the manifest matches Tenant A configuration
4. Check Tenant A administrator for bot service health

### "App Not Found" in Enterprise Applications

**Symptoms:** Cannot find the apps to grant consent

**Solutions:**
1. Have a user attempt to use the app - this triggers automatic service principal creation
2. Manually create using: Azure Portal > Enterprise Apps > New > Create your own
3. Contact Tenant A admin to verify the apps are configured as multi-tenant

### Cross-Tenant Access Blocked

**Symptoms:** Authentication fails with tenant/organization errors

**Solutions:**
1. Review External Identities > Cross-tenant access settings
2. Add Tenant A to trusted organizations if using allowlists
3. Ensure outbound access to external apps is not blocked

---

## Security Considerations

### Data Flow

- **Files uploaded in Teams chat** are temporarily stored in the user's OneDrive, then transferred to Tenant A's Azure Blob Storage
- **No user data is stored in Tenant B** - all processing occurs in Tenant A
- **Audit logs** are maintained in Tenant A (Sweden Central for GDPR compliance)

### Permissions Requested

| Permission | Scope | Reason |
|------------|-------|--------|
| User.Read | Delegated | Read user profile for personalization |
| openid, profile, email | Delegated | SSO authentication |
| access_as_user (custom) | Delegated | API authorization |

### Compliance Notes

- The application processes data in **Sweden Central** (EU)
- Audit bundles are retained per Tenant A's retention policy
- Zoho Books integration is managed by Tenant A

---

## Support Contacts

| Issue Type | Contact |
|------------|---------|
| Teams app not working | [Your IT Support] |
| Permissions/Access issues | [Your IT Support] |
| Application bugs/errors | [Tenant A Support Contact] |
| Zoho Books issues | [Tenant A Support Contact] |

---

## Appendix: Quick Reference

### Key URLs

- Teams Admin Center: https://admin.teams.microsoft.com
- Azure Portal: https://portal.azure.com
- Entra Admin Center: https://entra.microsoft.com

### App Identifiers

| App | Client ID |
|-----|-----------|
| Bot App | `[BOT_APP_CLIENT_ID]` |
| Tab/API App | `[TAB_APP_CLIENT_ID]` |

### Useful PowerShell Commands

```powershell
# Install Microsoft Graph PowerShell module
Install-Module Microsoft.Graph -Scope CurrentUser

# Connect to your tenant
Connect-MgGraph -Scopes "Application.ReadWrite.All"

# Find enterprise applications
Get-MgServicePrincipal -Filter "appId eq '[TAB_APP_CLIENT_ID]'"

# Get app role assignments
Get-MgServicePrincipalAppRoleAssignedTo -ServicePrincipalId [SP_OBJECT_ID]
```

### Useful Azure CLI Commands

```bash
# Login to Azure
az login --tenant [YOUR_TENANT_ID]

# List enterprise applications
az ad sp list --filter "appId eq '[TAB_APP_CLIENT_ID]'"

# Grant admin consent
az ad app permission admin-consent --id [TAB_APP_CLIENT_ID]
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-26 | 1.0 | Initial guide |
