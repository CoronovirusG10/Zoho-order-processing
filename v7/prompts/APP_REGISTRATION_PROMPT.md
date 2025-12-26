# App Registrations & Tenant Setup Prompt (run manually in Azure Portal / CLI)

This prompt is intentionally separate: do **NOT** execute automatically. Use it as a checklist in portal or CLI.

## Goal
Deploy a Teams app (bot + personal tab) that is **hosted in Tenant A** but used in **Tenant B** (cross-tenant). We want:
- Bot in personal chat that supports file uploads (`supportsFiles: true` in manifest).
- Personal tab with SSO and role-based access (User vs Manager).
- Minimal Microsoft Graph permissions (prefer none; only add if later required).

## Important platform note (verify against current Microsoft docs)
Microsoft deprecated “Multi-tenant bot type” creation in Azure Bot Service after July 31, 2025. New bots must use **Single Tenant** or **User-assigned Managed Identity**. Your Entra app registration can still be multi-tenant for sign-in scenarios.

### Decision: Bot identity type
Choose one:
A) **User-assigned managed identity (recommended)**: avoids client secrets.
B) **Single-tenant app registration**: simpler conceptually, but uses a secret/cert.

## 1) Create core Azure resources (Tenant A)
- Resource group in Sweden Central.
- Azure Bot Service registration (for Teams channel).
- Hosting: Azure App Service or Azure Container Apps (where bot + API run).
- Storage: Blob Storage + Cosmos DB.
- Application Insights.

## 2) Create / configure identities (Tenant A)

### 2a) Bot identity (for Bot Framework)
If using **managed identity**:
- Create User Assigned Managed Identity (UAMI).
- Assign it to the hosting resource (App Service/Container App).
- Configure Azure Bot registration to use this identity.

If using **app registration**:
- Create Entra app “OrderProcessingBot” (Tenant A).
- Create secret or certificate.
- Record Application (client) ID and secret/cert reference.

### 2b) Tab SSO identity (multi-tenant)
Create Entra app “OrderProcessingTabSSO”:
- Supported account types: **Accounts in any organisational directory (multi-tenant)**.
- Expose an API: `api://<appId>` as the Application ID URI.
- Add an OAuth2 scope for your backend API (e.g., `access_as_user`).
- Add app roles:
  - `OrderProcessing.User`
  - `OrderProcessing.Manager`
- Configure redirect URIs required by your tab framework (Teams Toolkit will specify). Add both local dev and prod.

Notes:
- If you want to reuse one app registration for bot + tab, document and test carefully; separating them is typically easier for RBAC.

## 3) Teams app manifest (bot + tab)
In the Teams app manifest:
- `bots` section:
  - set `"supportsFiles": true`
  - include personal scope
- `staticTabs` section for personal tab:
  - contentUrl points to your hosted React app
  - websiteUrl as fallback
- `webApplicationInfo`:
  - set to Tab SSO app ID + resource

Prepare app package (manifest + icons).

## 4) Cross-tenant installation (Tenant B)
In Tenant B (customer/user tenant):
- Ensure Teams admin allows:
  - custom app upload / organisational app catalogue use (depending on distribution model)
  - external access policies as needed
- Upload the Teams app package to Tenant B’s Teams Admin Centre (or distribute via store/AppSource if that is your route).
- Grant admin consent for the SSO app (OrderProcessingTabSSO).
- Assign app roles:
  - standard users => `OrderProcessing.User`
  - managers => `OrderProcessing.Manager`

## 5) Optional: OAuth connection for bot sign-in
Only needed if you later require Graph delegated permissions, or if you want bot-initiated auth flows.
- Add OAuth connection in Azure Bot Service.
- Use the Entra app with multi-tenant audience if cross-tenant sign-in is required.
- Ensure redirect URL `https://token.botframework.com/.auth/web/redirect` exists on the app registration.

## 6) Verify end-to-end (manual test checklist)
- Install app in Tenant B.
- Start 1:1 chat with bot.
- Upload an `.xlsx`:
  - bot receives attachment metadata and can fetch file bytes.
- Open personal tab:
  - SSO works
  - user sees only their cases
  - managers see wider set
- Create draft order path hits Zoho sandbox.

## Output you must capture for the build (paste into Key Vault / config)
- Bot App ID (or MI client id)
- Bot secret/cert reference (if used)
- Tab SSO App ID
- Tenant B Tenant ID(s)
- Public base URL for bot/API
- Key Vault names + secret names
