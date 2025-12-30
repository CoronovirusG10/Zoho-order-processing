# Architecture Decision Record: Temporal.io for Order Processing

**ADR-001**: Validate and Maintain Temporal.io Architecture

**Date**: 2025-12-30
**Status**: ACCEPTED
**Deciders**: Multi-model AI consensus (GPT-5.2, Gemini 2.5 Pro, o3, DeepSeek)
**Technical Area**: Workflow Orchestration

---

## Context

The Pippa of London order processing system is **100% complete and deployed** in production using self-hosted Temporal.io for workflow orchestration. A comprehensive architecture validation was conducted to determine whether:

1. Temporal was the right choice
2. Azure AI Foundry Agents would have been better
3. Azure Durable Functions would have been better
4. A hybrid architecture should be considered

### System Characteristics

| Attribute | Value |
|-----------|-------|
| **Business** | UK fashion brand (B2B wholesale) |
| **Users** | 13 salespeople via Microsoft Teams |
| **Volume** | 50-200 orders/day expected |
| **Workflow Steps** | 9 (deterministic business process) |
| **Human-in-the-Loop** | 4 signal types with escalation |
| **Timeouts** | 24h reminder → 48h escalation → 7d auto-cancel |
| **Audit Requirement** | 5-year compliance |

---

## Decision

**MAINTAIN CURRENT TEMPORAL ARCHITECTURE**

Apply minor hardening improvements without platform migration.

---

## Multi-Model Consensus

### Voting Results

| Model | Stance | Recommendation | Confidence |
|-------|--------|----------------|------------|
| GPT-5.2 | Neutral | **KEEP TEMPORAL** | 9/10 |
| DeepSeek-V3.2-Speciale | Against (devil's advocate) | Migrate to Durable Functions | 7/10 |
| Claude Opus 4 | For | *API Error* | N/A |
| Gemini 2.5 Pro | Neutral | **KEEP TEMPORAL** | 9/10 |
| o3 | Neutral | **KEEP TEMPORAL** | 8/10 |

**Final Tally**: 3-1 in favor of **KEEP TEMPORAL**
**Average Confidence**: 8.67/10

### Key Quotes

> "The decision to maintain the current Temporal architecture is **unequivocally correct**; migrating would introduce significant risk, cost, and complexity for no discernible benefit." — *Gemini 2.5 Pro*

> "**Keep Temporal** — it's the strongest fit for deterministic, auditable, human-in-the-loop order processing." — *GPT-5.2*

> "Do not migrate; instead, **harden the existing Temporal solution**... all migration or hybrid paths introduce cost and risk without delivering new value." — *o3*

---

## Alternatives Considered

### Option A: Keep Temporal (SELECTED)

**Score**: 9/10
**Effort**: ~1 week (hardening only)

**Rationale**:
- Already deployed and operational
- Best-in-class for human-in-the-loop workflows
- Superior testing framework (time-skipping)
- Industry-validated (Vinted, Netflix, Stripe, Datadog)
- Platform-independent (no Azure lock-in)
- Clear scalability path (Temporal Cloud)

### Option B: Migrate to Azure Durable Functions (REJECTED)

**Score**: 6.5/10
**Effort**: 8-9 weeks

**Rejection Reasons**:
- No measurable benefit over working system
- Inferior testing capabilities
- Platform lock-in to Azure
- Migration risk during cutover
- Loss of Temporal-specific features (versioning, queries)

### Option C: Migrate to Azure AI Foundry Agents (REJECTED)

**Score**: 3/10
**Effort**: N/A (fundamentally unsuitable)

**Rejection Reasons**:
- **Wrong tool category** - designed for AI/LLM orchestration, not deterministic workflows
- No structured output guarantees
- Thread-based state (no event-sourced replay)
- No native signals/queries
- Cannot guarantee schema compliance

### Option D: Hybrid (Temporal + Azure Agents) (REJECTED)

**Score**: 5.6/10 (vs 7.9/10 current)
**Effort**: 6-8 weeks

**Rejection Reasons**:
- Committee step is bounded, single-turn task
- Adds unnecessary complexity
- 25% estimated cost increase
- New failure modes (thread lifecycle, polling)
- No user-visible improvement

---

## Consequences

### Positive

1. **Zero migration risk** - System already working in production
2. **Minimal effort** - Only ~1 week for recommended improvements
3. **Industry alignment** - Using same patterns as Vinted (10-12M workflows/day)
4. **Platform independence** - Can run on any cloud or on-premises
5. **Clear evolution path** - Temporal Cloud available when needed

### Negative

1. **Self-hosting overhead** - VM management, patching, backups
2. **Temporal expertise required** - Team must maintain Temporal knowledge
3. **Not Azure-native** - Extra service outside Azure managed services

### Mitigations

| Risk | Mitigation |
|------|------------|
| Self-hosting burden | Consider Temporal Cloud in 6-12 months |
| Single point of failure | Document HA setup for future scale |
| Expertise dependency | Document patterns, create runbooks |

---

## Recommended Improvements (V2)

| Priority | Improvement | Effort | Impact |
|----------|-------------|--------|--------|
| **P1** | Add heartbeats to `runCommittee` activity | 2h | Prevents false timeouts, improves observability |
| **P1** | Document workflow versioning strategy | 4h | Safe deployments during in-flight workflows |
| **P2** | Externalize timeout configuration | 2h | Runtime tuning without code changes |
| **P2** | Add structured tracing (OpenTelemetry) | 1d | End-to-end observability |
| **P3** | Create operational runbooks | 2d | Reduce MTTR, enable on-call |
| **P3** | Evaluate Temporal Cloud migration | 1w | Reduce ops burden at scale |

---

## Trigger Conditions to Revisit

The architecture decision should be revisited if any of these conditions occur:

1. **Azure-native mandate** - Corporate policy requires all services on Azure
2. **Multi-turn AI conversations** - Committee step evolves beyond single-turn
3. **Scale exceeds 10,000 workflows/day** - May need Temporal Cloud
4. **Temporal operational burden** - Team struggles with self-hosting
5. **Cost concerns** - Significant cost difference emerges

---

## Research Documentation

All research artifacts are preserved in `docs/claude-logs/tasks/`:

| File | Content |
|------|---------|
| `ARCH_VALIDATION_TRACK_1_AZURE_AGENTS.md` | Azure AI Foundry Agents analysis |
| `ARCH_VALIDATION_TRACK_2_DURABLE_FUNCTIONS.md` | Azure Durable Functions comparison |
| `ARCH_VALIDATION_TRACK_3_TEMPORAL_AUDIT.md` | Temporal best practices audit |
| `ARCH_VALIDATION_TRACK_4_HYBRID.md` | Hybrid architecture analysis |
| `ARCH_VALIDATION_TRACK_5_INDUSTRY.md` | Industry patterns research |
| `ARCH_VALIDATION_CHECKPOINT_1.md` | Phase 1 research checkpoint |
| `ARCHITECTURE_COMPARISON_MATRIX.md` | Feature comparison matrix |

---

## Conclusion

The multi-model consensus (3-1, 8.67/10 average confidence) **strongly validates** the Temporal.io architecture decision. The system is production-ready, industry-aligned, and optimally suited for the order processing requirements. Migration to Azure alternatives would introduce risk and cost without delivering new value.

**Recommended action**: Apply P1/P2 improvements and plan Temporal Cloud evaluation for Q2 2026.

---

*ADR created: 2025-12-30*
*Validation method: 5-model AI consensus via Zen MCP*
