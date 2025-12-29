# 07 — Aggregate All Reports into One Final Status Packet

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Combine the outputs from all prompts (01-06, 08-14) into:
- one consolidated readiness report
- a single "next actions" list in order

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `REPORT_FINAL.md` (consolidated)
- `STATUS.json` (summary)

Then print a **Paste-Back Report** block (<=200 lines) with:
- Pass/Fail table
- Top 10 next actions
- Paths to key logs

If `OP_RUN_ID` is not set, attempt to find the most recent run folder under `/data/order-processing/_codex_predeploy/`
and use that.

## Reports to Aggregate

### Phase 1: VM Foundation
- `01_VM_FOUNDATION_REPORT.md`

### Phase 2: Azure Access & Containers
- `02_AZURE_MI_ACCESS_REPORT.md`
- `08_CONTAINERS_SETUP_REPORT.md`

### Phase 3: SSL
- `09_SSL_PROVISIONING_REPORT.md`

### Phase 4: Integrations
- `03_FOUNDRY_MODEL_SMOKES_REPORT.md`
- `04_ZOHO_SANDBOX_SMOKES_REPORT.md`

### Phase 5: Admin Handoff
- `11_PIPPA_TENANT_CHECKLIST_REPORT.md`
- `PIPPA_ADMIN_CHECKLIST.md`

### Phase 6: Post-Manual Validation
- `14_POST_MANUAL_VALIDATION_REPORT.md`

### Phase 7: Teams Build & Readiness
- `10_TEAMS_PACKAGE_BUILD_REPORT.md`
- `05_TEAMS_READINESS_REPORT.md`
- `06_TAB_READINESS_REPORT.md`

### Phase 8: Golden Files
- `12_GOLDEN_FILE_VALIDATION_REPORT.md`

### Phase 10 (if run separately)
- `13_PRODUCTION_DEPLOY_REPORT.md`

## Steps
1) Identify the run folder:
   - `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
2) Read all available reports:
   - Check which reports exist
   - List reports found vs reports expected
3) Build consolidated report with:
   - current state summary
   - what's proven working
   - blockers (ordered)
   - next actions (ordered, with owners: VM / Azure(360innovate) / Tenant(Pippa of London))
4) Write `STATUS.json` with machine-readable fields:
   ```json
   {
     "run_id": "...",
     "timestamp": "...",
     "phase_1_vm_foundation": {
       "docker_ok": true,
       "pm2_ok": true,
       "nginx_ok": true
     },
     "phase_2_azure_access": {
       "azure_cli_ok": true,
       "mi_ok": true,
       "cosmos_ok": true,
       "blob_ok": true,
       "temporal_ns_ok": true
     },
     "phase_3_ssl": {
       "tls_ok": true,
       "renewal_configured": true
     },
     "phase_4_integrations": {
       "foundry_ok": true,
       "zoho_ok": true
     },
     "phase_5_admin": {
       "checklist_generated": true
     },
     "phase_6_validation": {
       "admin_work_complete": true,
       "token_acquisition_ok": true
     },
     "phase_7_teams": {
       "teams_package_built": true,
       "teams_ready": true,
       "tab_ready": true
     },
     "phase_8_golden": {
       "golden_files_found": true,
       "tests_passed": true
     },
     "overall": {
       "ready_for_production": true,
       "blockers": [],
       "next_actions": []
     }
   }
   ```
5) Print Paste-Back Report block with:
   - Summary table by phase
   - Critical blockers
   - Next 10 actions with assigned owner
   - Key log file paths
