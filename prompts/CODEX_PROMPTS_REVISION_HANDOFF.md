# Codex Prompts Revision - Comprehensive Handoff Document

**Generated:** 2025-12-29
**Validated By:** Zen Consensus (Gemini-3-pro-preview, DeepSeek-V3.2-Speciale, o3-pro)
**Verdict:** APPROVE_WITH_CHANGES (Unanimous)
**Confidence:** 8/10 average

---

## Executive Summary

The current Codex prompts (00-07) in `/data/order-processing/order_processing_codex_prompts_vm_only_extracted/` are **well-designed for 360innovate-side infrastructure** but have **critical gaps** requiring fixes before deployment.

### Consensus Validation Results

| Model | Verdict | Confidence | Key Insight |
|-------|---------|------------|-------------|
| Gemini-3-pro-preview | APPROVE_WITH_CHANGES | 9/10 | Sequencing has critical dependency errors |
| DeepSeek-V3.2-Speciale | APPROVE_WITH_CHANGES | 8/10 | Tab SSO app may be needed |
| o3-pro | APPROVE_WITH_CHANGES | 7/10 | Add monitoring/alerting, security hardening |

---

## Critical Issues (Consensus-Validated)

### Issue 1: Wrong Tenant Name (MANDATORY FIX)
- **Location:** Prompt 05_TEAMS_READINESS.md
- **Problem:** Says "Ashtad tenant"
- **Fix:** Replace with "Pippa of London tenant"

### Issue 2: Wrong Azure Bot Location (MANDATORY FIX)
- **Location:** Prompt 05_TEAMS_READINESS.md
- **Problem:** Says "(in 360innovate subscription)"
- **Fix:** Replace with "(in Pippa of London subscription - NOT 360innovate)"

### Issue 3: Sequencing Errors (CRITICAL)
All three models identified the same sequencing problems:

| Original Sequence | Problem | Correct Sequence |
|-------------------|---------|------------------|
| 09 (SSL) before 01 (nginx) | certbot requires nginx installed | 01 before 09 |
| 08 (containers) before 02 (MI access) | Need to verify permissions first | 02 before 08 |
| 10 (Teams build) before 11 (admin checklist) | Need App ID from admin first | 11 before 10 |

### Issue 4: Missing Validations
- Environment variable verification (MicrosoftAppId, MicrosoftAppPassword)
- Temporal namespace registration (order-processing)
- Post-manual validation step (verify bot token acquisition)
- SSL certificate renewal cron job

---

## Two Tenants Architecture Reference

| Tenant | ID | Role | Admin |
|--------|-----|------|-------|
| **360innovate** | 545acd6e-7392-4046-bc3e-d4656b7146dd | Azure infrastructure (VM, Storage, Cosmos, Key Vault) | DevOps |
| **Pippa of London** | 23da91a5-0480-4183-8bc1-d7b6dd33dd2e | Bot registration, Teams users, Teams app | antonio@pippaoflondon.co.uk |

**Critical:** Azure Bot must be in Pippa of London tenant due to Microsoft's July 31, 2025 multi-tenant bot deprecation.

---

## Required Changes

### Part A: Fix Existing Prompt 05_TEAMS_READINESS.md

**Location:** `/data/order-processing/order_processing_codex_prompts_vm_only_extracted/order_processing_codex_prompts_vm_only/prompts/05_TEAMS_READINESS.md`

**Change 1:** Replace all instances of "Ashtad tenant" with "Pippa of London tenant"

**Change 2:** Replace:
```
Azure Bot resource creation & Teams channel wiring (in 360innovate subscription)
```
with:
```
Azure Bot resource creation & Teams channel wiring (in Pippa of London subscription - NOT 360innovate)
```

**Change 3:** Update admin reference to: `antonio@pippaoflondon.co.uk`

---

### Part B: New Prompts to Create

#### 08_CONTAINERS_SETUP.md

**Purpose:** Create/validate Cosmos DB and Blob Storage containers

**Scope:**
- Cosmos containers: `cases` (/tenantId), `fingerprints` (/fingerprint), `events` (/caseId), `agentThreads` (/threadId), `committeeVotes` (/caseId), `cache` (/type)
- Blob containers: `orders-incoming`, `orders-audit`, `committee-evidence`, `logs-archive`
- Configure 5-year retention policies
- **NEW:** Register Temporal namespace: `temporal operator namespace register order-processing`

**Dependencies:** Must run AFTER 02_MI_AZURE_ACCESS (verify permissions first)

---

