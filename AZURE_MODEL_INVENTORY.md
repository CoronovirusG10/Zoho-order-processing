# Azure AI Foundry model inventory (runbook)

**Last updated:** 2025-12-21

This file documents how to list:
- what models are currently deployed, and
- what models are available to deploy

**Snapshot:** see `MODEL_ACCESS_REPORT_2025-12-20.md` for a point-in-time report of deployments and catalog in your Sweden Central environment.

> Note: This runbook assumes you have Azure CLI access and are logged into the correct subscription/tenant.

---

## 1. List AI Foundry accounts / hubs / projects
```bash
az resource list --resource-type Microsoft.CognitiveServices/accounts -o table
```

If you're using hubs/projects:
- verify the hub/project resource types and CLI commands against current Microsoft docs (CLI support has changed over time).

---

## 2. List deployments (models deployed)
Depending on whether you're using Azure OpenAI deployments or the newer Foundry model endpoints:

### Azure OpenAI style (if applicable)
```bash
az cognitiveservices account deployment list \
  --name <account-name> \
  --resource-group <rg> -o table
```

### Foundry / Azure AI model deployments
Check Microsoft docs for the current CLI surface area. If CLI gaps exist, use:
- Azure portal → your Foundry project → Deployments
- REST APIs / SDKs

---

## 3. List “models available” to deploy
This is usually best done in:
- Azure AI Foundry portal → Model catalog

If you need programmatic inventory:
- use the current Foundry REST endpoints / SDK (verify in docs)

---

## 4. What to record in the inventory report
For each deployment:
- deployment name
- provider/model name + version
- region
- quotas / limits
- endpoint type (chat/completions/embeddings)
- intended workload (primary, committee member, embedding)

