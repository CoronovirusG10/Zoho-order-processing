# Pippa of London Admin Checklist: Azure Bot Registration

**For:** antonio@pippaoflondon.co.uk
**Tenant:** Pippa of London
**Tenant ID:** 23da91a5-0480-4183-8bc1-d7b6dd33dd2e
**Estimated Time:** 30 minutes
**Date:** 2025-12-29

---

## Why This Is Needed

Microsoft is deprecating multi-tenant bot registrations on **July 31, 2025**. The Azure Bot must be registered in the same tenant as the Teams users (Pippa of London), not in the infrastructure tenant (360innovate). This ensures long-term compatibility and compliance.

---

## Section 1: Prerequisites

Before starting, ensure you have:

- [ ] **Admin access** to Azure Portal (portal.azure.com)
- [ ] **Admin access** to Microsoft Entra ID (entra.microsoft.com) for Pippa of London
- [ ] A **secure location** to temporarily store credentials (password manager recommended)
- [ ] Approximately **30 minutes** of uninterrupted time

---

## Section 2: Create App Registration (Entra ID)

This creates the identity for the bot.

### Step-by-Step

1. **Open Azure Portal**
   - Go to: https://portal.azure.com
   - Sign in as antonio@pippaoflondon.co.uk

2. **Verify you're in the correct directory**
   - Click your profile icon (top right)
   - Under "Directories + subscriptions", confirm it shows **Pippa of London**
   - If not, click "Switch" to change to Pippa of London directory

3. **Navigate to App registrations**
   - In the search bar, type: `Microsoft Entra ID`
   - Click on it, then select **App registrations** from the left menu
   - Click **+ New registration**

