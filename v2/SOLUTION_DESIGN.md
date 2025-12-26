# Sales Order Intake — v2 “Committee + faster automation” (multi-provider, language-aware)

**Last updated:** 2025-12-21  
**Primary design goal:** reduce manual entry while keeping incorrect order creation low via **multi-model verification** and calibrated voting.  
**Operating model:** **hybrid** (auto-create when confidence is high; otherwise review-first).  
**Teams + hosting:** Teams users in **Tenant B**, Azure workload in **Tenant A** (Sweden Central).

v2 builds on v1 but adds a **pluggable multi-provider committee** (Azure Foundry + external APIs such as Gemini/xAI) and a more explicit “auto-create” lane.

---

## What changes from v1 (summary)
1. **Committee becomes first-class**: 3 models are always run (or 1 + escalation policy), producing a disagreement report.
2. **Weighted voting**: committee member weights are calibrated on your golden files and re-calibrated periodically.
3. **Random 3-of-N selection**: maintain a pool of N models/providers; pick 3 per order (optionally always include a primary).
4. **Hybrid workflow**:
   - Auto-create draft when: committee agrees + validations pass + customer/item resolutions unambiguous.
   - Otherwise: collect user fixes first.
5. **Better language handling**: Farsi headers and descriptions handled explicitly; user can specify customer to reduce ambiguity.

Everything else (auditability, retention, Zoho pricing rules, SKU→GTIN fallback, qty=0 allowed, formula blocking) remains.

---

## Model availability (from your Sweden Central inventory)

Based on the inventory report you provided (generated 2025-12-20), you have:
- Strong Azure Foundry coverage (OpenAI GPT-5.x, GPT-4.1-mini, Anthropic Claude 4.5, DeepSeek V3.2, xAI Grok models, multilingual embeddings), plus
- Direct API access to Gemini, Anthropic, and xAI.  
(See `MODEL_ACCESS_REPORT_2025-12-20.md`.)

**Recommendation (pragmatic v2 committee pool):**
- Azure: `gpt-4.1-mini` (fast baseline), `claude-sonnet-4-5` (diverse), `DeepSeek-V3.2` (diverse)
- External: `gemini-2.5-pro` (diverse) and/or `grok-4.1` (if you want extra redundancy)
Keep the pool small initially (N=4–6) to avoid operational sprawl.

---

## 1. Executive summary

### Best architecture (v2)
Still **Option B** (bot → Functions → agent → Zoho) for determinism and operability, but with a more autonomous agent:
- Deterministic parsing/validation remains mandatory.
- Committee results drive whether we auto-create or ask user.

### Workflow mode recommendation
**Hybrid (recommended for v2):**
- Auto-create only when confidence is high and disagreements are absent.
- Otherwise review-first.

This gives measurable efficiency gains while keeping safety.

---

## 2. Architecture options (v2 view)

v2 uses the same A/B/C options; the difference is where committee lives:

- In Option B (recommended), committee is a tool called by the validator function (preferred) OR by the agent (acceptable).
- In Option C, the agent orchestrates committee + parsing + Zoho calls itself (faster to change, riskier).

Operationally, keep committee outside the agent if you want reproducibility and easier testing.

---

## 3. Teams experience (chat + personal tab)

Same base UX as v1, plus:

### 3.1 Auto-create lane
If the case meets auto-create threshold:
- Bot posts: “All checks passed — creating draft now…”
- Creates draft immediately and posts Zoho link + audit bundle.
- Still shows a caution banner and “Report an issue” button.

### 3.2 Disagreement UX (explicit, researched)
When committee disagrees, the user sees:
- A “What we’re unsure about” card listing ambiguous fields.
- Each ambiguous field has:
  - the competing interpretations (e.g., which column is SKU)
  - evidence preview (header + sample values)
  - a required user choice.

This is the minimum UX needed to make committee useful without over-engineering.

### 3.3 Personal tab additions
- “Auto-created drafts” filter for managers.
- “Disagreement rate” metric (per salesperson/customer) to highlight problematic templates.

---

## 4. Excel ingestion and extraction strategy (v2 additions)