#### 09_SSL_PROVISIONING.md

**Purpose:** Provision SSL certificate for pippai-vm.360innovate.com

**Scope:**
- Check if valid certificate exists
- Run certbot with nginx plugin
- Verify certificate renewal cron job exists
- Test HTTPS connectivity

**Dependencies:** Must run AFTER 01_VM_FOUNDATION (nginx must be installed)

---

#### 10_TEAMS_PACKAGE_BUILD.md

**Purpose:** Build Teams app package (.zip) ready for upload

**Scope:**
- Read manifest.json template
- Replace placeholders: `{{BOT_APP_CLIENT_ID}}` (from .env after admin provides it)
- Validate manifest against Teams schema
- Verify icon files exist (color.png, outline.png)
- **NEW:** Validate manifest includes personal tab definition
- Create teams-app.zip
- Output package location for manual upload

**Dependencies:** Must run AFTER 11_PIPPA_TENANT_CHECKLIST and admin work completes (App ID needed)

---

#### 11_PIPPA_TENANT_CHECKLIST.md

**Purpose:** Generate detailed step-by-step checklist for antonio@pippaoflondon.co.uk

**Scope:**
- Exact Azure Portal navigation for app registration
- App registration configuration (single-tenant)
- **NEW:** Tab SSO configuration if needed (redirect URIs, implicit flow)
- Azure Bot resource creation steps
- Teams channel configuration
- Copy-paste values (messaging endpoint: `https://pippai-vm.360innovate.com/api/messages`)
- **NEW:** Secure credential transfer instructions (use Key Vault, not email)
- Instructions to send credentials to DevOps team
- Expected outcomes at each step

**Output:** Markdown document ready to send to Pippa admin

---

#### 12_GOLDEN_FILE_VALIDATION.md

**Purpose:** Test Excel parser and committee against golden file spreadsheets

**Scope:**
- Locate golden files (expected: `/data/order-processing/test/fixtures/golden/`)
- **NEW:** Gracefully handle missing files (skip with warning, document requirement)
- Run parser against each file
- Capture extraction results
- Compare against expected outputs
- Calculate accuracy metrics

**Dependencies:** Requires workflow services running

---

#### 13_PRODUCTION_DEPLOY.md

**Purpose:** Production deployment checklist and validation

**Scope:**
- Different Zoho organization (production, not sandbox)
- Production secrets in Key Vault
- Production Azure Bot (if different from dev)
- DNS verification for production domain
- **NEW:** Monitoring and alerting configuration
- **NEW:** Backup verification
- **NEW:** Security hardening checklist (patching, firewall, fail2ban)

**Note:** This is a SEPARATE deployment phase

---

#### NEW: 14_POST_MANUAL_VALIDATION.md

**Purpose:** Validate that manual admin work was completed correctly

**Scope:**
- Verify MicrosoftAppId and MicrosoftAppPassword exist in .env
- Verify bot service can obtain a token from Microsoft
- Verify Teams messaging endpoint is reachable
- **NEW:** Automated Bot Framework API check if possible
- Verify pm2 services are running with correct credentials
- Output pass/fail status for each check

**Dependencies:** Run AFTER admin completes checklist and updates .env

---

### Part C: REVISED Sequencing (Consensus-Validated)

```
PHASE 1: VM Foundation
  01_VM_FOUNDATION
    - Install Docker, nginx, PM2
    - Start Temporal containers
    - Skip SSL-dependent health checks initially

PHASE 2: Azure Access & Containers
  02_MI_AZURE_ACCESS (verify permissions)
    ↓
  08_CONTAINERS_SETUP (create Cosmos/Blob + Temporal namespace)

PHASE 3: SSL
  09_SSL_PROVISIONING (certbot after nginx exists)

PHASE 4: Integrations (parallel)
  03_FOUNDRY_MODEL_SMOKES
  04_ZOHO_SANDBOX_SMOKES

PHASE 5: Admin Handoff
  11_PIPPA_TENANT_CHECKLIST (output for admin)
    ↓
  ══════════════════════════════════════
  ║  STOP - Wait for Manual Admin Work  ║
  ║  (antonio@pippaoflondon.co.uk)      ║
  ║  - Create App Registration          ║
  ║  - Create Azure Bot                 ║
  ║  - Send credentials to DevOps       ║
  ║  - DevOps updates .env on VM        ║
  ══════════════════════════════════════
    ↓
PHASE 6: Post-Manual Validation
  14_POST_MANUAL_VALIDATION (verify credentials, token acquisition)

PHASE 7: Teams Build & Readiness
  10_TEAMS_PACKAGE_BUILD (uses App ID from .env)
    ↓
  05_TEAMS_READINESS (validate package)
  06_TAB_READINESS (parallel)

PHASE 8: Final Validation
  12_GOLDEN_FILE_VALIDATION

PHASE 9: Aggregate
  07_AGGREGATE_REPORT

PHASE 10: Production (separate run, later)
  13_PRODUCTION_DEPLOY
```

