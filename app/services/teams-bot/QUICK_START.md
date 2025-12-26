# Teams Bot - Quick Start Guide

Get the Teams bot running locally in 5 minutes.

## Prerequisites

- Node.js 18+
- Azure Storage Account (or Azurite for local development)
- Bot Framework Emulator (optional, for testing)

## 1. Install Dependencies

```bash
cd /data/order-processing/app/services/teams-bot
npm install
```

## 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# For local development with ngrok
MICROSOFT_APP_ID=your-app-id
MICROSOFT_APP_PASSWORD=your-app-secret
MICROSOFT_APP_TYPE=MultiTenant
MICROSOFT_APP_TENANT_ID=your-tenant-id

# For local dev with Azurite
AZURE_STORAGE_ACCOUNT_NAME=devstoreaccount1

# Local service endpoints
PARSER_ENDPOINT=http://localhost:3001
WORKFLOW_ENDPOINT=http://localhost:3002

PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
```

## 3. Start Local Storage (Azurite)

If you don't have Azure Storage, use Azurite:

```bash
# Install Azurite globally
npm install -g azurite

# Start Azurite
azurite --silent --location ./azurite-data
```

Or use Docker:

```bash
docker run -p 10000:10000 mcr.microsoft.com/azure-storage/azurite azurite-blob --blobHost 0.0.0.0
```

## 4. Build and Run

```bash
# Build TypeScript
npm run build

# Start the bot
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

## 5. Test with Bot Framework Emulator

1. Download [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator/releases)
2. Open the emulator
3. Click "Open Bot"
4. Enter bot URL: `http://localhost:3000/api/messages`
5. Enter Microsoft App ID and Password
6. Click "Connect"

## 6. Test in Teams (with ngrok)

### Setup ngrok

```bash
# Install ngrok
# macOS: brew install ngrok
# Windows: Download from ngrok.com

# Start ngrok
ngrok http 3000
```

### Update Bot Messaging Endpoint

In Azure Portal:
1. Go to your Bot Service
2. Navigate to Configuration
3. Update Messaging endpoint to: `https://your-ngrok-url.ngrok.io/api/messages`
4. Save

### Test in Teams

1. Open Teams
2. Search for your bot
3. Start a 1:1 chat
4. Send "help" to verify it's working
5. Upload an Excel file to test file handling

## Common Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run in development mode
npm run dev

# Clean build artifacts
npm run clean

# Type check
npx tsc --noEmit
```

## Quick Test Checklist

- [ ] Bot responds to "help" message
- [ ] Bot responds to "status" message
- [ ] Bot accepts Excel file upload
- [ ] Processing card appears after upload
- [ ] File appears in Blob Storage
- [ ] Correlation ID is generated
- [ ] Logs appear in console (JSON format)
- [ ] Health endpoint works: `http://localhost:3000/health`

## Testing File Upload Locally

Without full Teams integration, you can test the file download service:

```typescript
// Test script (save as test-upload.ts)
import { FileDownloadService } from './src/services/file-download.js';

const service = new FileDownloadService();

const testAttachment = {
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  name: 'test-order.xlsx',
  content: {
    downloadUrl: 'https://example.com/file.xlsx'
  }
};

const result = await service.downloadAndStore(
  testAttachment,
  'test-case-123',
  'test-correlation-id'
);

console.log('Upload result:', result);
```

## Mock Parser/Workflow Services

Create simple mock services for local testing:

```bash
# Mock parser (save as mock-parser.js)
const express = require('express');
const app = express();
app.use(express.json());

app.post('/parse', (req, res) => {
  console.log('Parse request:', req.body);
  res.json({ success: true, caseId: req.body.caseId });
});

app.listen(3001, () => console.log('Mock parser running on :3001'));

# Mock workflow (save as mock-workflow.js)
const express = require('express');
const app = express();
app.use(express.json());

app.post('/corrections', (req, res) => {
  console.log('Corrections:', req.body);
  res.json({ success: true });
});

app.post('/approve', (req, res) => {
  console.log('Approve:', req.body);
  res.json({ success: true });
});

app.listen(3002, () => console.log('Mock workflow running on :3002'));
```

Run mocks:
```bash
node mock-parser.js &
node mock-workflow.js &
```

## Troubleshooting

### "MICROSOFT_APP_ID must be set"

Set the environment variable in `.env` or export it:

```bash
export MICROSOFT_APP_ID=your-app-id
export MICROSOFT_APP_PASSWORD=your-app-secret
```

### "Cannot find module '@order-processing/types'"

Build the shared packages first:

```bash
cd /data/order-processing/app/packages/types
npm install
npm run build

cd /data/order-processing/app/packages/shared
npm install
npm run build
```

### Storage connection fails

For local dev with Azurite, use the default connection string:

```bash
AZURE_STORAGE_ACCOUNT_NAME=devstoreaccount1
```

Or set explicit connection string:

```bash
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
```

### Bot doesn't respond in emulator

1. Check console for errors
2. Verify bot URL is correct
3. Ensure App ID and Password match
4. Check that bot is running (look for "server.started" log)

## Next Steps

Once local testing works:

1. Deploy to Azure App Service (see `DEPLOYMENT.md`)
2. Configure production Bot Service
3. Upload Teams app to Tenant B
4. Test cross-tenant file upload
5. Integrate with real parser/workflow services

## Useful Links

- [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator)
- [ngrok](https://ngrok.com/)
- [Azurite](https://github.com/Azure/Azurite)
- [Bot Framework Documentation](https://docs.microsoft.com/en-us/azure/bot-service/)
