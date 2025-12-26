# Predeployment Readiness Report

**Project:** Sales Order Intake Bot (Azure AI Foundry + Teams + Zoho Books)
**Audit Date:** 2025-12-26
**Status:** **NOT READY** - Blockers must be resolved

---

## Executive Overview

This predeployment audit assessed 8 critical areas for deployment readiness of the Sales Order Intake solution. The system is designed to receive Excel orders via Microsoft Teams 1:1 chat, validate and extract data using AI models, and create draft sales orders in Zoho Books.

**Overall Finding:** The codebase is well-structured with comprehensive infrastructure-as-code, but several blockers prevent immediate deployment:

1. **Version Control:** Not a git repository (critical for CI/CD)
2. **Cross-Tenant Strategy:** Multi-tenant bot deprecated after July 2025
3. **Capability Host:** AI Search not configured (required for full Foundry capability host)
4. **Azure Resources:** Application Insights not deployed, storage versioning not enabled

The solution architecture is sound, with proper separation of services, comprehensive test coverage, and security controls in place. Model deployments are complete in Sweden Central with 5+ committee models available.

---

## Pass/Fail Summary

| Audit Area | Status | Summary |
|------------|--------|---------|
| **A. Repository & Build** | NEEDS_ACTION | Codebase exists, tests configured, but no git repo or CI/CD |
| **B. IaC Validation** | PASS | 14 Bicep files validate successfully with warnings |
| **C. Azure Resources** | NEEDS_ACTION | Resources exist but missing App Insights, blob versioning |
| **D. AI Foundry** | NEEDS_ACTION | Models deployed, but AI Search missing for capability host |
| **E. Teams App** | NEEDS_ACTION | Manifest valid, but multi-tenant bot deprecated July 2025 |
| **F. Zoho Books** | PASS | EU endpoints configured, API health checks pass |
| **G. Security & Governance** | PASS | Key Vault, correlation IDs, logging all configured |
| **H. Multimodal Pipeline** | PASS | Excel parser implemented with full provenance tracking |

**Overall Status: NOT READY** (3 blockers, 4 actions required)

---

## Blockers

These must be resolved before deployment:

| ID | Severity | Issue | Owner | Resolution |
|----|----------|-------|-------|------------|
| **B1** | CRITICAL | Not a git repository | DevOps | Initialize git, add root .gitignore |
| **B2** | HIGH | Multi-tenant bot deprecated after July 2025 | Architecture | Switch to single-tenant + org catalog |
| **B3** | HIGH | Azure Cognitive Search not deployed | IaC | Add aisearch.bicep module for capability host |

---

## Actions Required (Priority Order)

### Critical (Before Any Deployment)

| # | Action | Area | Details |
|---|--------|------|---------|
| 1 | Initialize git repository | Repo | `git init` + add comprehensive .gitignore at project root |
| 2 | Add root .gitignore | Repo | Cover zoho_*.json, *_tokens*.json at project root |
| 3 | Deploy Azure Cognitive Search | IaC | Required for Foundry capability host vector store |
| 4 | Deploy Application Insights | Azure | Create and link to pippai-logs workspace |

### High (Before Production)

| # | Action | Area | Details |
|---|--------|------|---------|
| 5 | Enable blob versioning | Azure | On pippaistoragedev storage account |
| 6 | Configure delete retention | Azure | 7+ day retention policy on storage |
| 7 | Plan single-tenant bot migration | Teams | Before July 2025 deadline |
| 8 | Implement Graph API fallback | Teams | For cross-tenant file download edge cases |

### Medium (Production Hardening)

| # | Action | Area | Details |
|---|--------|------|---------|
| 9 | Set up CI/CD pipeline | DevOps | GitHub Actions or Azure Pipelines |
| 10 | Increase model quotas | Foundry | o3: 1K→5K, claude-opus: 2K→5K |
| 11 | Fix Bicep secrets in outputs | IaC | Remove listKeys() from module outputs |
| 12 | Migrate Zoho tokens to Key Vault | Security | Currently in local JSON file |

---

## Risks & Assumptions

### Accepted Risks

| Risk | Mitigation | Decision Owner |
|------|------------|----------------|
| Using Durable Functions instead of Foundry Workflows | Acceptable - provides required human-in-loop capability | Architecture |
| OCR/Voice not implemented | Out of MVP scope per design docs | Product |
| 30-day Log Analytics retention | Acceptable for dev; increase for prod | Operations |

### Assumptions

1. **Cross-tenant access policies** in Tenant B will allow external app consent
2. **Network egress** to Zoho EU, Gemini, Anthropic, xAI APIs is unrestricted
3. **Sweden Central** region meets all data residency requirements
4. **5-year retention** requirement satisfied by storage lifecycle policies

---

## Evidence Index

All audit evidence is stored in `/data/order-processing/_predeploy/evidence/`:

| Audit | Evidence Files |
|-------|----------------|
| A. Repository | `A_repo/tree.txt`, `A_repo/secret_scan.txt` |
| B. IaC | `B_iac/iac_files.txt`, `B_iac/validation_output.txt` |
| C. Azure | `C_azure/account.txt`, `C_azure/resources.txt` |
| D. Foundry | `D_foundry/model_status.txt`, `D_foundry/capability_host.txt`, `D_foundry/ms_docs_reference.md` |
| E. Teams | `E_teams/manifest_check.txt`, `E_teams/cross_tenant.txt` |
| F. Zoho | `F_zoho/config_check.txt`, `F_zoho/health_check.txt` |
| G. Security | `G_security/keyvault_check.txt`, `G_security/logging_check.txt` |
| H. Multimodal | `H_multimodal/parser_check.txt`, `H_multimodal/pipeline_status.txt` |

Full audit logs: `/data/order-processing/_predeploy/logs/`

---

## Success Criteria for "Ready to Deploy"

| Criterion | Current | Required |
|-----------|---------|----------|
| Git repository initialized | NO | YES |
| Bicep validates (what-if) | YES | YES |
| Foundry models deployed | YES | YES |
| Capability host configured | PARTIAL | FULL (needs AI Search) |
| Teams manifest validated | YES | YES |
| Cross-tenant plan unblocked | NO | YES (need single-tenant migration) |
| Zoho sandbox health checks | YES | YES |
| Logging + 5-year retention | PARTIAL | YES (needs blob versioning) |

---

## Next Steps

1. **Immediate:** Resolve B1 (git init) and B2 (review cross-tenant strategy)
2. **This Week:** Deploy AI Search and Application Insights
3. **Before July 2025:** Complete single-tenant bot migration
4. **Before Production:** Complete all HIGH priority actions

---

**Report Generated:** 2025-12-26
**Auditor:** Claude Opus 4.5 (CTO Orchestrator Pattern)