4. **Configure the registration**

   | Field | Value |
   |-------|-------|
   | **Name** | `Pippa-Order-Bot` |
   | **Supported account types** | Accounts in this organizational directory only (Single tenant) |
   | **Redirect URI** | Leave blank (we'll add this later if needed) |

5. **Click Register**

6. **Record the Application (client) ID**
   - After creation, you'll see the Overview page
   - Copy the **Application (client) ID** value
   - Write it here: `_____________________________________________`
   - This is your **MicrosoftAppId**

---

## Section 3: Create Client Secret

The bot needs a secret to authenticate.

### Step-by-Step

1. In your new App Registration, click **Certificates & secrets** (left menu)

2. Under "Client secrets", click **+ New client secret**

3. Configure:

   | Field | Value |
   |-------|-------|
   | **Description** | `Pippa Order Bot Production Secret` |
   | **Expires** | 24 months |

4. Click **Add**

5. **CRITICAL: Copy the secret value IMMEDIATELY**
   - The secret value is only shown once
   - After you leave this page, you cannot retrieve it
   - Write it here: `_____________________________________________`
   - This is your **MicrosoftAppPassword**

---

## Section 4: Tab SSO Configuration (If Required)

Complete this section only if the personal tab needs SSO authentication.

### Step-by-Step

1. In your App Registration, click **Authentication** (left menu)

2. Click **+ Add a platform**

3. Select **Single-page application**

4. Configure:

   | Field | Value |
   |-------|-------|
   | **Redirect URIs** | `https://pippai-vm.360innovate.com/auth-end` |

5. Under "Implicit grant and hybrid flows", check:
   - [x] **Access tokens**
   - [x] **ID tokens**

6. Click **Configure**

7. Click **Save**

---

## Section 5: Create Azure Bot Resource

This creates the bot service that connects to Microsoft Teams.

### Step-by-Step

1. **Return to Azure Portal home**
   - Go to: https://portal.azure.com

2. **Verify directory**
   - Confirm you're still in the **Pippa of London** directory

3. **Create the bot resource**
   - Click **+ Create a resource**
   - Search for: `Azure Bot`
   - Click **Azure Bot** in results
   - Click **Create**

4. **Configure the bot**

   | Field | Value |
   |-------|-------|
   | **Bot handle** | `pippa-order-bot` |
   | **Subscription** | (Select your Pippa of London subscription) |
   | **Resource group** | Create new: `pippa-order-bot-rg` |
   | **Data residency** | Global |
   | **Pricing tier** | F0 (Free) for development |
   | **Type of App** | **Single Tenant** (IMPORTANT!) |
   | **Creation type** | Use existing app registration |
   | **App ID** | (Paste the MicrosoftAppId from Section 2) |
   | **App Tenant ID** | `23da91a5-0480-4183-8bc1-d7b6dd33dd2e` |

5. Click **Review + create**

6. Review the settings, then click **Create**

7. Wait for deployment to complete (1-2 minutes)

---

## Section 6: Configure Messaging Endpoint

Tell the bot where to send messages.

### Step-by-Step

1. After deployment completes, click **Go to resource**

2. In the left menu, click **Configuration**

3. Find the **Messaging endpoint** field

4. Enter exactly:
   ```
   https://pippai-vm.360innovate.com/api/messages
   ```

5. Click **Apply** (top of page)

---

## Section 7: Enable Teams Channel

Connect the bot to Microsoft Teams.

### Step-by-Step

1. In your Azure Bot resource, click **Channels** (left menu)

2. Under "Available channels", click **Microsoft Teams**

3. Read and accept the **Terms of Service**

4. Click **Apply**

5. Verify the Teams channel shows status: **Running**

---

## Section 8: Securely Transfer Credentials

**IMPORTANT:** Never email credentials in plaintext.

### Option A: Azure Key Vault (Recommended)

1. Contact the DevOps team to request Key Vault access
2. They will provide instructions to store secrets in: `pippai-keyvault-dev`
3. Store with these names:
   - `MicrosoftAppId`: (Application ID from Section 2)
   - `MicrosoftAppPassword`: (Client Secret from Section 3)

### Option B: Secure File Sharing

1. Create a text file with the credentials:
   ```
   MicrosoftAppId=<paste Application ID here>
   MicrosoftAppPassword=<paste Client Secret here>
   MicrosoftAppType=SingleTenant
   MicrosoftAppTenantId=23da91a5-0480-4183-8bc1-d7b6dd33dd2e
   ```

2. Upload to OneDrive and create a **sharing link with expiry**:
   - Set link to expire in 24 hours
   - Require password to access

3. Send the sharing link via email

4. Send the password via a separate channel (e.g., Teams message or phone)

5. Confirm DevOps has received and stored the credentials

6. **Delete the OneDrive file** after confirmation

---

## Section 9: Verification Checklist

Before marking this task complete, verify:

- [ ] App Registration created in Pippa of London tenant
- [ ] App Registration name: `Pippa-Order-Bot`
- [ ] App is **Single Tenant** (not multi-tenant)
- [ ] Client Secret created with 24-month expiry
- [ ] Client Secret value securely copied and stored
- [ ] Azure Bot resource created in Pippa of London subscription
- [ ] Azure Bot type: **Single Tenant**
- [ ] Messaging endpoint set to: `https://pippai-vm.360innovate.com/api/messages`
- [ ] Microsoft Teams channel enabled and showing "Running"
- [ ] Credentials securely transferred to DevOps team
- [ ] Temporary credential files deleted after transfer

---

## Section 10: What Happens Next

After you complete this checklist:

1. **DevOps updates the VM**
   - The 360innovate DevOps team will configure the server with your credentials

2. **Validation testing**
   - DevOps runs automated validation to verify connectivity

3. **Teams app package**
   - DevOps builds the Teams app manifest package

4. **You upload to Teams**
   - You'll receive the package and upload it to Teams Admin Center

5. **User rollout**
   - The bot becomes available to Pippa of London Teams users

---

## Quick Reference: Credentials to Transfer

| Credential | Description |
|------------|-------------|
| **MicrosoftAppId** | Application (client) ID from Section 2 |
| **MicrosoftAppPassword** | Client Secret value from Section 3 |
| **MicrosoftAppType** | `SingleTenant` (fixed value) |
| **MicrosoftAppTenantId** | `23da91a5-0480-4183-8bc1-d7b6dd33dd2e` (fixed value) |

---

## Troubleshooting

### Cannot find Pippa of London directory
- Sign out completely and sign back in
- Use an InPrivate/Incognito browser window
- Verify your account has admin permissions

### App Registration fails
- Ensure you have Global Administrator or Application Administrator role
- Check if there's already an app with the same name

### Azure Bot creation fails
- Verify you selected the correct subscription
- Ensure the App ID hasn't been used for another bot
- Try a different bot handle name

### Need help?
- Contact: 360innovate DevOps team
- Include: Screenshot of error, steps you followed

---

*Document generated: 2025-12-29*
*Architecture: Single-tenant bot in Pippa of London tenant*
*Bot messaging endpoint: https://pippai-vm.360innovate.com/api/messages*
