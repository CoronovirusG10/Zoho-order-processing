# PROMPT 2: Zen Multi-Model Testing Suite

**Mode:** ULTRATHINK
**Execution:** 12 Concurrent Zen Sessions (4 test domains × 3 models each)
**Models:** GPT-5.2, O3, DeepSeek 3.2
**Goal:** Comprehensive testing of all application aspects with cross-model verification

---

## CTO ORCHESTRATION INSTRUCTIONS

You are the CTO orchestrator for the testing phase. Your job is to:
1. Read this prompt ONCE
2. Create compressed context for all Zen sessions
3. Launch ALL 12 Zen sessions IN PARALLEL using mcp__zen
4. Collect results and cross-compare model outputs
5. Generate consensus test report

**CRITICAL:** To save CTO context:
- Launch all 12 Zen sessions in ONE tool call batch
- Each session gets IDENTICAL context + domain-specific test instructions
- Compare outputs across models for the same domain
- Flag any model disagreements for human review

---

## COMPRESSED CONTEXT FOR ALL ZEN SESSIONS

```markdown
# Order Processing Application — Test Context

## Application Purpose
Teams 1:1 bot + personal tab that:
1. Receives Excel uploads (1 file = 1 order)
2. Uses deterministic-led extraction with 3-model LLM committee
3. Creates Draft Sales Orders in Zoho Books
4. Stores all artifacts in Azure Blob for 5+ year audit

## Architecture Overview
- Monorepo: `/data/order-processing/app/`
- 11 services: types, shared, parser, committee, storage, api, teams-bot, teams-tab, agent, zoho, workflow
- Tech: TypeScript, Node.js, React, Bot Framework v4, Durable Functions v3, Bicep IaC

## Key Requirements
- Cross-tenant Teams deployment (Azure Tenant A, Teams Tenant B)
- Formula blocking in Excel files (configurable)
- Zoho pricing prevails over spreadsheet prices
- Qty=0 is valid (no warnings)
- Human-in-the-loop for issue resolution
- Evidence-based extraction (cell reference proof)
- End-to-end correlation IDs

## Security Constraints
- No secrets in logs
- WORM policies for audit data
- OAuth tokens in Key Vault
- Role-based access (SalesUser, SalesManager, OpsAuditor)

## Current State
- 10 of 11 services build successfully
- 244 of 247 tests pass
- Workflow service needs durable-functions v3 migration
- Pre-production deployment pending
```

---

## 12 ZEN SESSIONS TO LAUNCH (4 Domains × 3 Models)

### DOMAIN 1: Security & Compliance Testing

#### Session 1A: GPT-5.2 — Security Audit
```
MODEL: gpt-5.2
DOMAIN: Security & Compliance

INSTRUCTIONS:
You are a security auditor reviewing the Order Processing application.

ANALYZE THE FOLLOWING FILES:
1. services/zoho/src/oauth-manager.ts — Token handling
2. services/storage/src/redaction.ts — Secret redaction
3. packages/shared/src/logging.ts — Log sanitization
4. infra/modules/keyvault.bicep — Secret storage
5. services/teams-bot/src/middleware/*.ts — Auth middleware

TEST CASES TO VERIFY:
1. OWASP Top 10 compliance
   - [ ] No SQL injection vectors
   - [ ] No XSS in user-facing outputs
   - [ ] No command injection in file handling
   - [ ] Secrets never logged

2. Authentication & Authorization
   - [ ] Bot tokens validated correctly
   - [ ] Tab SSO tokens verified
   - [ ] Role-based access enforced
   - [ ] Cross-tenant isolation

3. Data Protection
   - [ ] PII redacted in logs
   - [ ] OAuth tokens stored in Key Vault
   - [ ] Audit data immutable (WORM)
   - [ ] 5-year retention enforced

4. Infrastructure Security
   - [ ] Network isolation in Bicep
   - [ ] Managed identities used
   - [ ] No hardcoded secrets
   - [ ] Minimum permissions

OUTPUT FORMAT:
```json
{
  "model": "gpt-5.2",
  "domain": "security",
  "findings": [
    {"severity": "critical|high|medium|low|info", "category": "...", "file": "...", "line": N, "description": "...", "recommendation": "..."}
  ],
  "passed_checks": ["..."],
  "overall_risk": "low|medium|high|critical",
  "confidence": 0.0-1.0
}
```
```

#### Session 1B: O3 — Security Audit
```
MODEL: o3
DOMAIN: Security & Compliance

[IDENTICAL INSTRUCTIONS AS 1A]
```

#### Session 1C: DeepSeek 3.2 — Security Audit
```
MODEL: deepseek-3.2
DOMAIN: Security & Compliance

[IDENTICAL INSTRUCTIONS AS 1A]
```

