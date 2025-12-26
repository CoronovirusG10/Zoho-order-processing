# Cross-tenant Microsoft Teams deployment plan (bot + personal tab)

**Last updated:** 2025-12-21  
**Scenario:** The Azure workload (bot, APIs, storage, Foundry Agent Service) is deployed in **Tenant A**. The Microsoft Teams users live in **Tenant B**. Users will chat 1:1 with the bot in Tenant B, while all processing and long-term retention occurs in Tenant A (Sweden Central).

This document is written to be implementable and to highlight what must be verified against Microsoft documentation as of **December 2025**.

---

## 0) What is fact vs recommendation

### Facts (verify in Microsoft docs/portals)
- Teams apps can be distributed to a tenant via **custom app upload** (user upload for development/testing, or tenant-wide upload/approval via **Teams admin centre**) and governed by **app setup / permission policies**.
- Teams bots can receive files in personal chat and get an attachment payload including a **download URL** (file is stored in the sender’s OneDrive/SharePoint behind Teams).
- Tab apps are Teams-aware web pages; Teams supports **SSO for tabs** via Microsoft Entra ID registration and `microsoftTeams.getAuthToken()`.

### Design recommendations
- Treat this as an **ISV-style** deployment even if you control both tenants: create multi-tenant Entra applications in Tenant A; have Tenant B admin upload the Teams app package and grant consent.
- Avoid Microsoft Graph application permissions for OneDrive if you can; prefer the **Teams bot file download URL** path first. Add a tested fallback that uses a user-delegated token (OBO) if download fails.

---

## 1) Tenant roles and responsibilities

### Tenant A (Hosting tenant)
Owns:
- Azure resources (Sweden Central): Storage (Blob), Functions/Container Apps, Key Vault, Cosmos DB, APIM, Monitor, Foundry hub/project and Agent.
- Microsoft Entra app registrations (multi-tenant) for:
  1) **Bot identity** (Microsoft App ID for Bot Framework / Azure Bot).
  2) **Tab/API identity** (SSO for personal tab + calling backend APIs).
- Secrets to call Zoho and (optionally) external LLM providers.

### Tenant B (Teams tenant)
Owns:
- Teams user accounts and Teams policies.
- Teams app distribution/approval in Teams admin centre.
- Consent decisions for the multi-tenant Entra apps (service principals created in Tenant B).

---

## 2) Entra app registrations (Tenant A)

> **Recommended**: Use **two** app registrations:
> - **Bot App**: for Bot Framework authentication.
> - **Tab/API App**: for Teams tab SSO + backend API authorisation and role claims.

### 2.1 Bot App (multi-tenant)
Create an app registration:
- Supported account types: **Accounts in any organisational directory (multi-tenant)**.
- Add a client secret or certificate (recommend certificate).
- Record:
  - `BOT_APP_CLIENT_ID` (Application/Client ID)
  - `BOT_APP_TENANT_ID` (Tenant A ID)
  - credential reference (Key Vault secret/cert name)

**Bot framework configuration notes (verify for your SDK version):**
- Configure the bot runtime as multi-tenant (e.g., `MicrosoftAppType = MultiTenant` in .NET) so it accepts tokens for other tenants.
- Validate `issuer` and `audience` claims correctly (do not hard-code Tenant A only).
- Capture the Teams tenant ID from each activity (Teams includes tenant ID in activity channel data) and store it on the “case” record.

### 2.2 Tab/API App (multi-tenant with app roles)
Create an app registration:
- Supported account types: **multi-tenant**.
- Expose an API scope for your backend (e.g., `api://<clientId>/access_as_user`).
- Configure redirect URIs appropriate for Teams tab SSO (Teams iframe + auth popups).
- Define **app roles**:
  - `SalesUser` (default)
  - `SalesManager` (manager-wide access in the personal tab)
  - (Optional) `OpsAuditor` (read-only full access to audit bundles)

**Why app roles?**
- Avoid a Graph dependency for “manager” detection.
- Tenant B admin can assign roles to groups/users in Enterprise Apps.

---

## 3) Azure Bot resource (Tenant A)

Create the bot resource:
- Use the bot type Microsoft currently supports for new bots (as of 2025 this is often **Single Tenant** or **Managed Identity** bot types; verify in Azure portal).  
- Enable the **Microsoft Teams channel**.
- Configure the bot messaging endpoint to your Azure Function/Container App HTTPS endpoint.

**Important:** Even if the bot resource is “single tenant”, cross-tenant usage is enabled by making the Entra app registration multi-tenant and handling token validation accordingly. Verify this in current Microsoft documentation as of Dec 2025.

---

## 4) Teams app package and distribution (Tenant B)

### 4.1 Teams app package
Deliver a Teams app package (zip) containing:
- `manifest.json`
- `color.png` and `outline.png`
Include:
- Bot definition using the **Bot App client ID** from Tenant A.
- Personal tab definition pointing to your hosted tab URL (Tenant A).

### 4.2 Tenant B admin onboarding steps (operational runbook)
Tenant B admin must:
1. Upload the custom Teams app in **Teams admin centre** (Teams apps → Manage apps → Upload new app).
2. Ensure org-wide settings and app permission policies allow the custom app for the intended user group.
3. Complete Entra consent / service principal creation for:
   - Tab/API App (for SSO + API access)
   - (Optional) Bot App (if your bot uses OAuth sign-in or Graph delegated flows)

### 4.3 Cross-tenant access settings (Tenant B)
Most multi-tenant apps work without special “cross-tenant access settings”, but tenants with strict external collaboration policies can block outbound access to external apps/tenants.  
If sign-in/consent fails, Tenant B security/admin should review:
- External Identities → Cross-tenant access settings (outbound), and
- Enterprise applications → Consent and permissions.

---

## 5) File upload and download in a cross-tenant chat

### Preferred path (no Graph)
1. User uploads an .xlsx file to the bot in a 1:1 chat.
2. Bot receives an attachment payload including a file metadata object and a **download URL**.
3. Bot downloads the file immediately (URL is typically time-limited) and stores it to Blob Storage in Tenant A.

### Fallback path (Graph delegated, only if needed)
If the download URL cannot be retrieved from Tenant A (for example, tenant restrictions):
1. Bot sends a “Sign in to continue” card.
2. User signs in; bot obtains a delegated token for Tenant B.
3. Backend uses OBO flow to call Microsoft Graph to fetch the file content.
4. Continue as normal.

**Recommendation:** Implement telemetry to detect whether the preferred path works reliably across your tenants, and only ship the Graph fallback if needed.

---

## 6) Manager access and “My cases” personal tab (Tenant B users)

### My cases (SalesUser)
- List cases created by the signed-in user.
- Each case shows status (Needs input / Ready to create / Created in Zoho / Failed), and links to the audit bundle.

### Team cases (SalesManager)
- View cases for users in their team/org scope.
- Filter by salesperson, customer, status, and date.
- Export summary CSV (optional).

**Authorisation source (recommended):**
- App role claims from the Tab/API App (`SalesManager`) assigned by Tenant B admin.

---

## 7) What must be verified in Dec 2025

1. **Azure Bot creation options** and the current recommended “bot type” and auth pattern (Single Tenant vs Managed Identity) and how this interacts with multi-tenant Entra apps.
2. Whether Teams file `downloadUrl` is consistently retrievable from an external tenant bot **without Graph** in your tenant policies.
3. Teams admin policies in Tenant B: custom app upload, app permission policies, and any restrictions on external/multi-tenant apps.
4. Tab SSO configuration details (Teams JS SDK version, manifest requirements, Entra app settings).

