# Sub-agent: Audit, Storage, and Event Log

## Deliverables
- Blob layout spec + helper library:
  - case folder structure
  - artefact pointers
- Append-only JSONL event log writer:
  - per case
  - monotonic sequence numbers
- Redaction policy:
  - secrets never written
  - optional PII redaction (config)
- Retention guidance (≥5 years) in docs.

## Logs
Write `_build_logs/.../subagent_audit.md`.
