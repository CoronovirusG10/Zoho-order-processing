# 06 — Personal Tab Readiness (My cases + Manager view)

You are Codex running on the VM. Work in `/data/order-processing`.

## Goal
Verify the personal tab code/build/deploy path is ready for:
- My cases (user scope)
- Manager view (wider scope via role/claim)

## Output requirements
Write outputs to: `/data/order-processing/_codex_predeploy/${OP_RUN_ID}/`
- `06_TAB_READINESS_REPORT.md`
- `06_TAB_READINESS_COMMANDS.log`

Then print a **Paste‑Back Report** block (<=120 lines).

If `OP_RUN_ID` is not set, set it.

## Rules
- Do not print secrets.
- Do not attempt tenant app registration here; just readiness and what’s needed.

## Steps
1) Setup logging helper.
2) Locate tab project:
   - search for React/Teams Toolkit artefacts:
     - `find . -maxdepth 6 -type f \( -name 'package.json' -o -name 'teamsapp.yml' -o -name 'vite.config.*' -o -name 'webpack.config.*' \) | sort`
   - identify how tab is served (nginx static? workflow-api route?)
3) Build readiness:
   - list build scripts
   - if safe, run a local build (no secrets) and record output
4) Runtime routing:
   - verify nginx has a route for the tab (or document what to add)
   - verify tab contentUrl expected by manifest matches real route
5) Access control model:
   - confirm code supports “my cases” vs “manager” role gating (even if not wired yet)
6) Write report + paste-back summary.
