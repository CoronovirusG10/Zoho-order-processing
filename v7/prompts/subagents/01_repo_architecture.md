# Sub-agent: Repo scaffold & architecture

## Deliverables
- Create monorepo scaffold under `/data/order-processing/app/`:
  - workspace config (pnpm or npm workspaces)
  - TypeScript config(s)
  - eslint/prettier
  - test runner (vitest or jest)
  - CI config (GitHub Actions skeleton) — no secrets
- Define shared packages:
  - `packages/schemas` (JSON schemas)
  - `packages/core` (types, validation utilities)
- Add `_build_logs/YYYY-MM-DD/subagent_repo.md` with decisions and file tree.

## Constraints
- Do not implement business logic; just scaffold.
- Ensure `zoho_books_tokens*` is gitignored.
