# What we need to know (open questions / discovery checklist)

**Last updated:** 2025-12-21

This file lists remaining unknowns that materially affect build/rollout.  
For each item: what we need, why it matters, and how to answer it.

---

## A) Cross-tenant Teams deployment (highest risk)

### A1. Can the bot (Tenant A) reliably download file attachments uploaded in Teams (Tenant B) without Graph?
- **Why it matters:** This determines whether we need an OAuth sign-in + Graph fallback.
- **How to answer (fast):**
  1. Deploy a minimal bot in Tenant A with Teams channel enabled.
  2. Install as custom app in Tenant B (admin upload).
  3. Upload .xlsx in 1:1 chat and attempt HTTP GET to the attachment `downloadUrl` from Tenant A backend.
  4. Record success rate, TTL, and failure reasons.
- **If it fails:** implement delegated Graph OBO fallback.

### A2. Tenant B policies: are custom apps and external multi-tenant apps allowed?
- **Why it matters:** Without this, onboarding fails.
- **How to answer:** Tenant B admin checks Teams admin centre:
  - Org-wide app settings (custom apps)
  - App permission policy assignments
  - Any tenant restriction on external apps/consent

### A3. Tab SSO in cross-tenant: does Teams SSO token issuance work with your multi-tenant Entra app?
- **Why it matters:** Personal tab (My cases/Manager view) depends on it.
- **How to answer:** Use Microsoft Teams SSO sample pattern; test in Tenant B.

---

## B) Zoho Books specifics

### B1. Exact way to create a *Draft* Sales Order in your Zoho Books org
- **Why it matters:** Zoho may require specific status fields/flags.
- **How to answer:** Verify in Zoho Books API docs for your DC/edition:
  - endpoint: POST salesorders
  - required fields
  - how to set draft status

### B2. GTIN custom field identifier and query strategy
- **Why it matters:** item fallback matching depends on it.
- **How to answer:**
  1. In Zoho UI, identify the custom field name used for GTIN/EAN.
  2. In API, find the custom field `customfield_id`/API name.
  3. Decide: do we query items by search text and then filter, or mirror items into Cosmos for fast lookup?

### B3. Do you have a Zoho sandbox / test organisation?
- **Why it matters:** E2E test safety.
- **How to answer:** Check Zoho subscription features; if none, create a dedicated test org with non-production data.

---

## C) Spreadsheet variability / customer templates

### C1. How many distinct ERP export formats exist (top 10 customers)?
- **Why it matters:** determines how quickly template registry pays off.
- **How to answer:** sample collection and clustering by header fingerprint.

### C2. Do users want to specify customer explicitly up-front?
- **Why it matters:** massively reduces ambiguity.
- **How to answer:** UX test: add optional “Customer” field in upload card and measure confusion/time saved.

---

## D) Committee providers (v1 uses limited committee; v2 expands)

### D1. Which external providers are acceptable to send header/sample values to?
- **Why it matters:** operational + commercial + security.
- **How to answer:** define allow-list (Gemini/xAI/etc) and document what data categories may be shared.

### D2. What is your acceptable latency per order?
- **Why it matters:** committee adds model calls; affects UX.
- **How to answer:** measure current Teams patience threshold; decide if committee runs synchronously or asynchronously.

---

## E) Audit and retention

### E1. Do you need immutable/WORM blob policy?
- **Why it matters:** changes storage configuration and operational processes.
- **How to answer:** confirm internal audit requirements. If “yes”, enable time-based retention policy.

### E2. Audit bundle access model (who can download?)
- **Why it matters:** security for stored order data.
- **How to answer:** define roles:
  - SalesUser: own cases only
  - SalesManager: team scope
  - OpsAuditor: read-only all
and implement via Entra app roles.

