# Claude Code: Pippa of London Tenant Bot Registration

**For: antonio@pippaoflondon.co.uk**
**Purpose: Complete Azure Bot setup in Pippa of London tenant**

---

## Context

You are helping Antonio, the admin of the **Pippa of London** Microsoft 365 tenant, set up the Azure Bot registration required for the Order Processing Teams app.

**CRITICAL:** The Azure Bot MUST be registered in the Pippa of London tenant (not 360innovate) due to Microsoft's July 31, 2025 multi-tenant bot deprecation.

## Tenant Information

| Item | Value |
|------|-------|
| Tenant Name | Pippa of London |
| Tenant ID | 23da91a5-0480-4183-8bc1-d7b6dd33dd2e |
| Admin | antonio@pippaoflondon.co.uk |
| Bot Messaging Endpoint | https://pippai-vm.360innovate.com/api/messages |

## Prerequisites

Before starting, verify:
1. You have Azure CLI installed: `az --version`
2. You have admin access to Pippa of London Azure/Entra ID
3. You have approximately 15-20 minutes

---

## Task 1: Login to Azure (Pippa of London Tenant)

```bash
# Login to Azure with Pippa of London tenant
az login --tenant 23da91a5-0480-4183-8bc1-d7b6dd33dd2e

# Verify you're in the correct tenant
az account show --query "{name:name, tenantId:tenantId}" -o table
```

**Expected output should show tenant ID: 23da91a5-0480-4183-8bc1-d7b6dd33dd2e**

If you have multiple subscriptions, select the Pippa of London subscription:
```bash
# List subscriptions
az account list --query "[].{name:name, id:id, isDefault:isDefault}" -o table

# Set the correct subscription (if needed)
az account set --subscription "<pippa-subscription-id>"
```

---

## Task 2: Create App Registration (Entra ID)

```bash
# Create the app registration
az ad app create \
  --display-name "Pippa-Order-Bot" \
  --sign-in-audience "AzureADMyOrg" \
  --query "{appId:appId, displayName:displayName}" \
  -o json

# Save the appId - this is your MICROSOFT_APP_ID
```

**⚠️ IMPORTANT: Copy the `appId` value - you will need it!**

Store it temporarily:
```bash
export MICROSOFT_APP_ID="<paste-the-appId-here>"
echo "App ID: ${MICROSOFT_APP_ID}"
```

---

## Task 3: Create Client Secret

```bash
# Create a client secret (24 month validity)
az ad app credential reset \
  --id "${MICROSOFT_APP_ID}" \
  --display-name "BotSecret" \
  --years 2 \
  --query "{password:password, endDateTime:endDateTime}" \
  -o json
```

**⚠️ CRITICAL: Copy the `password` value IMMEDIATELY - it will NOT be shown again!**

Store it temporarily:
```bash
export MICROSOFT_APP_PASSWORD="<paste-the-password-here>"
echo "Password saved (not displaying for security)"
```

---

## Task 4: Create Service Principal

```bash
# Create service principal for the app
az ad sp create --id "${MICROSOFT_APP_ID}"

# Verify it was created
az ad sp show --id "${MICROSOFT_APP_ID}" --query "{appId:appId, displayName:displayName}" -o table
```

---

## Task 5: Create Azure Bot Resource

First, check if you have a resource group or create one:

```bash
# List existing resource groups
az group list --query "[].{name:name, location:location}" -o table

# Create a new resource group if needed
az group create \
  --name "pippa-bot-rg" \
  --location "uksouth"
```

Now create the Azure Bot:

```bash
# Create the Azure Bot resource
az bot create \
  --resource-group "pippa-bot-rg" \
  --name "pippa-order-bot" \
  --kind "azurebot" \
  --sku "F0" \
  --app-type "SingleTenant" \
  --appid "${MICROSOFT_APP_ID}" \
  --tenant-id "23da91a5-0480-4183-8bc1-d7b6dd33dd2e" \
  --endpoint "https://pippai-vm.360innovate.com/api/messages" \
  --location "global"
```

**Note:** If the `az bot create` command is not available, you may need to install the bot extension:
```bash
az extension add --name bot
```

---

## Task 6: Configure Teams Channel

```bash
# Add Microsoft Teams channel to the bot
az bot msteams create \
  --resource-group "pippa-bot-rg" \
  --name "pippa-order-bot"
```

---

## Task 7: Verify Configuration

```bash
# Show bot configuration
az bot show \
  --resource-group "pippa-bot-rg" \
  --name "pippa-order-bot" \
  --query "{name:name, endpoint:properties.endpoint, appId:properties.msaAppId}" \
  -o table

# List channels
az bot show \
  --resource-group "pippa-bot-rg" \
  --name "pippa-order-bot" \
  --query "properties.enabledChannels" \
  -o json
```

