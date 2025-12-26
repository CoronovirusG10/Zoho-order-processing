# App Registrations Runbook

**Last updated:** 2025-12-26
**Scenario:** Bot + Personal Tab for Teams, hosted in Tenant A, used by Tenant B users.

---

## Executive Summary

This runbook details the exact app registrations required for the Sales Order Intake solution. Given the deprecation of new multi-tenant bot creation after 31 July 2025, this document prioritises configurations that will remain supported.

### Key Constraint: Multi-Tenant Bot Deprecation

**Critical:** Microsoft has announced that new multi-tenant bot creation is deprecated after 31 July 2025. This affects Azure Bot resource creation options.

**Recommendation:**
- Create the Azure Bot resource **before 31 July 2025** if you need a multi-tenant bot identity
- Alternatively, use a **Single Tenant** or **Managed Identity** bot type with a multi-tenant Entra app registration (verify current Microsoft documentation for supported patterns)

---

## 1. App Registrations Required

### Overview

| App Registration | Purpose | Account Type | Tenant |
|------------------|---------|--------------|--------|
| **Bot App** | Bot Framework identity, Teams channel auth | Multi-tenant | Tenant A |
| **Tab/API App** | Teams tab SSO, backend API authorisation | Multi-tenant | Tenant A |

**Minimal path:** Two app registrations as above.
**Production path:** Same two registrations with additional hardening (certificates, conditional access integration).

---

## 2. Bot App Registration (Tenant A)

### 2.1 Creation Steps

1. Navigate to **Entra ID** > **App registrations** > **New registration**
2. Configure:
   - **Name:** `SalesOrderBot-Prod` (or appropriate environment suffix)
   - **Supported account types:** `Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)`
   - **Redirect URI:** Leave blank initially (Bot Framework does not require redirect URIs)

3. Record immediately after creation:
   - **Application (client) ID** - this becomes `BOT_APP_CLIENT_ID` / Microsoft App ID
   - **Directory (tenant) ID** - this is Tenant A's ID

### 2.2 Authentication Configuration

**Certificates & secrets** (prefer certificates):

| Method | Configuration | Recommendation |
|--------|---------------|----------------|
| **Certificate (recommended)** | Upload `.cer` public key; store private key in Key Vault | Production |
| **Client secret** | Generate secret; store in Key Vault | MVP/Dev only |

**Certificate approach (production):**
1. Generate a certificate (self-signed for dev; CA-issued for production):
   ```bash
   # Example: self-signed for dev/test
   openssl req -x509 -newkey rsa:2048 -keyout bot-private.pem -out bot-cert.pem -days 365 -nodes -subj "/CN=SalesOrderBot"

   # Convert to .pfx for Azure Key Vault
   openssl pkcs12 -export -out bot-cert.pfx -inkey bot-private.pem -in bot-cert.pem
   ```
2. Upload the `.cer` (public key) to **Certificates & secrets** > **Certificates** > **Upload certificate**
3. Store the `.pfx` in **Azure Key Vault** as a certificate

**Secret approach (MVP only):**
1. Navigate to **Certificates & secrets** > **Client secrets** > **New client secret**
2. Set expiry (max 24 months; recommend 12 months with rotation process)
3. Copy value immediately and store in Key Vault
4. Record the secret ID for reference

### 2.3 API Permissions

The Bot App typically requires **no Microsoft Graph permissions** for the primary file download path. The bot receives attachment download URLs directly from Teams.

**If Graph fallback is required** (for cross-tenant file access issues):

| Permission | Type | Justification |
|------------|------|---------------|
| `Files.Read.All` | Delegated | Read user's files via OBO when download URL fails |
| `User.Read` | Delegated | Basic profile for OBO token exchange |

**Admin consent:** Delegated permissions require user consent or Tenant B admin consent via Enterprise Apps.

### 2.4 Bot Framework Configuration Notes

When configuring the bot runtime code:

