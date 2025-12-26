# Development Setup Guide

## Prerequisites

- Node.js 20.x or later
- npm 10.x or later
- Azure CLI (`az`) installed and logged in
- Azure Functions Core Tools v4
- VS Code with recommended extensions

## Initial Setup

### 1. Clone and Install Dependencies

```bash
cd /data/order-processing/app
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your development values:

```env
# Get from Azure Bot registration
MICROSOFT_APP_ID=your-bot-app-id
MICROSOFT_APP_PASSWORD=your-bot-app-secret
MICROSOFT_APP_TYPE=MultiTenant

# Azure Storage (use Azurite for local dev)
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true

# Cosmos DB (use emulator for local dev)
COSMOS_ENDPOINT=https://localhost:8081
COSMOS_KEY=your-emulator-key
COSMOS_DATABASE=order-processing

# Zoho Sandbox
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REFRESH_TOKEN=your-refresh-token
ZOHO_ORGANIZATION_ID=your-org-id
ZOHO_DC=eu
```

### 3. Start Local Services

#### Azure Storage Emulator (Azurite)
```bash
npm install -g azurite
azurite --silent --location ./azurite --debug ./azurite/debug.log
```

#### Cosmos DB Emulator
Download from: https://aka.ms/cosmosdb-emulator

### 4. Build All Packages

```bash
npm run build
```

### 5. Run Services

In separate terminals:

```bash
# API Backend
npm run dev:api

# Teams Bot
npm run dev:bot

# Teams Tab (Vite)
npm run dev:tab

# Workflow (Azure Functions)
cd services/workflow && func start
```

## Testing

### Run Unit Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run Golden File Tests
```bash
npm run test:golden
```

## Teams Development

### ngrok for Bot Testing
```bash
ngrok http 3978
```

Update your Azure Bot messaging endpoint to the ngrok URL.

### Teams Toolkit
Install the Teams Toolkit VS Code extension for easier debugging.

## Troubleshooting

### Port Conflicts
Default ports:
- API: 3000
- Bot: 3978
- Tab: 5173
- Functions: 7071

### Cosmos Emulator SSL
If you get SSL errors with Cosmos emulator:
```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```
(Never in production!)

### Teams SSO in Development
Use Teams Toolkit's dev tunnel feature for testing SSO.
