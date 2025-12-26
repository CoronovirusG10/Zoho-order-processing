# Azure model inventory runbook (Sweden Central)

This runbook is how you capture, in an auditable way, **what is currently deployed** and **what can be deployed** for Azure OpenAI / Azure AI Foundry models.

> Note: I cannot run these commands against your Azure tenant from this environment. Run them on your Sweden Central VM (or Azure Cloud Shell) under the correct subscription.

---

## 1) Preconditions

- Azure CLI installed (`az --version`)
- Logged in to the correct tenant/subscription:
  - If you are on a VM with a managed identity: `az login --identity`
  - Otherwise: `az login`

Set variables:
```bash
SUB="<subscription-id>"
RG="<resource-group>"
OPENAI="<azure-openai-or-foundry-cognitive-services-account-name>"

az account set --subscription "$SUB"
```

---

## 2) List the Cognitive Services / OpenAI accounts in the resource group

```bash
az cognitiveservices account list -g "$RG" -o table
```

If you have multiple, repeat the next steps for each account.

---

## 3) List current model deployments (this answers “what is deployed?”)

```bash
az cognitiveservices account deployment list -g "$RG" -n "$OPENAI" -o json > deployments.json
cat deployments.json | jq '.[] | {name:.name, model:.properties.model.name, version:.properties.model.version, sku:.sku.name, capacity:.sku.capacity}'
```

Keep `deployments.json` as an audit artefact.

---

## 4) List models available to deploy (this answers “what can be deployed?”)

```bash
az cognitiveservices account list-models -g "$RG" -n "$OPENAI" -o json > models.json
cat models.json | jq '.[] | {name:.name, version:.version, format:.format, fineTune:.fineTune, inference:.inference}'
```

Model availability is constrained by:
- region
- quota
- project type (in Foundry)
- preview/eligibility requirements

So treat this as “what your subscription *currently sees*”.

---

## 5) (Optional) Management-plane REST for deployment metadata

This is useful if you want to automate inventory capture in a pipeline:
```bash
TOKEN="$(az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv)"

curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://management.azure.com/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.CognitiveServices/accounts/$OPENAI/deployments?api-version=2025-06-01" \
  > deployments-mgmt.json
```

---

## 6) Foundry model catalogue (partner models)

For partner models (Cohere/Mistral/Claude/etc.) you typically confirm availability in the **Foundry model catalogue** for your hub/project region:

- Filter by “Deployable”
- Filter by region (Sweden Central)
- Record:
  - provider
  - deployment type (Standard vs Global Standard vs Provisioned)
  - preview flags
  - pricing and quotas

---

## 7) What to feed back into the solution design

Update the following config knobs based on the inventory:
- Which model deployment is used for the Teams agent (gpt-4o vs gpt-4.1, etc.)
- Which committee models are available (v2) and whether any are Global Standard
- Any capacity/quota limits that constrain throughput
- Upgrade policy (auto-upgrade on/off) and your change control plan