v2 keeps strict deterministic extraction, but improves schema inference accuracy without more LLM freedom by adding:

1. **Template registry + fingerprinting (mandatory in v2):**
   - fingerprint = hash(sheet names + header row tokens + column count)
   - if known fingerprint, reuse stored mapping (no LLM needed)

2. **Multilingual header normalisation pipeline:**
   - detect language per header cell
   - normalise Farsi/Arabic variants (e.g., ی/ي, ک/ك)
   - transliterate where helpful (optional)
   - then apply deterministic scoring

3. **Committee used only for disambiguation:**
   - The committee never “extracts the table”.
   - It only decides among candidate mappings and flags anomalies.

---

## 5. Committee design (deep dive)

### 5.1 Committee contract (strict)
Each committee member receives the same bounded request:

**Input**
- candidate columns for each semantic field (IDs only)
- header strings
- 5–10 sample values per candidate
- constraints and validation hints (e.g., “GTIN should be 8/12/13/14 digits”)

**Output**
```json
{
  "model": "provider/model",
  "fieldChoices": {
    "sku_col": "C",
    "qty_col": "F",
    "unit_price_col": "G",
    "line_total_col": "H"
  },
  "confidence": {
    "sku_col": 0.93,
    "qty_col": 0.88
  },
  "flags": [
    {"code":"MULTI_TABLE", "message":"..."}
  ]
}
```

No free-form extraction allowed.

### 5.2 Random 3-of-N selection policy
Maintain a pool N of eligible models (Azure + external). For each case:
- Always include one primary (e.g., Azure `gpt-4.1-mini`) **or**
- Pick 3 at random weighted by:
  - independence (provider diversity),
  - past accuracy for similar templates,
  - cost.

Keep a per-case record of which 3 were selected for audit.

### 5.3 Calibrating committee weights using golden files (expanded)
For each model m:
- Run it across your golden set.
- Compute per-field accuracy:
  - `acc_field(m) = correct_votes / total_votes`
- Compute overall accuracy:
  - `acc_overall(m) = mean(acc_field(m))`

Convert to weights:
- Simple: `w(m) = acc_overall(m) / sum(acc_overall(*))`
- Better: calibrate per-field weights:
  - `w_field(m,f) = acc_field(m,f) / sum_m acc_field(m,f)`

At runtime:
- Use **field-level weighted voting**:
  - choose candidate c with max Σ w_field(m,f) over models that voted for c
- Produce a “committee confidence” per field:
  - winning weight share, e.g. `win_share = winning_weight / total_weight`

Thresholds:
- Auto-create only if:
  - all required fields have `win_share >= 0.75`
  - and deterministic validations pass
  - and customer/item resolution unambiguous

### 5.4 Avoiding over-engineering (explicit)
Start with:
- N=4–6 models
- fixed weights (updated weekly)
- committee only on mapping/flags
- do not add arbitration agents, debate loops, or self-play

Scale complexity only if measured error rate demands it.

---

## 6. Foundry Agent design (v2 view)
Agent becomes more proactive:
- It decides whether the case is in auto-create lane or needs user input, based on committee + validator outputs.
- It uses the same strict JSON patch mechanism for user corrections.

---

## 7. Zoho integration (v2)
Same as v1, plus:
- When Zoho is down: show “Queued for creation” status in tab.
- A “Re-run creation” button for managers (idempotent).

---

## 8. Security/governance (v2 additions)
- Track and audit **external model provider usage**:
  - provider, model, timestamp
  - data categories shared (headers, sample values, etc.)
- Network egress:
  - restrict outbound to allow-listed provider endpoints
  - record egress in logs

---

## 9. Implementation blueprint (v2)
- Build v1 end-to-end first.
- Add committee as a separate microservice with a stable interface.
- Add golden file evaluation pipeline (CI job) to compute weights and regression scores.
- Add hybrid auto-create thresholding and metrics.

---

## 10. Open questions
See `WHAT_WE_NEED_TO_KNOW.md`. v2-specific unknowns:
- Which external providers you actually want to operationalise first (Gemini vs xAI), and any contract/security requirements.
- Whether you want “always include one Azure model” as an anchor for governance.

