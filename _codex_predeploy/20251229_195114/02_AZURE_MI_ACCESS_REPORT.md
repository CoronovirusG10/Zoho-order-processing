# Azure Managed Identity Access Report

**Run ID**: 20251229_195114
**Generated**: 2025-12-29T19:52:00Z
**VM Identity**: System-Assigned Managed Identity (MSI)

---

## Summary

| Resource | Status | Details |
|----------|--------|---------|
| Managed Identity Login | **PASS** | Successfully logged in via MSI |
| Resource Group (pippai-rg) | **PASS** | Control-plane access verified |
| Key Vault (pippai-keyvault-dev) | **PASS** | Control + Data plane access |
| Storage Account (pippaistoragedev) | **PASS** | Control + Data plane access |
| Cosmos DB (cosmos-visionarylab) | **PASS** | Control-plane access verified |

**Overall Status**: **ALL PASS**

---

## Environment Details

### Azure CLI Version
```
azure-cli: 2.81.0
azure-cli-core: 2.81.0
azure-cli-telemetry: 1.1.0
```

### Subscription
- **Name**: Azure subscription 1
- **ID**: 5bc1c173-058c-4d81-bed4-5610679d339f
- **Tenant ID**: 545acd6e-7392-4046-bc3e-d4656b7146dd
- **Identity Type**: System-Assigned Managed Identity (MSI)

---

## Control-Plane Access

### Resource Group: pippai-rg
- **Location**: swedencentral
- **Provisioning State**: Succeeded
- **Status**: PASS

### Key Vault: pippai-keyvault-dev
- **Location**: swedencentral
- **Vault URI**: https://pippai-keyvault-dev.vault.azure.net/
- **SKU**: standard
- **RBAC Authorization**: Disabled (using Access Policies)
- **Public Network Access**: Enabled
- **Soft Delete**: Enabled (90 days retention)
- **Status**: PASS

### Storage Account: pippaistoragedev
- **Location**: swedencentral
- **Kind**: StorageV2
- **SKU**: Standard_LRS
- **Access Tier**: Hot
- **Blob Endpoint**: https://pippaistoragedev.blob.core.windows.net/
- **TLS Version**: TLS1_2
- **Public Blob Access**: Disabled
- **Status**: PASS

### Cosmos DB: cosmos-visionarylab
- **Location**: Sweden Central
- **Offer Type**: Standard
- **Capacity**: Serverless
- **Endpoint**: https://cosmos-visionarylab.documents.azure.com:443/
- **Consistency Level**: Session
- **Multi-Region Writes**: Disabled
- **Public Network Access**: Enabled
- **Status**: PASS

---

## Data-Plane Access

### Key Vault Secrets (List Only)
Successfully listed 87 secrets in pippai-keyvault-dev. Notable categories:
- API Keys (Anthropic, OpenAI, Google, etc.)
- OAuth/Integration (Meta, Facebook, Zoho, Chatwoot)
- Database/Storage connections (Cosmos, Postgres, Redis, MongoDB)
- Application secrets (LibreChat, PinboxIR, Playwright)

**Status**: PASS (MSI has get/list permissions)

### Storage Containers
Successfully listed containers:
| Container | Last Modified |
|-----------|---------------|
| uploads | 2025-11-20T11:59:07+00:00 |

**Status**: PASS (auth-mode=login worked)

### Cosmos DB Databases
Successfully listed databases:
| Database | Resource Group |
|----------|----------------|
| visionarylab | pippai-rg |

**Status**: PASS (list databases succeeded)

---

## Resource Name Clarification

The prompt mentioned different resource names. Actual resources are:

| Requested Name | Actual Name | Status |
|----------------|-------------|--------|
| pippai-kv | pippai-keyvault-dev | PASS (actual) |
| pippaistorage | pippaistoragedev | PASS (actual) |
| pippai-cosmos | cosmos-visionarylab | PASS (actual) |

---

## Identity Details

The VM is using **System-Assigned Managed Identity**:
- **User Type**: servicePrincipal
- **Name**: systemAssignedIdentity
- **Assignment Info**: MSI

### Key Vault Access Policies
Three object IDs have access to pippai-keyvault-dev:
1. `9767adbe-af8c-4a62-9e2b-039c379cd979` - Secrets: delete, get, set, list
2. `3976c71c-c570-43aa-a974-58c971b706cf` - Keys/Certs/Secrets: create, list, delete, get, set
3. `efd3fd42-b79d-4a32-8e2c-b36927751e4a` - Secrets: list, get

---

## Recommendations

1. **No Action Required**: All resources are accessible via Managed Identity.

2. **RBAC vs Access Policies**: Key Vault currently uses Access Policies (not RBAC). Consider migrating to RBAC for consistent Azure management.

3. **Storage RBAC Roles**: For production, ensure the MI has:
   - `Storage Blob Data Contributor` or `Storage Blob Data Reader`
   - Current access via `--auth-mode login` confirms appropriate RBAC assignment.

4. **Cosmos DB Data Plane**: For application-level access, ensure:
   - Connection string or key is retrieved from Key Vault (`visionarylab-cosmos-connection`)
   - Or use Azure AD authentication with appropriate RBAC role.

---

## Conclusion

**All Azure resource access checks passed.** The VM's System-Assigned Managed Identity has:
- Control-plane access to all required resources
- Data-plane access to Key Vault (secret listing)
- Data-plane access to Storage (container listing via Azure AD)
- Control-plane access to Cosmos DB (database listing)

The order-processing system can proceed with Azure dependencies verified.
