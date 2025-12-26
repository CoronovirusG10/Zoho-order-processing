# Prompt 01 — Repo & Build Audit (READ‑ONLY)

## Goal
Assess whether the repository on this VM is ready to deploy:
- code exists
- dependencies install cleanly
- tests exist and can run
- secrets are not committed
- docs match implementation

## Scope rules
- You may run local commands and create output files **only** under `/data/order-processing/_predeploy_codex/`.
- Do not edit application code or IaC; only inspect.

## Output files to create
- `/data/order-processing/_predeploy_codex/logs/01_REPO_AUDIT.md`
- `/data/order-processing/_predeploy_codex/evidence/repo/tree.txt`
- `/data/order-processing/_predeploy_codex/evidence/repo/git_status.txt` (if git)
- `/data/order-processing/_predeploy_codex/evidence/repo/secret_scan.txt` (redacted)
- `/data/order-processing/_predeploy_codex/evidence/repo/build_probe.txt`
- `/data/order-processing/_predeploy_codex/artefacts/repo_detected_stack.json`

## Steps (produce evidence for each)

1) Identify repo contents
- Run a depth-limited file tree (exclude `_archive`, `_predeploy*`, `node_modules`, `.venv`, etc).
- Record in `tree.txt`.

2) Detect stack(s)
- Check for:
  - Node: `package.json`, `pnpm-lock.yaml`, `yarn.lock`
  - Python: `pyproject.toml`, `requirements.txt`
  - .NET: `*.csproj`, `global.json`
  - IaC: `main.bicep`, `*.tf`, `azure.yaml` (azd), etc.
- Write detected stack details to `repo_detected_stack.json`.

3) Git hygiene
- If git repo exists:
  - `git rev-parse HEAD`
  - `git status --porcelain`
  - `git remote -v`
- Save outputs (sanitise if any URLs contain embedded secrets).

4) Secret scanning (redacted output)
- Search for likely secrets patterns:
  - `client_secret`
  - `refresh_token`
  - `access_token`
  - `Bearer `
  - `AIza` (Google keys)
  - `sk-` (OpenAI-like)
- Use ripgrep if available.
- In `secret_scan.txt`, **never include full secret strings**. Replace with `***REDACTED***` but keep enough context: file path + line number + key name.

5) Ensure sensitive local files are gitignored
- Confirm `zoho_books_tokens*.json` is in `.gitignore` or otherwise excluded.
- Confirm no token files are committed.

6) Build/test probe (do NOT install if it would change the environment unless you can do it read-only)
- If a codebase exists:
  - Show the commands that would build and test (do not necessarily run).
  - If safe and quick, you may run `--version` commands only (node, python, dotnet).
- Save to `build_probe.txt`.

## Reporting
In `01_REPO_AUDIT.md` produce:
- PASS/FAIL/NEEDS-ACTION bullets for:
  - code presence
  - reproducible build defined
  - tests present
  - secret hygiene
  - docs alignment
- Blockers list (anything that stops deployment)
- Concrete next actions (ordered)

Keep the report implementation-grade. Include paths to evidence files.
