# Sub-agent: Teams Bot (personal chat intake)

## Deliverables
- Bot Framework v4 bot that:
  - works in personal scope
  - supports file uploads (`supportsFiles` in manifest; code handles attachments)
  - downloads attachment via `downloadUrl` and stores to Blob (via backend API)
  - posts progress updates + adaptive cards
  - handles adaptive card submissions (approve/create, submit corrections)
- Clear separation: bot adapter + message handlers + API client.

## Key behaviours
- Block non-xlsx.
- Create a new case on each upload.
- If formulas detected later, bot asks user to re-export values-only.

## Logs
Write `_build_logs/.../subagent_bot.md`.
