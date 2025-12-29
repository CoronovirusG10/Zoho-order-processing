# Bot Registration Guide for Pippa of London

**For:** antonio@pippaoflondon.co.uk
**Tenant:** Pippa of London (23da91a5-0480-4183-8bc1-d7b6dd33dd2e)
**Purpose:** Register the Order Processing bot in your tenant

---

## Overview

The Order Processing bot needs to be registered in the **Pippa of London tenant** so that Teams users in your organization can interact with it. The bot's backend runs on a VM in the 360innovate tenant, but the bot registration lives in your tenant.

---

## Step 1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in as **antonio@pippaoflondon.co.uk**
3. Navigate to **Microsoft Entra ID** > **App registrations** > **New registration**

### Registration Details

| Field | Value |
|-------|-------|
| **Name** | `order-processing-bot` |
| **Supported account types** | Accounts in this organizational directory only (Single tenant) |
| **Redirect URI** | Leave blank |

4. Click **Register**

### Copy Important Values

After registration, copy these values (you'll need them later):

- **Application (client) ID**: `________________________________________`
- **Directory (tenant) ID**: Should be `23da91a5-0480-4183-8bc1-d7b6dd33dd2e`

---

## Step 2: Create Client Secret

1. In your new App Registration, go to **Certificates & secrets**
2. Click **New client secret**

| Field | Value |
|-------|-------|
| **Description** | `Order Processing Bot Secret` |
| **Expires** | 24 months (recommended) |

3. Click **Add**
4. **IMPORTANT**: Copy the secret value immediately - you won't be able to see it again!

- **Client Secret Value**: `________________________________________`

---

## Step 3: Create Azure Bot Resource

1. Go to [Azure Portal](https://portal.azure.com) > **Create a resource**
2. Search for **Azure Bot** and click **Create**

### Bot Configuration

| Field | Value |
|-------|-------|
| **Bot handle** | `order-processing-bot` |
| **Subscription** | Your Pippa of London subscription |
| **Resource group** | Create new: `order-processing-rg` |
| **Data residency** | Global |
| **Pricing tier** | Standard (free for Teams channel) |
| **Type of App** | **Single Tenant** |
| **Creation type** | Use existing app registration |
| **App ID** | Paste the Application (client) ID from Step 1 |
| **App tenant ID** | `23da91a5-0480-4183-8bc1-d7b6dd33dd2e` |

3. Click **Review + create** > **Create**

---

## Step 4: Configure Messaging Endpoint

1. Go to your new Azure Bot resource
2. Go to **Configuration**
3. Set the **Messaging endpoint**:

```
https://processing.pippaoflondon.co.uk/api/messages
```

4. Click **Apply**

---

## Step 5: Enable Teams Channel

1. In your Azure Bot, go to **Channels**
2. Click **Microsoft Teams**
3. Accept the Terms of Service
4. Click **Apply**

The Teams channel should now show as "Running".

---

## Step 6: Package Teams App

You'll need to create a Teams app package (.zip) with the following files:

### manifest.json

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "manifestVersion": "1.17",
  "version": "1.0.0",
  "id": "<YOUR-APP-ID-FROM-STEP-1>",
  "packageName": "com.pippaoflondon.orderprocessing",
  "developer": {
    "name": "Pippa of London",
    "websiteUrl": "https://pippaoflondon.co.uk",
    "privacyUrl": "https://pippaoflondon.co.uk/privacy",
    "termsOfUseUrl": "https://pippaoflondon.co.uk/terms"
  },
  "name": {
    "short": "Order Processing",
    "full": "Pippa of London Order Processing"
  },
  "description": {
    "short": "Upload Excel orders for processing",
    "full": "Upload Excel spreadsheets containing customer orders. The bot will parse, validate, and create draft sales orders in Zoho Books."
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "accentColor": "#4F46E5",
  "bots": [
    {
      "botId": "<YOUR-APP-ID-FROM-STEP-1>",
      "scopes": ["personal"],
      "supportsFiles": true,
      "isNotificationOnly": false,
      "commandLists": [
        {
          "scopes": ["personal"],
          "commands": [
            {
              "title": "help",
              "description": "Show help information"
            },
            {
              "title": "status",
              "description": "Check order status"
            }
          ]
        }
      ]
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": [
    "processing.pippaoflondon.co.uk"
  ]
}
```

### Icons Required

- **color.png**: 192x192 pixel color icon
- **outline.png**: 32x32 pixel outline icon (white on transparent)

### Create the Package

1. Put all three files in a folder
2. Select all files and create a .zip file
3. Name it `order-processing-teams-app.zip`

---

## Step 7: Upload to Teams Admin Center

1. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
2. Sign in as **antonio@pippaoflondon.co.uk**
3. Navigate to **Teams apps** > **Manage apps**
4. Click **Upload new app**
5. Select your `order-processing-teams-app.zip` file
6. Click **Upload**

---

## Step 8: Configure App Policies

1. In Teams Admin Center, go to **Teams apps** > **Permission policies**
2. Either:
   - Edit the **Global (Org-wide default)** policy, OR
   - Create a new policy for specific users

3. Under **Custom apps**, set to **Allow all apps**
4. Click **Save**

---

## Step 9: Provide Credentials to DevOps

Send these values securely to the 360innovate DevOps team:

```
MicrosoftAppId=<Application (client) ID from Step 1>
MicrosoftAppPassword=<Client Secret from Step 2>
MicrosoftAppType=SingleTenant
MicrosoftAppTenantId=23da91a5-0480-4183-8bc1-d7b6dd33dd2e
```

They will configure these on the pippai-vm server.

---

## Step 10: Test the Bot

1. Open Microsoft Teams
2. Go to **Apps** > **Built for your org**
3. Find "Order Processing" and click **Add**
4. Start a chat with the bot
5. Send "help" to verify it responds
6. Try uploading a test Excel file

---

## Troubleshooting

### Bot doesn't appear in Teams

- Wait 10-15 minutes for app to propagate
- Check that the app is approved in Teams Admin Center
- Verify app permission policies allow the app

### Bot doesn't respond

- Verify the messaging endpoint is correct
- Check that the SSL certificate is valid
- Contact 360innovate DevOps to check server logs

### "Unable to reach app" error

- The VM may be down - contact 360innovate DevOps
- SSL certificate may have expired

---

## Contact

| Role | Contact |
|------|---------|
| **Teams App Issues** | antonio@pippaoflondon.co.uk |
| **Server/Backend Issues** | 360innovate DevOps |

---

*Document created: 2025-12-27*
*Architecture: Single-tenant bot in user tenant*
