# Cross-Tenant Teams Deployment

## Scenario

- **Tenant A (Hosting)**: Azure resources, Entra app registrations
- **Tenant B (Users)**: Teams users who interact with the bot

## Entra App Registrations (Tenant A)

### 1. Bot App Registration

1. Go to Azure Portal → Entra ID → App Registrations
2. New Registration:
   - Name: `Order Processing Bot`
   - Supported account types: **Accounts in any organizational directory (Multi-tenant)**
   - Redirect URI: (leave blank for now)

3. After creation:
   - Note the **Application (client) ID** → `BOT_APP_CLIENT_ID`
   - Note the **Directory (tenant) ID** → `BOT_APP_TENANT_ID`

4. Certificates & Secrets:
   - Create a new client secret
   - Store in Key Vault as `BotAppSecret`

### 2. Tab/API App Registration

1. New Registration:
   - Name: `Order Processing Tab`
   - Supported account types: **Multi-tenant**
   - Redirect URI: `https://your-tab-url.azurestaticapps.net/auth-end`

2. Expose an API:
   - Application ID URI: `api://{your-client-id}`
   - Add scope: `access_as_user`
   - Authorized client applications: Add Teams clients
     - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop)
     - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)

3. App Roles:
   - `SalesUser` - Default access
   - `SalesManager` - Team-wide access
   - `OpsAuditor` - Read-only audit access

## Teams App Package

### manifest.json

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "{{BOT_APP_CLIENT_ID}}",
  "packageName": "com.yourcompany.orderprocessing",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://yourcompany.com",
    "privacyUrl": "https://yourcompany.com/privacy",
    "termsOfUseUrl": "https://yourcompany.com/terms"
  },
  "name": {
    "short": "Order Processing",
    "full": "Order Processing Bot"
  },
  "description": {
    "short": "Upload Excel orders to create Zoho drafts",
    "full": "Upload Excel order files via chat. The bot validates, extracts data, and creates Draft Sales Orders in Zoho Books."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0078D4",
  "bots": [
    {
      "botId": "{{BOT_APP_CLIENT_ID}}",
      "scopes": ["personal"],
      "supportsFiles": true,
      "isNotificationOnly": false
    }
  ],
  "staticTabs": [
    {
      "entityId": "cases",
      "name": "My Cases",
      "contentUrl": "https://your-tab-url.azurestaticapps.net?context=cases",
      "scopes": ["personal"]
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": [
    "your-tab-url.azurestaticapps.net",
    "your-api.azurecontainerapps.io"
  ],
  "webApplicationInfo": {
    "id": "{{TAB_APP_CLIENT_ID}}",
    "resource": "api://{{TAB_APP_CLIENT_ID}}"
  }
}
```

## Tenant B Admin Steps

### 1. Upload Custom App

1. Go to Teams Admin Center (admin.teams.microsoft.com)
2. Teams apps → Manage apps → Upload new app
3. Upload the app package (manifest + icons as .zip)

### 2. App Permission Policies

1. Teams apps → Permission policies
2. Ensure the policy allows custom apps
3. Assign policy to target users

### 3. Consent to Entra Apps

1. Enterprise Applications → Order Processing Tab
2. Grant admin consent for API permissions

### 4. Assign App Roles

1. Enterprise Applications → Order Processing Tab
2. Users and groups → Add assignment
3. Assign `SalesManager` role to manager group

## File Download Behavior

### Primary Path (Preferred)
The bot receives attachment metadata with a `downloadUrl`. The backend downloads directly using this URL without Graph API.

### Fallback Path (If Needed)
If cross-tenant restrictions block direct download:
1. Bot prompts user to sign in
2. Uses OBO flow to get delegated Graph token
3. Downloads file via Graph API

### Testing Cross-Tenant Download

```bash
# Test from backend (Tenant A)
curl -H "Authorization: Bearer $BOT_TOKEN" \
  "https://graph.microsoft.com/v1.0/..." \
  --output test.xlsx
```

If this fails with 403, implement the OAuth fallback.

## Troubleshooting

### "App not available" Error
- Check app permission policies in Tenant B
- Verify custom apps are allowed org-wide

### SSO Token Fails
- Verify redirect URIs match exactly
- Check authorized client applications include Teams
- Verify Entra admin consent granted

### File Download Fails
- Check if download URL is time-limited (usually ~1 hour)
- Implement immediate download on file receive
- Add Graph fallback if needed

### Cross-Tenant Access Blocked
- Check External Identities → Cross-tenant access settings
- May need outbound access policy for Tenant A
