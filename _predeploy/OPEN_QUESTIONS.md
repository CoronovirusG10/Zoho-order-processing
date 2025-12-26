# Open Questions

**Project:** Sales Order Intake Bot
**Last Updated:** 2025-12-26

---

## Overview

These questions must be answered before production deployment. Each includes the responsible party and where to find the answer.

---

## Critical (Blocking Production)

### Q1: Multi-Tenant Bot Deprecation Timeline

**Question:** What is the exact timeline and alternative for multi-tenant bot creation after July 31, 2025?

**Why It Matters:** Current cross-tenant design relies on multi-tenant Entra app registration. If this is deprecated, we need an alternative approach.

**Who Answers:** Microsoft Documentation / Azure Support

**Where to Check:**
- https://learn.microsoft.com/en-us/azure/bot-service/
- Azure Bot Service announcements
- Partner Center announcements

**Validation:** Confirm supported bot identity types for cross-tenant scenarios in 2025+

**Status:** OPEN

---

### Q2: Single-Tenant Bot Cross-Tenant Support

**Question:** Can a single-tenant Azure Bot work with a multi-tenant Entra app registration for cross-tenant Teams deployment?

**Why It Matters:** If yes, this is the migration path. If no, need AppSource or alternative.

**Who Answers:** Microsoft Identity Team / Azure Bot Support

**Where to Check:**
- Bot Framework documentation
- Entra ID B2B documentation
- Test in dev environment

**Validation:** Deploy test bot with single-tenant resource + multi-tenant app, verify cross-tenant works

**Status:** OPEN

---

### Q3: Tenant B Admin Availability

**Question:** Who is the Tenant B admin for production deployment, and are they available for enrollment?

**Why It Matters:** Tenant B admin must upload app to org catalog and grant consent.

**Who Answers:** Customer / Business Owner

**Where to Check:** Customer organization chart, IT department

**Validation:** Confirm admin can access Teams Admin Centre and Entra ID

**Status:** OPEN

---

## High Priority (Before Production)

### Q4: Production Zoho Organization

**Question:** What is the production Zoho Books organization ID and what permissions are needed?

**Why It Matters:** Need to configure production credentials and verify access scope.

**Who Answers:** Business Owner / Finance Team

**Where to Check:** Zoho Books admin console

**Validation:** List organizations API returns production org

**Status:** OPEN

---

### Q5: Test Customer for Smoke Tests

**Question:** What customer record should be used for non-destructive smoke tests?

**Why It Matters:** Avoid creating real orders during testing.

**Who Answers:** Business Owner

**Where to Check:** Create dedicated test customer in Zoho sandbox and production

**Validation:** Customer exists, can be used for draft orders that are deleted

**Status:** OPEN

---

### Q6: Conditional Access Policies in Tenant B

**Question:** Does Tenant B have Conditional Access policies that might block external app access?

**Why It Matters:** Could prevent SSO or consent for the Teams app.

**Who Answers:** Tenant B IT Admin

**Where to Check:** Entra ID > Security > Conditional Access

**Validation:** Test app consent and SSO before full rollout

**Status:** OPEN

---

### Q7: Production Bot Certificate

**Question:** Who will generate/manage the bot certificate for production?

**Why It Matters:** Production should use certificate auth, not client secret.

**Who Answers:** DevOps / Security Team

**Where to Check:** Certificate management process, CA requirements

**Validation:** Certificate issued, uploaded to Entra and Key Vault

**Status:** OPEN

---

## Medium Priority (Production Hardening)

### Q8: CI/CD Pipeline Strategy

**Question:** Should CI/CD use GitHub Actions or Azure Pipelines?

**Why It Matters:** Need to set up automated deployments.

**Who Answers:** DevOps Team

**Where to Check:** Organization standards, existing pipelines

**Validation:** Pipeline configured, builds and deploys successfully

**Status:** OPEN

---

### Q9: Model Quota Increases

**Question:** Can we request quota increases for o3 (1K→5K) and claude-opus (2K→5K)?

**Why It Matters:** Higher throughput needed for production committee voting.

**Who Answers:** Azure Support / Foundry Portal

**Where to Check:** Azure AI Foundry quotas page

**Validation:** Quota increased, visible in portal

**Status:** OPEN

---

### Q10: Monitoring and Alerting

**Question:** What alerts should be configured for production?

**Why It Matters:** Need proactive notification of issues.

**Who Answers:** Operations Team

**Where to Check:** Organization alerting standards

**Validation:** Alerts configured for: bot down, Zoho errors, queue depth

**Status:** OPEN

---

### Q11: Support Escalation Path

**Question:** Who is the support escalation path for production issues?

**Why It Matters:** Need clear ownership for incident response.

**Who Answers:** Business Owner / IT Management

**Where to Check:** Organizational support structure

**Validation:** Contact list documented, on-call rotation if needed

**Status:** OPEN

---

## Low Priority (Future Considerations)

### Q12: Multi-Language Expansion

**Question:** Are additional languages beyond English and Farsi needed?

**Why It Matters:** Parser has multi-language support framework.

**Who Answers:** Product Owner

**Where to Check:** Business requirements

**Validation:** Additional language synonyms added to parser

**Status:** OPEN

---

### Q13: PDF/Image Support

**Question:** When will OCR for PDFs and images be needed?

**Why It Matters:** Currently out of MVP scope.

**Who Answers:** Product Owner

**Where to Check:** Customer feedback, feature requests

**Validation:** Foundry OCR models available when needed

**Status:** OPEN

---

### Q14: Teams Group Chat Support

**Question:** Will users need to use the bot in group chats, not just 1:1?

**Why It Matters:** Current manifest only supports personal scope.

**Who Answers:** Product Owner

**Where to Check:** User feedback

**Validation:** Update manifest scopes if needed

**Status:** OPEN

---

## Question Tracking

| ID | Priority | Question | Owner | Due Date | Status |
|----|----------|----------|-------|----------|--------|
| Q1 | Critical | Multi-tenant deprecation | DevOps | Before July 2025 | OPEN |
| Q2 | Critical | Single-tenant cross-tenant | DevOps | Before July 2025 | OPEN |
| Q3 | Critical | Tenant B admin | Business | Before prod | OPEN |
| Q4 | High | Production Zoho org | Business | Before prod | OPEN |
| Q5 | High | Test customer | Business | Before smoke test | OPEN |
| Q6 | High | Conditional access | Tenant B IT | Before prod | OPEN |
| Q7 | High | Bot certificate | Security | Before prod | OPEN |
| Q8 | Medium | CI/CD strategy | DevOps | Before prod | OPEN |
| Q9 | Medium | Model quotas | DevOps | Before prod | OPEN |
| Q10 | Medium | Alerting | Ops | Before prod | OPEN |
| Q11 | Medium | Support path | Management | Before prod | OPEN |
| Q12 | Low | Multi-language | Product | Future | OPEN |
| Q13 | Low | PDF/Image support | Product | Future | OPEN |
| Q14 | Low | Group chat | Product | Future | OPEN |

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-26
