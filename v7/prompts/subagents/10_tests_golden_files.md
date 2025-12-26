# Sub-agent: Testing & Golden Files

## Deliverables
- Unit tests for:
  - parsing
  - mapping
  - validation
  - committee aggregation
  - zoho payload generation (mocked)
- Golden file harness:
  - directory of sample xlsx (or stub JSON fixtures if no xlsx allowed)
  - expected canonical JSON outputs
  - evaluation metrics and report
- Weight calibration script for committee:
  - compute per-model accuracy vs golden outputs
  - produce updated weights config

## Logs
Write `_build_logs/.../subagent_tests.md`.
