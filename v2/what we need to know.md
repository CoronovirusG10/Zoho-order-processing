# What we need to know (v2-specific open questions)

**Last updated:** 2025-12-21

v2 assumes v1 unknowns are resolved. These are additional questions for multi-provider committee + hybrid auto-create.

---

## 1) Provider operations

### 1.1 Which providers/models are “approved” for production committee use?
- Decide the initial pool (N=4–6).
- Capture: contract, cost, data-sharing policy, endpoint allow-list.

### 1.2 Do you want “always include one Azure model” as an anchor?
- **Pros:** governance, consistent behaviour.
- **Cons:** less randomness/independence.

---

## 2) Weight calibration governance

### 2.1 Who approves weight changes?
- Weekly recalibration can shift behaviour. Define an approval workflow:
  - weights computed in CI
  - stored as versioned artefact
  - promoted by an approver (Ops/Tech lead)

### 2.2 What is the golden file coverage target?
- Minimum: top 10 customer formats, plus 10 “nasty” edge cases.
- Include Farsi samples explicitly.

---

## 3) Auto-create risk tolerance

### 3.1 What is the acceptable false-positive rate for auto-created drafts?
- Even drafts consume time and can confuse downstream.
- Define thresholds and monitor.

### 3.2 When auto-create triggers, do you still want an “undo” workflow?
- Zoho may not support delete; you may need “void/cancel” or tagging.

