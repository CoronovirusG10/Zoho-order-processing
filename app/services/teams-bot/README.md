# Teams Bot Service

The Teams bot service handles the Microsoft Teams integration for the order processing application. It provides a 1:1 chat interface where users can upload Excel files containing sales orders, receive processing updates via adaptive cards, and approve orders for creation in Zoho Books.

## Architecture

This service is built using the Bot Framework SDK and implements a multi-tenant bot that can be deployed to Tenant A (hosting) while serving users in Tenant B (Teams tenant).

### Key Components

- **Bot Class** (`bot.ts`): Main bot logic extending `TeamsActivityHandler`
- **Handlers**: Separate handlers for file uploads, card submissions, and messages
- **Middleware**: Correlation, logging, and error handling
- **Cards**: Adaptive card builders for different states (processing, issues, review, success)
- **Services**: File download and case management services

## Features

### Multi-Tenant Support

The bot is configured as a multi-tenant application (`MicrosoftAppType: MultiTenant`) to support cross-tenant scenarios where:
- Azure workload runs in Tenant A
- Teams users are in Tenant B
- Tenant ID is extracted from `activity.channelData.tenant.id`

### File Upload Processing

1. User uploads Excel file in Teams chat
2. Bot downloads file from Teams attachment URL
3. File is uploaded to Azure Blob Storage (`orders-incoming/{caseId}/original.xlsx`)
4. Case record is created with correlation ID
5. Processing card is posted to user
6. Parser workflow is triggered

### Adaptive Cards

The bot posts different adaptive cards based on processing state:

- **ProcessingCard**: Shows while parsing/validating
- **IssuesCard**: Lists blocking issues with correction inputs
- **ReviewCard**: Order preview with approve/reject buttons
- **SuccessCard**: Zoho link and audit bundle download

### Status Updates

External services (parser, workflow) can post status updates back to the user via the `/api/status` endpoint.

## Configuration

### Environment Variables

```bash
# Microsoft App credentials
MICROSOFT_APP_ID=<your-app-id>
MICROSOFT_APP_PASSWORD=<your-app-password>
MICROSOFT_APP_TYPE=MultiTenant
MICROSOFT_APP_TENANT_ID=<tenant-a-id>

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=<storage-account>
AZURE_STORAGE_CONTAINER_INCOMING=orders-incoming

# Service endpoints
PARSER_ENDPOINT=http://localhost:3001
WORKFLOW_ENDPOINT=http://localhost:3002

# Server
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

### Multi-Tenant Configuration

The bot validates tokens from multiple tenants:
- `MicrosoftAppType` is set to `MultiTenant`
- Issuer and audience claims are validated correctly
- Tenant ID is captured from each activity's channel data

## API Endpoints

### `POST /api/messages`

Bot Framework messaging endpoint. Receives activities from Teams.

### `POST /api/status`

Receives status updates from backend services to post to users.

**Request Body:**
```json
{
  "conversationReference": { ... },
  "card": { ... }
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "teams-bot",
  "timestamp": "2025-12-25T..."
}
```

## Security

### Credential Management

- Uses `DefaultAzureCredential` for Azure services (Managed Identity in production)
- Bot Framework credentials stored in environment variables
- No user tokens or file contents are logged

### Cross-Tenant File Download

Primary path: Direct download from Teams attachment `downloadUrl`
Fallback path: Graph API with OBO token (not yet implemented)

### Data Privacy

- All activities logged with correlation ID
- File contents never logged
- User tokens never logged
- Structured logging in JSON format

## Development

### Build

```bash
npm install
npm run build
```

### Run

```bash
npm run dev
```

### Test

```bash
npm test
```

## Deployment

### Azure Bot Service

1. Create Azure Bot resource in Tenant A
2. Configure multi-tenant app registration
3. Enable Teams channel
4. Set messaging endpoint to `https://<your-domain>/api/messages`

### Teams App Package

Create `manifest.json` with:
- Bot definition using `MICROSOFT_APP_ID`
- Personal chat scope
- Required permissions

Upload to Tenant B Teams admin center.

## Dependencies

- `botbuilder`: Bot Framework SDK
- `@azure/identity`: Azure authentication
- `@azure/storage-blob`: Blob storage client
- `express`: Web server
- `@order-processing/types`: Shared type definitions
- `@order-processing/shared`: Shared utilities

## Logging

All logs are output in structured JSON format with:
- `correlationId`: Request correlation ID
- `timestamp`: ISO 8601 timestamp
- `event`: Event type
- Additional context fields

Example:
```json
{
  "correlationId": "abc-123",
  "level": "info",
  "message": "Case created",
  "caseId": "def-456",
  "timestamp": "2025-12-25T10:00:00.000Z"
}
```

## Error Handling

- All errors caught by `ErrorMiddleware`
- User-friendly error messages posted to chat
- Correlation ID included in error responses
- Stack traces only in development mode

## Future Enhancements

1. Implement Graph API fallback for file download
2. Add support for manager notifications
3. Implement rich status updates with progress bars
4. Add support for batch uploads
5. Integrate with Teams personal tab for case management
