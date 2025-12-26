# Teams App Manifest

This directory contains the Teams app manifest and related assets for deploying the Order Processing Bot to Microsoft Teams.

## Files Required

1. **manifest.json** - App configuration (included, use as template)
2. **color.png** - 192x192 color icon
3. **outline.png** - 32x32 outline icon

## Configuration

Before packaging, replace the following placeholders in `manifest.json`:

- `{{MICROSOFT_APP_ID}}` - Your bot's Microsoft App ID from Azure
- `{{TAB_URL}}` - URL where the Teams tab is hosted
- `{{YOUR_DOMAIN}}` - Your organization's domain

## Creating Icons

### Color Icon (color.png)

- Size: 192x192 pixels
- Format: PNG
- Purpose: Displayed in Teams app catalog and chat
- Should include your company branding/logo

### Outline Icon (outline.png)

- Size: 32x32 pixels
- Format: PNG with transparency
- Purpose: Displayed in Teams left rail
- Should be a simple, recognizable outline

## Packaging

Once you have all three files ready:

```bash
cd manifest
zip ../teams-app.zip manifest.json color.png outline.png
```

## Uploading to Teams

### For Testing (Sideload)

1. Open Teams
2. Click "Apps" in the left sidebar
3. Click "Manage your apps" (bottom)
4. Click "Upload an app"
5. Select "Upload a custom app"
6. Choose `teams-app.zip`

### For Organization (Tenant B)

1. Go to Teams Admin Center: https://admin.teams.microsoft.com
2. Navigate to "Teams apps" > "Manage apps"
3. Click "Upload new app"
4. Upload `teams-app.zip`
5. Configure app setup policies to make it available to users
6. (Optional) Set as installed by default for specific users/groups

## Permissions

The bot requires the following permissions:

- **identity** - To authenticate users for the personal tab
- **messageTeamMembers** - To send messages in 1:1 chat

## Consent

Tenant B admin must grant consent for:

1. Bot to send messages to users
2. (If using Graph API fallback) Files.Read for downloading attachments

## Manifest Fields Explained

### Basic Info

- `id` - Must match your Microsoft App ID
- `packageName` - Unique identifier (reverse domain notation)
- `version` - Increment for each update

### Bot Configuration

- `scopes: ["personal"]` - Bot only works in 1:1 chat
- `supportsFiles: true` - Allows file uploads
- `commandLists` - Suggested commands shown to users

### Static Tabs

- `mycases` - Personal tab for viewing case history
- Requires separate tab application (see services/teams-tab)

### Valid Domains

- Add all domains your bot/tab uses
- Required for authentication and content loading

## Updating the Manifest

After making changes:

1. Increment the `version` field
2. Re-package the app
3. Re-upload to Teams Admin Center
4. Users may need to update the app

## Troubleshooting

### App doesn't appear in Teams

- Check if app is approved in Teams Admin Center
- Verify user has permission via app setup policy
- Try removing and re-adding the app

### Bot doesn't respond

- Verify `botId` matches your Microsoft App ID
- Check messaging endpoint in Azure Bot Service
- Review bot service logs

### File uploads fail

- Confirm `supportsFiles: true` is set
- Check bot has proper scopes configured
- Verify attachment handling in bot code

## Reference

- [Teams App Manifest Schema](https://docs.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema)
- [Teams App Distribution](https://docs.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/overview)