```python
# .NET / Python Bot Framework SDK configuration
MicrosoftAppType = "MultiTenant"  # Critical for cross-tenant
MicrosoftAppId = "<BOT_APP_CLIENT_ID>"
MicrosoftAppTenantId = ""  # Leave empty for multi-tenant
```

**Token validation:**
- Accept tokens issued by any tenant (do not hardcode Tenant A issuer)
- Validate `audience` matches your Bot App client ID
- Extract tenant ID from activity `channelData.tenant.id` for logging/case records

---

## 3. Tab/API App Registration (Tenant A)

### 3.1 Creation Steps

1. Navigate to **Entra ID** > **App registrations** > **New registration**
2. Configure:
   - **Name:** `SalesOrderTab-Prod`
   - **Supported account types:** `Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)`
   - **Redirect URI:** Add initial URI (see section 3.3)

3. Record:
   - **Application (client) ID** - this becomes `TAB_APP_CLIENT_ID`
   - **Directory (tenant) ID** - Tenant A ID

### 3.2 Certificates & Secrets

Same approach as Bot App:
- **Production:** Certificate stored in Key Vault
- **MVP:** Client secret stored in Key Vault

### 3.3 Redirect URIs

Configure the following redirect URIs for Teams tab SSO:

| Platform | URI | Purpose |
|----------|-----|---------|
| Single-page application | `https://<your-tab-domain>/auth-end` | Post-auth popup close |
| Single-page application | `https://<your-tab-domain>/auth-start` | Auth initiation (if using popup) |
| Web | `https://<your-tab-domain>/api/auth/callback` | Server-side callback (if hybrid) |

**Teams-specific URIs** (required for silent SSO):
- Add the Teams app ID redirect: `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect`

### 3.4 Expose an API (for backend authorization)

1. Navigate to **Expose an API**
2. Set **Application ID URI:** `api://<TAB_APP_CLIENT_ID>` or `api://<your-tab-domain>/<TAB_APP_CLIENT_ID>`
3. Add a scope:

| Scope | Who can consent | Display name | Description |
|-------|-----------------|--------------|-------------|
| `access_as_user` | Admins and users | Access Sales Order API | Allows the app to access the Sales Order API on behalf of the signed-in user |

**Authorized client applications:**
Add the Teams client IDs to allow silent token acquisition:

| Client ID | Application |
|-----------|-------------|
| `1fec8e78-bce4-4aaf-ab1b-5451cc387264` | Teams desktop/mobile |
| `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` | Teams web |

### 3.5 App Roles (for authorization)

Define app roles for role-based access control:

1. Navigate to **App roles** > **Create app role**

| Role | Display name | Value | Allowed member types | Description |
|------|--------------|-------|---------------------|-------------|
| `SalesUser` | Sales User | `SalesUser` | Users/Groups | Default role for salespeople viewing their own cases |
| `SalesManager` | Sales Manager | `SalesManager` | Users/Groups | Manager role with team-wide case visibility |
| `OpsAuditor` | Operations Auditor | `OpsAuditor` | Users/Groups | Read-only access to all audit bundles |

**Role assignment:** Tenant B admin assigns these roles via **Enterprise Applications** > **Users and groups**.

### 3.6 API Permissions

| Permission | Type | Justification |
|------------|------|---------------|
| `User.Read` | Delegated | Read signed-in user profile for display |
| `openid` | Delegated | OpenID Connect sign-in |
| `profile` | Delegated | Basic profile claims |
| `email` | Delegated | Email claim for user identification |

**No additional Graph permissions required** if using app roles for authorization instead of manager hierarchy lookups.

### 3.7 Token Configuration (Optional Claims)

Add optional claims for ID tokens:

| Claim | Type | Description |
|-------|------|-------------|
| `email` | ID | User's email address |
| `upn` | ID | User principal name |
| `preferred_username` | ID | Display name |

---

## 4. Azure Bot Resource Configuration (Tenant A)

### 4.1 Bot Creation

**Important:** Create before 31 July 2025 if using multi-tenant pattern.