---

## Additional Recommendations from Consensus

### From Gemini-3-pro-preview:
- Split Prompt 01 into 01a (deps install) and 01b (services start) if needed
- Validate MicrosoftAppId/Password format before starting bot

### From DeepSeek-V3.2-Speciale:
- Tab SSO app registration may be needed (check CROSS_TENANT_TEAMS_DEPLOYMENT.md)
- DNS configuration should be in checklist (360innovate responsibility)
- Secure credential transfer via Key Vault, not plaintext email
- SSL certificate renewal cron job verification

### From o3-pro:
- Consider IaC (Bicep/Terraform) for long-term maintainability
- Azure Front Door/App Gateway could offload SSL termination
- Automated Bot Framework API checks for post-tenant validation
- Add monitoring/alerting, backup, security-hardening to deployment plan
- Consider combining 08 into 02 for simpler dependency chain

---

## Risk Assessment (Updated)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Pippa admin unavailable | Medium | High | Document all steps clearly, allow async execution |
| Bot registration fails | Low | High | Include troubleshooting in checklist |
| Container creation RBAC missing | Medium | Medium | Run 02 before 08 to verify permissions |
| SSL cert domain validation fails | Low | High | Verify DNS before certbot |
| DNS propagation delays | Medium | Medium | Add wait/retry logic in 09 |
| **NEW:** Bot credentials not set correctly | Medium | High | Add 14_POST_MANUAL_VALIDATION to verify |
| **NEW:** SSL renewal fails after 90 days | Low | High | Verify cron job in 09 |
| **NEW:** Tab SSO not configured | Medium | Medium | Add to 11 checklist if needed |
| Golden files missing | Medium | Medium | Skip test if files not found, document requirement |

---

## Success Criteria

After all prompts complete successfully:

1. [ ] All Docker containers running (temporal, postgresql, temporal-ui)
2. [ ] Temporal namespace `order-processing` registered
3. [ ] All PM2 processes running (workflow-api, workflow-worker, teams-bot)
4. [ ] All Cosmos containers created with correct partition keys
5. [ ] All Blob containers created with retention policies
6. [ ] Valid SSL certificate for pippai-vm.360innovate.com
7. [ ] SSL renewal cron job active
8. [ ] Bot credentials (MicrosoftAppId, MicrosoftAppPassword) in .env
9. [ ] Bot service can obtain Microsoft token
10. [ ] Teams app package (.zip) created and ready
11. [ ] Detailed checklist provided to antonio@pippaoflondon.co.uk
12. [ ] Golden file tests pass (or documented why skipped)
13. [ ] Aggregate report shows all green

---

## Files Referenced

| File | Purpose |
|------|---------|
| `order_processing_codex_prompts_vm_only_extracted/.../prompts/*.md` | Current Codex prompts |
| `docs/BOT_REGISTRATION_GUIDE_PIPPA.md` | Pippa of London admin guide |
| `docs/UNIFIED_DEPLOYMENT_PLAN.md` | Architecture decisions |
| `CROSS_TENANT_TEAMS_DEPLOYMENT.md` | Cross-tenant strategy |
| `SOLUTION_DESIGN.md` | Full system design |
| `MVP_AND_HOWTO.md` | MVP milestones |

---

## Next Session Instructions

The next Claude Code session should:

1. **Read this document** for full context
2. **Apply fixes** to prompt 05
3. **Create prompts 08-14** following the structure above (note: now includes 14)
4. **Update README.md** with new sequencing
5. **Update 00_ALL_IN_ONE** to reflect new phases and stop gate
6. **Test prompts** in read-only mode first (if available)
7. **Commit changes** with descriptive message

**Estimated effort:** 3-4 hours for thorough implementation

---

## Sources

- [OpenAI Codex CLI Reference](https://developers.openai.com/codex/cli/reference/)
- [Codex CLI Features](https://developers.openai.com/codex/cli/features/)
- Zen Consensus: Gemini-3-pro-preview, DeepSeek-V3.2-Speciale, o3-pro (2025-12-29)
