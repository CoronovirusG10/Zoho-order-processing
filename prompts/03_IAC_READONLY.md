Read-only IaC audit.

- Search /data/order-processing for IaC (bicep, terraform, arm templates, azd):
  - files: *.bicep, main.bicep, *.tf, azure.yaml, infra/
- If found:
  - list modules and resources declared
  - check region defaults (should be Sweden Central)
  - identify which resources are missing for the design (Storage, KeyVault, Cosmos, AppInsights, Bot, Functions/Container Apps, Service Bus)
- Do NOT run deploy/apply.

Output: IaC present? yes/no. Gaps. What must be added before deployment.