---

### DOMAIN 2: Business Logic Testing

#### Session 2A: GPT-5.2 — Business Logic
```
MODEL: gpt-5.2
DOMAIN: Business Logic

INSTRUCTIONS:
You are a QA engineer testing the business logic of the Order Processing application.

ANALYZE THE FOLLOWING FILES:
1. services/parser/src/extractor.ts — Data extraction
2. services/parser/src/validator.ts — Validation rules
3. services/committee/src/aggregator.ts — Voting logic
4. services/zoho/src/order-mapper.ts — Order mapping
5. services/workflow/src/orchestrations/order-processing.ts — Flow logic

TEST CASES TO VERIFY:
1. Excel Parsing
   - [ ] Formula detection and blocking works
   - [ ] Merged cells handled correctly
   - [ ] Farsi headers recognized
   - [ ] Multi-sheet selection prompts user
   - [ ] Empty rows ignored

2. Committee Voting
   - [ ] 3 distinct providers selected
   - [ ] Weighted voting calculates correctly
   - [ ] Disagreements surface to user
   - [ ] Confidence thresholds respected
   - [ ] Golden file calibration works

3. Zoho Integration
   - [ ] SKU-first matching
   - [ ] GTIN fallback
   - [ ] Fuzzy matching with user selection
   - [ ] Idempotent draft creation
   - [ ] Fingerprint deduplication

4. Edge Cases
   - [ ] Qty=0 allowed (no warning)
   - [ ] Zoho price overrides spreadsheet
   - [ ] Empty customer field handled
   - [ ] Very large orders (1000+ lines)
   - [ ] Unicode in all fields

OUTPUT FORMAT:
```json
{
  "model": "gpt-5.2",
  "domain": "business_logic",
  "test_results": [
    {"test": "...", "status": "pass|fail|skip", "evidence": "...", "notes": "..."}
  ],
  "coverage_estimate": 0.0-1.0,
  "confidence": 0.0-1.0
}
```
```

#### Session 2B: O3 — Business Logic
```
MODEL: o3
DOMAIN: Business Logic

[IDENTICAL INSTRUCTIONS AS 2A]
```

#### Session 2C: DeepSeek 3.2 — Business Logic
```
MODEL: deepseek-3.2
DOMAIN: Business Logic

[IDENTICAL INSTRUCTIONS AS 2A]
```

---

### DOMAIN 3: Infrastructure & Deployment Testing

#### Session 3A: GPT-5.2 — Infrastructure
```
MODEL: gpt-5.2
DOMAIN: Infrastructure & Deployment

INSTRUCTIONS:
You are a DevOps engineer reviewing the infrastructure and deployment configuration.

ANALYZE THE FOLLOWING FILES:
1. infra/main.bicep — Main deployment
2. infra/modules/*.bicep — All 14 modules
3. package.json (root) — Workspace configuration
4. services/*/package.json — Service dependencies
5. services/*/tsconfig.json — Build configuration

TEST CASES TO VERIFY:
1. Bicep Templates
   - [ ] All resources have proper naming
   - [ ] Region is Sweden Central
   - [ ] Dependencies correct
   - [ ] Parameters have defaults
   - [ ] Outputs are useful

2. Resource Configuration
   - [ ] Storage has WORM policy
   - [ ] Key Vault has soft delete
   - [ ] Cosmos has proper partition keys
   - [ ] App Insights connected
   - [ ] Managed identities used

3. Build System
   - [ ] All workspaces defined
   - [ ] Dependencies resolve
   - [ ] Build order correct
   - [ ] No circular dependencies
   - [ ] TypeScript configs consistent

4. Deployment Readiness
   - [ ] Environment variables documented
   - [ ] Secrets parameterized
   - [ ] Rollback possible
   - [ ] Health checks defined
   - [ ] Scaling configured

OUTPUT FORMAT:
```json
{
  "model": "gpt-5.2",
  "domain": "infrastructure",
  "issues": [
    {"severity": "critical|high|medium|low", "category": "...", "file": "...", "description": "...", "fix": "..."}
  ],
  "deployment_ready": true|false,
  "blocking_issues": [],
  "confidence": 0.0-1.0
}
```
```

#### Session 3B: O3 — Infrastructure
```
MODEL: o3
DOMAIN: Infrastructure & Deployment

[IDENTICAL INSTRUCTIONS AS 3A]
```

#### Session 3C: DeepSeek 3.2 — Infrastructure
```
MODEL: deepseek-3.2
DOMAIN: Infrastructure & Deployment

[IDENTICAL INSTRUCTIONS AS 3A]
```

---

### DOMAIN 4: User Experience & Integration Testing

