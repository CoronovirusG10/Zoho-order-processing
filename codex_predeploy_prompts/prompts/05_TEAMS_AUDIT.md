# Prompt 05 — Teams App Readiness Audit (Manifest + Cross‑tenant plan)

## Goal
Validate Teams app packaging and cross‑tenant assumptions:
- 1:1 bot chat supported
- personal tab included
- file upload flow is implementable
- cross-tenant deployment plan matches artefacts

## Rules
- Read-only.
- Do not register apps or modify tenant settings.
- Only inspect local files and (if possible) list existing app registrations (read-only).

## Output files
- `/data/order-processing/_predeploy_codex/logs/05_TEAMS_AUDIT.md`
- `/data/order-processing/_predeploy_codex/evidence/teams/teams_project_tree.txt`
- `/data/order-processing/_predeploy_codex/evidence/teams/manifest_excerpt.json`
- `/data/order-processing/_predeploy_codex/evidence/teams/manifest_validation.txt`
- `/data/order-processing/_predeploy_codex/artefacts/teams_cross_tenant_checklist.md`

## Steps

1) Locate Teams app artefacts
Search for typical paths:
- `appPackage/manifest.json`
- `manifest.json`
- `teamsapp.yml`
- Teams Toolkit project folders
Write a depth-limited tree to `teams_project_tree.txt`.

2) Manifest verification
If a manifest exists:
- Extract a minimal excerpt (redacted IDs ok) showing:
  - bot section
  - personal tab section
  - validDomains
  - webApplicationInfo (if using SSO)
Save to `manifest_excerpt.json`.

Validate manifest schema if tooling exists (Teams Toolkit CLI, JSON schema validator). Save output to `manifest_validation.txt`.

3) Cross-tenant readiness (paper + artefact alignment)
Read:
- `/data/order-processing/CROSS_TENANT_TEAMS_DEPLOYMENT.md`
Compare against manifest:
- Tenant A vs Tenant B responsibilities
- Whether the bot is single-tenant or multi-tenant
- Whether personal tab requires SSO (and therefore cross-tenant consent complexity)

Create `teams_cross_tenant_checklist.md` with:
- items that can be verified from local artefacts
- items that require tenant admin confirmation
- blockers

4) File handling feasibility (design-level check)
Confirm the implementation plan includes:
- how the bot retrieves the attachment (Graph download URL vs Bot Framework attachment download)
- where the file is stored (OneDrive vs Blob; your requirement: long-term storage in Blob)
- correlation ID strategy

## Report
In `05_TEAMS_AUDIT.md`:
- PASS/FAIL/NEEDS-ACTION list for:
  - bot + personal tab present
  - cross-tenant plan coherent
  - file upload path specified
  - authentication approach coherent
- blockers and next actions
- evidence file paths
