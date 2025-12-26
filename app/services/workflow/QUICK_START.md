# Workflow Orchestrator - Quick Start Guide

Fast-track guide to get the Workflow Orchestrator running locally.

## 1. Prerequisites (5 minutes)

```bash
# Check versions
node --version    # Should be 20+
npm --version     # Should be 10+
func --version    # Should be 4.x

# Install if needed
npm install -g azure-functions-core-tools@4
```

## 2. Install Azurite (Local Storage Emulator)

```bash
# Install globally
npm install -g azurite

# Start Azurite (in separate terminal)
azurite --silent --location /tmp/azurite
```

## 3. Setup Service

```bash
# Navigate to service
cd /data/order-processing/app/services/workflow

# Install dependencies
npm install

# Copy settings
cp local.settings.json.example local.settings.json

# Edit local.settings.json with your values (optional for local testing)
# - Leave AzureWebJobsStorage as "UseDevelopmentStorage=true"
# - Update other URLs if you have local services running

# Build TypeScript
npm run build
```

## 4. Start the Service

```bash
# Start Functions runtime
npm start

# You should see:
# - Azure Functions Core Tools starting
# - Functions discovered (orchestrations, activities, triggers)
# - HTTP endpoints available at http://localhost:7071/api
```

## 5. Test the Workflow

### Start a Workflow

```bash
curl -X POST http://localhost:7071/api/workflow/start \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "test-123",
    "blobUrl": "https://example.blob.core.windows.net/test.xlsx",
    "tenantId": "tenant-id",
    "userId": "user-id",
    "teams": {
      "chatId": "chat-id",
      "messageId": "msg-id",
      "activityId": "activity-id"
    }
  }'
```

Response:
```json
{
  "instanceId": "test-123",
  "caseId": "test-123",
  "status": "started",
  "statusQueryGetUri": "http://localhost:7071/api/workflow/test-123/status"
}
```

### Check Status

```bash
curl http://localhost:7071/api/workflow/test-123/status
```

### Raise an Approval Event

```bash
curl -X POST http://localhost:7071/api/workflow/test-123/raiseEvent/ApprovalReceived \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "test-123",
    "approved": true,
    "approvedBy": "user-id",
    "approvedAt": "2025-12-25T10:00:00Z"
  }'
```

### Terminate a Workflow

```bash
curl -X POST http://localhost:7071/api/workflow/test-123/terminate \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Testing termination"
  }'
```

## 6. Common Workflows

### Test Complete Happy Path

```bash
# 1. Start workflow
CASE_ID="test-$(date +%s)"
curl -X POST http://localhost:7071/api/workflow/start \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"blobUrl\": \"https://example.blob.core.windows.net/test.xlsx\",
    \"tenantId\": \"tenant-id\",
    \"userId\": \"user-id\",
    \"teams\": {
      \"chatId\": \"chat-id\",
      \"messageId\": \"msg-id\",
      \"activityId\": \"activity-id\"
    }
  }"

# 2. Wait for workflow to pause at approval (check logs)
# Look for: "Waiting for approval"

# 3. Approve the order
curl -X POST "http://localhost:7071/api/workflow/$CASE_ID/raiseEvent/ApprovalReceived" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"approved\": true,
    \"approvedBy\": \"user-id\",
    \"approvedAt\": \"$(date -Iseconds)\"
  }"

# 4. Check final status
curl "http://localhost:7071/api/workflow/$CASE_ID/status"
```

### Test Cancellation

```bash
# Start workflow
CASE_ID="cancel-test-$(date +%s)"
curl -X POST http://localhost:7071/api/workflow/start \
  -H "Content-Type: application/json" \
  -d "{...}"

# Reject at approval
curl -X POST "http://localhost:7071/api/workflow/$CASE_ID/raiseEvent/ApprovalReceived" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"approved\": false,
    \"approvedBy\": \"user-id\",
    \"approvedAt\": \"$(date -Iseconds)\",
    \"comments\": \"Wrong customer\"
  }"
```

### Test Customer Selection

```bash
# After workflow pauses for customer selection
curl -X POST "http://localhost:7071/api/workflow/$CASE_ID/raiseEvent/SelectionsSubmitted" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "test-123",
    "selections": {
      "customer": {
        "zohoCustomerId": "customer-123"
      }
    },
    "submittedBy": "user-id",
    "submittedAt": "2025-12-25T10:00:00Z"
  }'
```

## 7. Watch Logs

```bash
# In the terminal where func is running, you'll see:
[2025-12-25T10:00:00.123] [test-123] orchestration: Starting order processing workflow
[2025-12-25T10:00:00.456] [test-123] step-1: Storing uploaded file
[2025-12-25T10:00:01.789] [test-123] step-1: File stored successfully
[2025-12-25T10:00:02.012] [test-123] step-2: Parsing Excel file
# ... etc
```

## 8. Development Tips

### Watch Mode
```bash
# In one terminal: watch TypeScript compilation
npm run watch

# In another terminal: run functions
npm start
```

### Debug in VS Code

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to Node Functions",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "preLaunchTask": "func: host start"
    }
  ]
}
```

### View Durable Functions State

```bash
# Install Azure Storage Explorer
# Connect to local storage (Azurite)
# Navigate to Tables -> OrderProcessingHubInstances
# View orchestration state
```

## 9. Testing with Mock Services

If you don't have the other services running, the activities will use mock responses:

- `StoreFile`: Returns mock file path and SHA-256
- `ParseExcel`: Returns success with no issues
- `RunCommittee`: Returns unanimous consensus
- `ResolveCustomer`: Returns resolved with mock customer
- `ResolveItems`: Returns all resolved
- `CreateZohoDraft`: Returns mock Zoho order ID
- `NotifyUser`: Logs message (no actual Teams notification)
- `UpdateCase`: Logs update (no actual Cosmos DB write)

## 10. Common Issues

### "Storage connection not available"
```bash
# Make sure Azurite is running
azurite --silent --location /tmp/azurite
```

### "Cannot find module 'durable-functions'"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "Function not found"
```bash
# Rebuild TypeScript
npm run build
```

### Port 7071 already in use
```bash
# Kill existing process
lsof -ti:7071 | xargs kill -9

# Or use different port
func start --port 7072
```

## 11. Next Steps

- Read the full [README.md](./README.md) for architecture details
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for Azure deployment
- Implement actual service integrations in activities
- Add comprehensive tests
- Set up CI/CD pipeline

## 12. Useful Commands

```bash
# Clean build
npm run clean && npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check TypeScript errors
npx tsc --noEmit

# Format code (if using prettier)
npx prettier --write "src/**/*.ts"
```

## Need Help?

- Check function logs in the terminal
- Review Application Insights (if connected)
- Consult Azure Functions documentation: https://docs.microsoft.com/azure/azure-functions/
- Durable Functions docs: https://docs.microsoft.com/azure/azure-functions/durable/
