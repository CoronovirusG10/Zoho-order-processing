# Master Execution Guide — Pre-Production Sprint

**Date:** 2025-12-26
**Objective:** Complete all remaining work and validation to reach Pre-Production ready state

---

## Execution Overview

This guide orchestrates two parallel execution phases:

| Phase | Sessions | Purpose | Duration |
|-------|----------|---------|----------|
| **Phase 1** | 8 Claude Code agents | Complete implementation work | ~30 min |
| **Phase 2** | 12 Zen sessions (3 models × 4 domains) | Comprehensive testing | ~20 min |

**Total Estimated Time:** 50 minutes (phases can overlap)

---

## Phase 1: Implementation (8 Parallel Claude Code Agents)

### Prompt Location
`/data/order-processing/app/_build_logs/2025-12-26/PROMPT_1_PRE_PRODUCTION.md`

### Agent Assignments

| Agent | Task | Files | Priority |
|-------|------|-------|----------|
| 1 | Workflow Activities Migration | 8 activity files | P0 |
| 2 | Workflow Orchestrations Migration | 3 core files | P0 |
| 3 | Workflow Triggers Migration | 5 trigger files | P0 |
| 4 | Test Fixes | 2 test files + sources | P0 |
| 5 | Azure Deployment Preparation | Bicep + scripts | P1 |
| 6 | Cross-Tenant Teams Configuration | Manifest + scripts | P1 |
| 7 | Integration Test Setup | Test infrastructure | P1 |
| 8 | Documentation & Runbooks | Docs + changelog | P2 |

### Launch Command (CTO)
```javascript
// Launch all 8 agents in a SINGLE message with parallel Task tool calls
// Each agent uses subagent_type: "general-purpose"
// All agents receive compressed context + specific instructions
```

### Success Criteria for Phase 1
- [ ] All 11 services build (`npm run build` succeeds)
- [ ] All 247 tests pass (`npm test` shows 0 failures)
- [ ] Workflow strict build passes (`cd services/workflow && npm run build:strict`)
- [ ] Bicep validates (`az bicep build --file infra/main.bicep`)
- [ ] Teams manifest validates

---

## Phase 2: Multi-Model Testing (12 Parallel Zen Sessions)

### Prompt Location
`/data/order-processing/app/_build_logs/2025-12-26/PROMPT_2_ZEN_MULTI_MODEL_TESTING.md`

### Session Matrix

| Domain | GPT-5.2 | O3 | DeepSeek 3.2 |
|--------|---------|----|--------------|
| Security & Compliance | 1A | 1B | 1C |
| Business Logic | 2A | 2B | 2C |
| Infrastructure | 3A | 3B | 3C |
| UX & Integration | 4A | 4B | 4C |

### Launch Command (CTO)
```javascript
// Launch all 12 Zen sessions in a SINGLE message with parallel mcp__zen calls
// Each session gets:
// - model: "gpt-5.2" | "o3" | "deepseek-3.2"
// - prompt: compressed context + domain-specific test instructions
// - mode: "ultrathink"
```

### Success Criteria for Phase 2
- [ ] All 12 sessions return valid JSON results
- [ ] No CRITICAL security findings
- [ ] Model agreement rate > 80% per domain
- [ ] All blocking issues documented

---

## Execution Sequence

```
T+0:00  ─┬─ Launch Phase 1 (8 Claude Code agents)
         │
T+0:05  ─┼─ Agents 1-3 (Workflow) likely complete first
         │
T+0:15  ─┼─ Agents 4-8 complete
         │
T+0:20  ─┼─ Phase 1 verification
         │   npm run build
         │   npm test
         │   az bicep build
         │
T+0:25  ─┬─ Launch Phase 2 (12 Zen sessions) [can start earlier if Phase 1 stable]
         │
T+0:35  ─┼─ All Zen sessions complete
         │
T+0:40  ─┼─ Cross-model consensus generation
         │
T+0:45  ─┼─ Final report assembly
         │
T+0:50  ─┴─ Pre-Production Ready Decision
```

---

## CTO Context-Saving Strategy

### DO:
- Launch ALL agents in ONE message (parallel tool calls)
- Use compressed context (provided in prompts)
- Delegate ALL file reading to agents
- Only read summary files after completion

### DON'T:
- Re-read files that agents will read
- Make sequential agent launches
- Include full file contents in prompts
- Perform implementation work yourself

### Token Budget (CTO Session)
- Prompt reading: ~2,000 tokens
- Agent launches: ~500 tokens per agent
- Result collection: ~1,000 tokens per agent
- Final summary: ~2,000 tokens
- **Total CTO usage: ~15,000 tokens** (vs 200,000+ if doing work directly)

---

## Final Deliverables

After both phases complete, the following files should exist:

### Phase 1 Outputs
```
_build_logs/2025-12-26/
├── 01_workflow_activities.md
├── 02_workflow_orchestrations.md
├── 03_workflow_triggers.md
├── 04_test_fixes.md
├── 05_azure_deployment.md
├── 06_teams_configuration.md
├── 07_integration_tests.md
├── 08_documentation.md
└── CTO_PRE_PRODUCTION_SUMMARY.md
```

### Phase 2 Outputs
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

## Pre-Production Checklist

### Must Have (Blocking)
- [ ] All 11 services build
- [ ] All 247 tests pass
- [ ] No CRITICAL security findings
- [ ] Deployment scripts ready
- [ ] Teams app package valid

### Should Have (Before Deploy)
- [ ] Integration tests in place
- [ ] Runbooks documented
- [ ] Model agreement > 80%
- [ ] Changelog updated

### Nice to Have (Post-Deploy)
- [ ] Monitoring dashboards
- [ ] Alerting configured
- [ ] Performance benchmarks
- [ ] Load testing results

---

## Rollback Plan

If Phase 1 fails:
1. Check agent summary files for errors
2. Run specific agent again with fixes
3. Manual intervention for blocking issues

If Phase 2 finds critical issues:
1. Stop Phase 1 agents if still running
2. Address critical findings first
3. Re-run affected Zen domain
4. Update consensus report

---

## Sign-Off

Pre-Production is approved when:
- [ ] CTO_PRE_PRODUCTION_SUMMARY.md shows all green
- [ ] ZEN_CONSENSUS_REPORT.md shows no blockers
- [ ] Human reviewer approves cross-model disagreements
- [ ] Deployment to staging successful

**Approver:** _______________
**Date:** _______________
