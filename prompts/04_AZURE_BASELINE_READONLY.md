Read-only Azure baseline readiness.

- Run `az account show` (if not logged in, note and stop)
- Run `az group list -o table`
- Identify likely RG for this project (by naming convention or prompt the user if multiple)
- List key resources by type (limit output):
  - Storage accounts
  - Key Vaults
  - App Insights / Log Analytics
  - Function Apps / Container Apps / App Service
  - Service Bus / Queues
  - Cosmos DB
  - AI Search
  - Bot Service
  - Cognitive Services / Azure OpenAI / Foundry

Output: which foundational resources already exist vs need provisioning.