**Verify:**
- ✅ Endpoint is: `https://pippai-vm.360innovate.com/api/messages`
- ✅ App ID matches your MICROSOFT_APP_ID
- ✅ Teams channel is enabled

---

## Task 8: Securely Transfer Credentials

**Option A: Azure Key Vault (Recommended)**

If you have access to the shared Key Vault:

```bash
# Store credentials in Key Vault
az keyvault secret set \
  --vault-name "pippai-keyvault-dev" \
  --name "MicrosoftAppId" \
  --value "${MICROSOFT_APP_ID}"

az keyvault secret set \
  --vault-name "pippai-keyvault-dev" \
  --name "MicrosoftAppPassword" \
  --value "${MICROSOFT_APP_PASSWORD}"

echo "✅ Credentials stored in Key Vault"
```

**Option B: Secure File Transfer**

If Key Vault access is not available:

```bash
# Create encrypted credentials file
cat > /tmp/bot-credentials.txt << EOF
# Pippa Order Bot Credentials
# Generated: $(date -Is)
# DO NOT SHARE VIA EMAIL

MICROSOFT_APP_ID=${MICROSOFT_APP_ID}
MICROSOFT_APP_PASSWORD=${MICROSOFT_APP_PASSWORD}
EOF

# Display for secure copy
echo "========================================"
echo "CREDENTIALS (copy to secure channel):"
echo "========================================"
cat /tmp/bot-credentials.txt
echo "========================================"

# Clean up immediately after copying
rm /tmp/bot-credentials.txt
```

**Transfer via:**
- Microsoft Teams direct message (to DevOps team member)
- OneDrive shared file with expiring link
- Azure Key Vault (preferred)

**⚠️ NEVER send credentials via email!**

---

## Task 9: Notify DevOps Team

Send this message to the DevOps team:

```
Subject: Pippa Order Bot - Credentials Ready

Bot registration completed in Pippa of London tenant.

App Registration: Pippa-Order-Bot
Azure Bot: pippa-order-bot
Resource Group: pippa-bot-rg
Messaging Endpoint: https://pippai-vm.360innovate.com/api/messages
Teams Channel: Enabled

Credentials have been:
[ ] Stored in Key Vault (pippai-keyvault-dev)
[ ] Shared via secure channel (specify method)

Please update .env on pippai-vm and continue deployment.
```

---

## Verification Checklist

Before notifying DevOps, verify:

- [ ] App Registration created in Pippa of London tenant
- [ ] App is **Single Tenant** (not multi-tenant)
- [ ] Client Secret created (24 month expiry)
- [ ] Service Principal created
- [ ] Azure Bot resource created
- [ ] Messaging endpoint set to `https://pippai-vm.360innovate.com/api/messages`
- [ ] Microsoft Teams channel enabled
- [ ] Credentials securely transferred

---

## Troubleshooting

### "Insufficient privileges"
You need Global Administrator or Application Administrator role in Entra ID.

### "Subscription not found"
Ensure you're logged into the correct tenant:
```bash
az login --tenant 23da91a5-0480-4183-8bc1-d7b6dd33dd2e
```

### "Bot extension not found"
```bash
az extension add --name bot
az extension update --name bot
```

### "Resource provider not registered"
```bash
az provider register --namespace Microsoft.BotService
az provider show --namespace Microsoft.BotService --query "registrationState"
```

---

## Alternative: Azure Portal Steps

If CLI doesn't work, use Azure Portal:

1. **Go to:** https://portal.azure.com
2. **Switch directory** to Pippa of London (top right)
3. **Create App Registration:**
   - Search "App registrations" → New registration
   - Name: `Pippa-Order-Bot`
   - Supported account types: **Single tenant**
   - Register → Copy Application (client) ID
   - Certificates & secrets → New client secret → Copy value immediately
4. **Create Azure Bot:**
   - Search "Azure Bot" → Create
   - Bot handle: `pippa-order-bot`
   - Type: **Single Tenant**
   - App ID: paste from step 3
   - Messaging endpoint: `https://pippai-vm.360innovate.com/api/messages`
5. **Enable Teams:**
   - Go to bot → Channels → Microsoft Teams → Save

---

## Summary of Values to Send to DevOps

| Item | Value |
|------|-------|
| MICROSOFT_APP_ID | `<the appId from Task 2>` |
| MICROSOFT_APP_PASSWORD | `<the password from Task 3>` |
| Bot Resource Group | pippa-bot-rg |
| Bot Name | pippa-order-bot |

**After DevOps updates .env, they will run Phase 6 validation and continue deployment.**
