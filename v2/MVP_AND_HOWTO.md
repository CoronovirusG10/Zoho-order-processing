# MVP and how-to (v2 committee + hybrid automation)

**Last updated:** 2025-12-21

v2 assumes v1 is working end-to-end and focuses on adding multi-provider robustness and faster throughput.

---

## v2 increments

### 1) Committee service
- Define a stable interface: `POST /committee/map` with bounded evidence pack.
- Implement adapters for:
  - Azure Foundry model deployments
  - Gemini API (direct)
  - xAI API (direct)
- Store provider/model used per case for audit.

### 2) Weight calibration pipeline (golden files)
- Build CI job:
  - run committee models on golden set
  - compute per-field accuracies and weights
  - write weights to versioned blob (`committee/weights/<date>.json`)
- Runtime loads the latest approved weights.

### 3) Hybrid auto-create thresholds
- Auto-create only if:
  - deterministic validations pass
  - customer + all items resolved unambiguously
  - committee win_share ≥ threshold for all required fields
- Otherwise: user correction loop

### 4) Disagreement UX
- Add a standard Adaptive Card for disagreement with:
  - evidence preview
  - forced user selection

---

## v2 build order

1. Add committee wrapper and run it in “report-only” mode (no behaviour change).
2. Add disagreement metrics to the personal tab.
3. Add weight calibration pipeline.
4. Turn on hybrid auto-create for a small subset of customers/templates.
5. Expand gradually.

