# 11 — Pippa of London Tenant Admin Checklist

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Generate a detailed, step-by-step checklist for antonio@pippaoflondon.co.uk to complete the Azure Bot and App Registration in the Pippa of London tenant.

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `11_PIPPA_TENANT_CHECKLIST_REPORT.md`
- `PIPPA_ADMIN_CHECKLIST.md` (ready to send to admin)

Then print a **Paste-Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print any secrets or tokens.
- This is a documentation generation task - no Azure actions.
- Output must be clear for a non-technical admin.

## Key Architecture Details

| Item | Value |
|------|-------|
| Pippa of London Tenant ID | 23da91a5-0480-4183-8bc1-d7b6dd33dd2e |
| Admin Email | antonio@pippaoflondon.co.uk |
| Bot Messaging Endpoint | https://processing.pippaoflondon.co.uk/api/messages |
| Bot Name | Pippa Order Bot |
| Required Permissions | None (bot uses delegated user context) |

## CRITICAL: Why Pippa of London Tenant?

Microsoft is deprecating multi-tenant bot registrations on **July 31, 2025**. The Azure Bot MUST be registered in the same tenant as the Teams users (Pippa of London), not in the infrastructure tenant (360innovate).

## Steps
1) Setup logging helper.
2) Read existing documentation for context:
   - `CROSS_TENANT_TEAMS_DEPLOYMENT.md`
   - `docs/BOT_REGISTRATION_GUIDE_PIPPA.md`
3) Generate `PIPPA_ADMIN_CHECKLIST.md` with these sections:

### Section 1: Prerequisites
- Admin access to Azure Portal (portal.azure.com)
- Admin access to Entra ID (entra.microsoft.com) for Pippa of London
- Approximately 30 minutes

### Section 2: Create App Registration (Entra ID)
Step-by-step with Azure Portal navigation:
1. Go to portal.azure.com
2. Switch to Pippa of London directory
3. Navigate to: Entra ID > App registrations > New registration
4. Configure:
   - Name: `Pippa-Order-Bot`
   - Supported account types: **Single tenant** (Pippa of London only)
   - Redirect URI: Leave blank for now
5. After creation, note the **Application (client) ID** - this is MicrosoftAppId
6. Go to: Certificates & secrets > New client secret
7. Create secret with 24-month expiry
8. **IMMEDIATELY COPY** the secret value - this is MicrosoftAppPassword
9. Store both values securely

### Section 3: Tab SSO Configuration (If Required)
If personal tab needs SSO authentication:
1. Go to: App registration > Authentication
2. Add platform: Single-page application
3. Add redirect URI: `https://processing.pippaoflondon.co.uk/auth-end`
4. Enable: Access tokens, ID tokens (implicit flow)
5. Save changes

### Section 4: Create Azure Bot Resource
Step-by-step:
1. Go to portal.azure.com
2. Switch to Pippa of London directory
3. Search for "Azure Bot"
4. Click Create
5. Configure:
   - Bot handle: `pippa-order-bot`
   - Subscription: (Pippa of London subscription)
   - Resource group: Create new or use existing
   - Pricing: F0 (Free) for dev
   - Type of App: **Single Tenant**
   - App ID: Enter the MicrosoftAppId from Section 2
   - App Tenant ID: `23da91a5-0480-4183-8bc1-d7b6dd33dd2e`
6. Click Create

### Section 5: Configure Messaging Endpoint
1. Go to the created Azure Bot resource
2. Navigate to: Configuration
3. Set Messaging endpoint: `https://processing.pippaoflondon.co.uk/api/messages`
4. Save

### Section 6: Enable Teams Channel
1. In Azure Bot, go to: Channels
2. Click Microsoft Teams
3. Accept terms
4. Click Apply

### Section 7: Securely Transfer Credentials
**IMPORTANT: Do not email credentials in plaintext.**

Option A (Recommended - Azure Key Vault):
1. Ask DevOps for Key Vault access
2. Store in: pippai-keyvault-dev
3. Secret names: `MicrosoftAppId`, `MicrosoftAppPassword`

Option B (Alternative - Secure file transfer):
1. Use encrypted file sharing (OneDrive with link expiry)
2. Send link separately from password

Credentials to transfer:
- `MicrosoftAppId`: [the Application ID from Section 2]
- `MicrosoftAppPassword`: [the Client Secret from Section 2]

### Section 8: Verification Checklist
- [ ] App Registration created in Pippa of London tenant
- [ ] App is Single Tenant (not multi-tenant)
- [ ] Client Secret created and securely stored
- [ ] Azure Bot created in Pippa of London subscription
- [ ] Messaging endpoint set to https://processing.pippaoflondon.co.uk/api/messages
- [ ] Teams channel enabled
- [ ] Credentials securely transferred to DevOps team

### Section 9: What Happens Next
After you complete this checklist:
1. DevOps will update the VM with credentials
2. DevOps will run validation (14_POST_MANUAL_VALIDATION)
3. DevOps will build the Teams app package
4. You will upload the package to Teams Admin Center

4) Write report summarizing:
   - Checklist generated at: [path]
   - Key instructions included
   - Ready to send to: antonio@pippaoflondon.co.uk
5) Print Paste-Back Report block.
