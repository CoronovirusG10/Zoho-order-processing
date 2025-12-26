# Subagent Context (Compressed) — 2025-12-25

**READ THIS FIRST. Do NOT re-read all the docs in /data/order-processing/*.md unless needed.**

## Project Summary
Build a production-ready **Teams 1:1 bot + personal tab** that:
1. Receives Excel uploads (1 file = 1 order)
2. Uses **deterministic-led extraction** (minimal LLM freedom)
3. Runs a **3-model committee** for cross-checking mappings
4. Creates **Draft Sales Orders** in Zoho Books (never creates customers/items)
5. Stores everything in Azure Blob for **5+ years** audit

## Non-Negotiable Requirements
- **Cross-tenant**: Azure in Tenant A, Teams users in Tenant B
- **Formula blocking**: If formulas exist, BLOCK file (configurable)
- **Zoho pricing prevails**: Spreadsheet prices are audit-only
- **Qty=0 is valid**: No warnings for zero quantity
- **Human-in-the-loop**: Issues must be surfaced to user for correction
- **Evidence-based**: Every extracted value has cell reference proof
- **Correlation IDs**: End-to-end tracing from Teams→Zoho

## Architecture
- **Monorepo**: `/data/order-processing/app/`
- **Teams Bot**: Bot Framework SDK v4 (Node/TypeScript)
- **Teams Tab**: React + Teams JS SDK
- **Backend API**: Node/TypeScript
- **Workflow**: Durable Functions (preferred)
- **Storage**: Blob (audit), Cosmos (state)
- **AI**: Azure AI Foundry Agent Service + Committee engine
- **Region**: Sweden Central

## Committee Design (3-provider)
- Select 3 distinct models from pool: GPT-5.1, Claude Opus 4.5, DeepSeek V3.2, Grok-4-fast, Gemini 2.5
- Each returns strict JSON: mapping decisions, confidence, evidence refs
- Aggregation: weighted voting, disagreement → user choice
- Weight calibration via golden files

## Zoho Integration
- OAuth refresh stored in Key Vault
- Draft SO only via POST /salesorders
- Idempotency via fingerprint in Cosmos
- SKU-first matching, GTIN fallback, fuzzy + user selection

## What Exists Already
- `/data/order-processing/app/` has 230+ files with partial implementation
- Types, tests, shared packages, parser skeleton, committee skeleton
- Check existing code before creating new files

## Security Rules
- NEVER log secrets (Zoho tokens, API keys)
- Add `.gitignore` entries for sensitive files
- All model outputs stored as blob artefacts (not console logs)

## Your Task Pattern
1. Read this context
2. Check existing implementation in your assigned area
3. Implement/complete your component
4. Write a summary to `_build_logs/2025-12-25/YOUR_AGENT_NAME.md`
5. Ensure code compiles (tsc --noEmit or equivalent)