1. Navigate to **Azure Portal** > **Create a resource** > **Azure Bot**
2. Configure:

| Setting | Value | Notes |
|---------|-------|-------|
| Bot handle | `sales-order-bot` | Globally unique |
| Subscription | Your subscription | |
| Resource group | Your RG | |
| Pricing tier | Standard | Or Free for dev |
| Type of app | User-assigned Managed Identity **OR** Multi Tenant | Verify current options |
| Microsoft App ID | Use existing (Bot App registration) | `BOT_APP_CLIENT_ID` |

**If "Multi Tenant" bot type is deprecated:**
- Select **User-assigned Managed Identity** or **Single Tenant**
- The Entra app registration remains multi-tenant; the Azure Bot resource type affects infrastructure, not token validation

### 4.2 Teams Channel Configuration

1. Navigate to Azure Bot > **Channels** > **Microsoft Teams**
2. Enable the Teams channel
3. Configure:
   - **Calling:** Disabled (not used)
   - **Messaging:** Enabled

### 4.3 Messaging Endpoint

Set the messaging endpoint to your bot's HTTPS endpoint:
```
https://<your-function-app>.azurewebsites.net/api/messages
```

---

## 5. Key Vault Secret/Certificate Storage

### 5.1 Recommended Key Vault Structure

| Name | Type | Content |
|------|------|---------|
| `BotAppClientId` | Secret | Bot App client ID |
| `BotAppCertificate` | Certificate | Bot App certificate (PFX) |
| `TabAppClientId` | Secret | Tab/API App client ID |
| `TabAppCertificate` | Certificate | Tab/API App certificate (PFX) |
| `TenantAId` | Secret | Tenant A directory ID |

**Access policy:**
- Functions/Container Apps Managed Identity: Get secrets, Get certificates
- Developers (dev only): List, Get

### 5.2 Certificate Rotation Process

1. Generate new certificate 30 days before expiry
2. Upload public key to Entra app registration (both old and new active)
3. Update Key Vault certificate
4. Restart services to pick up new certificate
5. After confirming services work, remove old certificate from Entra

---

## 6. Identity Summary Table

| Resource | Identity Type | App Registration | Credentials |
|----------|---------------|------------------|-------------|
| Azure Bot | Bot App registration | `SalesOrderBot-Prod` | Certificate in Key Vault |
| Bot runtime (Functions) | Managed Identity + Bot App | Uses Bot App for channel auth | MSI + Bot cert |
| Tab web app | Managed Identity + Tab App | `SalesOrderTab-Prod` | MSI for Azure; Tab cert for Entra |
| Backend API (Functions) | Managed Identity | N/A for Azure resources | Validates Tab App tokens |

---

## 7. Security Recommendations

### 7.1 Minimal Path (MVP)

- Client secrets with 12-month expiry
- Manual rotation with calendar reminders
- Key Vault with RBAC access control

### 7.2 Production-Hardened Path

- Certificates only (no secrets)
- Automated certificate rotation via Key Vault auto-renewal
- Certificate Authority-issued certificates
- Conditional Access policies (if Tenant B requires)
- Require MFA for app registration management

### 7.3 Least Privilege Checklist

- [ ] Bot App: No Graph permissions unless fallback needed
- [ ] Tab App: Only `User.Read`, `openid`, `profile`, `email`
- [ ] No `Directory.Read.All` or similar broad permissions
- [ ] App roles used instead of Graph for authorization
- [ ] Managed Identity for Azure resource access

---

## 8. Troubleshooting Quick Reference

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| `AADSTS50011` | Redirect URI mismatch | Add correct URI to app registration |
| `AADSTS700016` | App not found in tenant | Ensure multi-tenant; check consent |
| `AADSTS65001` | Consent required | Admin consent in Tenant B |
| `AADSTS7000215` | Invalid secret | Secret expired; rotate |
| `BotAuthenticationFailed` | Wrong App ID/secret | Verify Key Vault values match Entra |
