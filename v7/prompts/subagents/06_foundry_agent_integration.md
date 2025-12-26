# Sub-agent: Azure AI Foundry Agent Service integration

## Deliverables
- Agent wrapper module:
  - create or attach to agent instance
  - create per-case thread
  - run agent with tool calling enabled
  - integrate tracing (OpenTelemetry / Application Insights)
- Tool calling:
  - Use internal OpenAPI tool spec to call:
    - parse-excel
    - committee-review
    - zoho-create-draft
  - Ensure tool results are persisted as artefacts.

## Behaviour
- Agent should only:
  - ask user questions
  - summarise issues
  - request approval
  - call tools
- Agent must be constrained to strict JSON outputs where applicable.

## Logs
Write `_build_logs/.../subagent_foundry.md`.
