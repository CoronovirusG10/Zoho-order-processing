# Sub-agent: Committee Engine (3-provider)

## Deliverables
- Provider abstraction:
  - Azure AI Foundry deployments (chat completion)
  - External providers (Gemini/xAI direct) as optional plugins
- Committee runner:
  - selects 3 providers (random from pool)
  - runs in parallel
  - validates each output against JSON Schema
  - aggregates by weighted vote
  - returns consensus + disagreements

## Outputs
- Must never allow a model to invent fields.
- Must store raw outputs as artefacts (blob pointer); only return redacted summaries to logs.

## Logs
Write `_build_logs/.../subagent_committee.md`.
