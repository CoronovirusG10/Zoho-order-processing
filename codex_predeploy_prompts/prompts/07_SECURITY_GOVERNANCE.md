# Prompt 07 — Security, Governance, Retention (Read‑only)

## Goal
Verify security and governance prerequisites for a high-auditability system:
- secrets in Key Vault (plan)
- managed identity usage (plan)
- blob storage retention: **>= 5 years** for all artefacts/logs
- append-only/immutable patterns where possible
- monitoring + correlation ID plan

## Rules
- Read-only.
- No policy changes.

## Output files
- `/data/order-processing/_predeploy_codex/logs/07_SECURITY_GOVERNANCE.md`
- `/data/order-processing/_predeploy_codex/evidence/security/keyvault_settings.txt`
- `/data/order-processing/_predeploy_codex/evidence/security/storage_retention.txt`
- `/data/order-processing/_predeploy_codex/evidence/security/log_analytics_retention.txt`
- `/data/order-processing/_predeploy_codex/artefacts/security_gap_list.md`

## Steps

1) Key Vault settings (read-only)
For candidate Key Vault(s):
- capture:
  - RBAC vs access policy mode
  - purge protection enabled?
  - soft delete enabled?
Save to `keyvault_settings.txt`.

2) Blob storage retention / immutability (read-only)
For candidate storage account(s) intended for audit:
- capture:
  - blob versioning
  - soft delete retention days
  - container-level immutability policy (if set)
  - legal hold tags (if set)
Save to `storage_retention.txt`.

3) Log Analytics / App Insights retention
- list workspaces and retention settings.
Save to `log_analytics_retention.txt`.

4) Security design alignment with local docs
Read the design docs and check they include:
- least privilege role assignments
- managed identities for runtime components
- Key Vault references
- PII handling (even if “no GDPR restrictions”, still minimise exposure)
- trace/audit design:
  - correlation IDs across Teams → Blob → parse → validation → Zoho
  - debug-level transaction logs stored in Blob

5) Produce `security_gap_list.md`
Include:
- what is already present
- what is missing
- which missing items are blockers vs hardening

## Report
In `07_SECURITY_GOVERNANCE.md` provide:
- PASS/FAIL/NEEDS-ACTION checklist for:
  - Key Vault readiness
  - storage retention >= 5 years
  - immutability/append-only options
  - monitoring readiness
- blockers and next steps
- evidence file paths
