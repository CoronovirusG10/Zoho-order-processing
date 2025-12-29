Read-only Foundry readiness check.

Use local files if present:
- MODEL_ACCESS_REPORT_2025-12-20.md
- azure-ai-foundry-model-catalog-2025-12-25.md

Tasks:
- Identify which models are deployed that support:
  - orchestrator agent
  - committee fixed trio
  - embeddings (Farsi)
  - OCR/doc extraction
  - speech-to-text
- Identify whether Foundry Workflows / Capability Hosts / Hosted Agents are referenced in SOLUTION_DESIGN.
- If az CLI/SDK tools exist in the repo to list Foundry resources, run them read-only.

Output: whether the planned model set is available and any mismatches.