#### Session 4A: GPT-5.2 — UX & Integration
```
MODEL: gpt-5.2
DOMAIN: User Experience & Integration

INSTRUCTIONS:
You are a UX engineer and integration tester reviewing the user-facing components.

ANALYZE THE FOLLOWING FILES:
1. services/teams-bot/src/cards/*.ts — Adaptive cards
2. services/teams-bot/src/handlers/*.ts — User interactions
3. services/teams-tab/src/components/*.tsx — React components
4. services/teams-tab/src/services/*.ts — API clients
5. services/api/src/routes/*.ts — API endpoints

TEST CASES TO VERIFY:
1. Teams Bot UX
   - [ ] Welcome message is clear
   - [ ] File upload instructions obvious
   - [ ] Error messages helpful
   - [ ] Progress updates timely
   - [ ] Farsi text renders correctly

2. Adaptive Cards
   - [ ] Issues card shows all problems
   - [ ] User can correct values
   - [ ] Confirmation before Zoho create
   - [ ] Success/failure feedback clear
   - [ ] Cards work on mobile

3. Personal Tab
   - [ ] SSO login seamless
   - [ ] Case list loads fast
   - [ ] Status filters work
   - [ ] Detail view complete
   - [ ] Manager view shows team cases

4. API Integration
   - [ ] Correlation IDs flow through
   - [ ] Error responses consistent
   - [ ] Pagination implemented
   - [ ] Rate limiting in place
   - [ ] CORS configured

OUTPUT FORMAT:
```json
{
  "model": "gpt-5.2",
  "domain": "ux_integration",
  "ux_issues": [
    {"severity": "critical|high|medium|low", "component": "...", "issue": "...", "suggestion": "..."}
  ],
  "integration_issues": [
    {"endpoint": "...", "issue": "...", "fix": "..."}
  ],
  "accessibility_score": 0-100,
  "confidence": 0.0-1.0
}
```
```

#### Session 4B: O3 — UX & Integration
```
MODEL: o3
DOMAIN: User Experience & Integration

[IDENTICAL INSTRUCTIONS AS 4A]
```

#### Session 4C: DeepSeek 3.2 — UX & Integration
```
MODEL: deepseek-3.2
DOMAIN: User Experience & Integration

[IDENTICAL INSTRUCTIONS AS 4A]
```

---

## ZEN SESSION EXECUTION

For each session, use the mcp__zen tool with:
```
model: [gpt-5.2 | o3 | deepseek-3.2]
prompt: [compressed context + domain-specific instructions]
mode: ultrathink
```

Launch all 12 sessions in parallel:
- 1A, 1B, 1C (Security)
- 2A, 2B, 2C (Business Logic)
- 3A, 3B, 3C (Infrastructure)
- 4A, 4B, 4C (UX & Integration)

---

## CROSS-MODEL COMPARISON

After all 12 sessions complete, generate:

### Consensus Report
```markdown
# Multi-Model Test Consensus — 2025-12-26

## Domain 1: Security
| Finding | GPT-5.2 | O3 | DeepSeek 3.2 | Consensus |
|---------|---------|----|--------------| ----------|
| [finding] | ✅/❌ | ✅/❌ | ✅/❌ | AGREE/DISAGREE |

## Domain 2: Business Logic
[same format]

## Domain 3: Infrastructure
[same format]

## Domain 4: UX & Integration
[same format]

## Model Agreement Rate
- Security: X%
- Business Logic: X%
- Infrastructure: X%
- UX & Integration: X%
- Overall: X%

## Disagreements Requiring Human Review
1. [description] — Models: [which disagreed]

## Final Verdict
- Pre-Production Ready: YES/NO
- Blocking Issues: [count]
- High Priority Fixes: [list]
```

---

## OUTPUT FILES

Save all results to:
```
_build_logs/2025-12-26/
├── zen_security_gpt52.json
├── zen_security_o3.json
├── zen_security_deepseek32.json
├── zen_business_gpt52.json
├── zen_business_o3.json
├── zen_business_deepseek32.json
├── zen_infra_gpt52.json
├── zen_infra_o3.json
├── zen_infra_deepseek32.json
├── zen_ux_gpt52.json
├── zen_ux_o3.json
├── zen_ux_deepseek32.json
└── ZEN_CONSENSUS_REPORT.md
```

---

## SUCCESS CRITERIA

Testing is COMPLETE when:
1. ✅ All 12 Zen sessions return results
2. ✅ Cross-model consensus calculated
3. ✅ All CRITICAL findings addressed or documented
4. ✅ Model agreement rate > 80% per domain
5. ✅ No blocking issues for pre-production

---

## ESCALATION RULES

If models DISAGREE on a finding:
- 2 of 3 agree → Accept majority opinion
- All 3 disagree → Flag for human review
- Any CRITICAL finding → Requires human sign-off regardless of consensus
