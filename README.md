# Order Processing System

**Teams Bot → Excel Parser → AI Committee Validation → Zoho Books Draft**

An intelligent order intake automation system that enables salespeople to upload Excel spreadsheets via Microsoft Teams, automatically processes and validates the data using a multi-model AI committee, and creates Draft Sales Orders in Zoho Books.

**Last updated:** 2025-12-26

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Services](#services)
- [Data Model](#data-model)
- [Infrastructure](#infrastructure)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Open Questions](#open-questions)
- [Reference Documentation](#reference-documentation)

---

## Overview

### The Problem

Salespeople receive customer orders as Excel spreadsheets with highly variable formats:
- Different column layouts and naming conventions
- Multilingual headers (English and Farsi/Persian)
- Manual data entry into Zoho Books is time-consuming and error-prone
- No standardized template means each order requires interpretation

### The Solution

This system automates order processing with:

1. **Teams Bot Integration** - Salespeople upload `.xlsx` files to a 1:1 Teams chat
2. **Intelligent Parsing** - Deterministic extraction with evidence tracking for every value
3. **AI Committee Validation** - Multi-model consensus on schema mapping decisions
4. **Human-in-the-Loop** - Interactive corrections via Adaptive Cards for ambiguous cases
5. **Zoho Integration** - Automatic Draft Sales Order creation with idempotency
6. **Full Auditability** - 5+ year retention in Azure Blob Storage

### Two Implementation Plans

| Version | Approach | Automation Level |
|---------|----------|------------------|
| **v1** | Deterministic-led, review-first | Human approves all orders |
| **v2** | Multi-provider AI committee | Auto-create when confidence is high |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Microsoft Teams                                │
│  ┌──────────────┐                              ┌──────────────────────┐ │
│  │  Teams Bot   │◄────── File Upload ──────────│   Salesperson        │ │
│  │  (1:1 Chat)  │──── Adaptive Cards ─────────►│                      │ │
│  └──────┬───────┘                              └──────────────────────┘ │
│         │                                                                │
│  ┌──────┴───────┐                                                        │
│  │  Teams Tab   │ ← Role-based case views (SalesUser/SalesManager)       │
│  └──────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Azure Services (Sweden Central)                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Workflow Orchestrator                            │ │
│  │                  (Azure Durable Functions)                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│         │              │              │              │                   │
│         ▼              ▼              ▼              ▼                   │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐             │
│  │  Parser  │   │Committee │   │   Zoho   │   │   API    │             │
│  │ (ExcelJS)│   │(3-Model  │   │ (Books   │   │ (Cases)  │             │
│  │          │   │ Voting)  │   │  OAuth)  │   │          │             │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘             │
│                                      │                                   │
│  ┌──────────────┐  ┌──────────────┐ │ ┌──────────────┐                  │
│  │ Blob Storage │  │  Cosmos DB   │ │ │  Key Vault   │                  │
│  │ (5yr audit)  │  │ (cases/logs) │ │ │  (secrets)   │                  │
│  └──────────────┘  └──────────────┘ │ └──────────────┘                  │
└─────────────────────────────────────│───────────────────────────────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │   Zoho Books     │
                             │   (EU DC)        │
                             └──────────────────┘
```

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Deterministic Core** | Parser produces facts with evidence; LLMs never see raw workbook |
| **Constrained AI** | Models only choose among pre-computed candidates |
| **Evidence-Based** | Every extracted value traces to a specific cell reference |
| **Zoho Pricing Prevails** | Spreadsheet prices are informational only |
| **Formula Blocking** | Files with formulas are rejected; user must export values-only |
| **Idempotency** | Fingerprint-based duplicate detection prevents double-creation |

---

## Key Features

### Excel Parsing
- **Variable Layout Support** - Handles diverse spreadsheet structures
- **Multilingual Headers** - English and Farsi (Persian) with synonym dictionaries
- **Formula Detection** - Blocks files with formulas (user must export values-only)
- **Multi-Sheet Workbooks** - Automatically selects best candidate sheet
- **Evidence Tracking** - Every value includes sheet name, cell reference, and raw value

### AI Committee Validation
- **Multi-Provider Pool** - GPT-5.x, Claude 4.x, DeepSeek V3.x, Gemini, Grok
- **Random Selection** - 3 providers selected per task for diversity
- **Weighted Voting** - Aggregates votes with confidence scoring
- **Consensus Detection** - Unanimous, majority, split, or no-consensus
- **Bounded Tasks** - Models validate mappings, never generate data

### Teams Integration
- **1:1 Chat Bot** - Personal bot for file uploads
- **Adaptive Cards** - Interactive issue resolution and approval
- **Personal Tab** - Role-based case views (My Cases / All Cases)
- **Cross-Tenant** - App in Tenant A, users in Tenant B

### Zoho Books Integration
- **Customer Matching** - Exact and fuzzy matching with candidates
- **Item Resolution** - SKU → GTIN → fuzzy name priority
- **Draft Orders Only** - Never creates customers or items
- **OAuth Refresh** - Automatic token management via Key Vault
- **Retry Queue** - Handles Zoho unavailability gracefully

---

## Project Structure

```
order-processing/
├── app/                          # Main application
│   ├── packages/                 # Shared packages
│   │   ├── types/               # TypeScript types & JSON schemas
│   │   └── shared/              # Utilities (logging, errors, crypto)
│   ├── services/                # Microservices
│   │   ├── api/                 # REST API (Express)
│   │   ├── teams-bot/           # Teams Bot (Bot Framework v4)
│   │   ├── teams-tab/           # Teams Tab UI (React + Vite)
│   │   ├── parser/              # Excel Parser (ExcelJS)
│   │   ├── committee/           # AI Committee Engine
│   │   ├── zoho/                # Zoho Books Integration
│   │   ├── workflow/            # Orchestrator (Durable Functions)
│   │   ├── storage/             # Blob/Cosmos operations
│   │   └── agent/               # Azure AI Foundry integration
│   ├── infra/                   # Bicep IaC templates
│   └── tests/                   # Test suites
├── v7/                          # Design prompts & specs
│   ├── prompts/                 # Build prompts for subagents
│   │   └── subagents/           # 10 specialized subagent prompts
│   └── specs/                   # OpenAPI, JSON schemas, Adaptive Cards
├── docs/                        # Documentation
├── SOLUTION_DESIGN.md           # Full architecture design
├── MVP_AND_HOWTO.md             # Build and pilot plan
├── WHAT_WE_NEED_TO_KNOW.md      # Discovery checklist
├── CROSS_TENANT_TEAMS_DEPLOYMENT.md  # Cross-tenant setup guide
└── MODEL_ACCESS_REPORT_*.md     # Azure AI model inventory
```

---

## Services

### REST API (`services/api/`)

Central gateway for case management and webhook handling.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cases` | GET | List cases with filters |
| `/api/cases/:id` | GET | Get case details |
| `/api/cases/:id/audit` | GET | Get audit trail |
| `/api/bot/file-uploaded` | POST | Handle file upload from bot |
| `/api/bot/approval` | POST | Handle approval decisions |
| `/tools/parse-excel` | POST | Trigger Excel parsing |
| `/tools/committee-review` | POST | Trigger committee validation |
| `/tools/zoho/create-draft-salesorder` | POST | Create Zoho draft |

**Roles:** `SalesUser`, `SalesManager`, `OpsAuditor`

### Teams Bot (`services/teams-bot/`)

Bot Framework v4 implementation for Teams integration.

- **File Upload** - Handles `.xlsx` attachments with language detection
- **Adaptive Cards** - Processing status, issue resolution, order review
- **Proactive Messaging** - Status updates pushed to user's chat

### Teams Tab (`services/teams-tab/`)

React-based personal tab with role-based views.

| Role | View |
|------|------|
| SalesUser | My Cases (own uploads) |
| SalesManager | All Cases (team view) |
| OpsAuditor | Read-only audit access |

### Parser (`services/parser/`)

Deterministic Excel parsing with evidence tracking.

**Pipeline:**
1. Formula Detection → Block or warn
2. Sheet Selection → Score and rank worksheets
3. Header Detection → Pattern scoring for header row
4. Schema Inference → Map headers to canonical fields
5. Row Extraction → Extract data with merged cell handling
6. Normalization → SKU, GTIN, currency, language
7. Validation → Arithmetic checks

### Committee (`services/committee/`)

Multi-provider AI committee for mapping validation.

**Configuration:**
```typescript
{
  providerCount: 3,
  providerPool: ['azure-gpt-5.1', 'azure-claude-opus-4.5',
                 'azure-deepseek-v3.2', 'gemini-2.5-pro', 'xai-grok-4'],
  consensusThreshold: 0.66,
  confidenceThreshold: 0.75,
  timeoutMs: 30000
}
```

### Zoho Integration (`services/zoho/`)

Full Zoho Books API integration.

- **OAuth Management** - Token refresh from Key Vault
- **Customer Matching** - Exact + fuzzy with candidate ranking
- **Item Matching** - SKU → GTIN → name priority
- **Idempotency** - Fingerprint store prevents duplicates
- **Caching** - Items/customers cached with hourly refresh
- **Retry Queue** - Persistent retry for transient failures

### Workflow (`services/workflow/`)

Azure Durable Functions orchestrator.

**Flow:**
```
StoreFile → ParseExcel → RunCommittee → ResolveCustomer →
ResolveItems → AwaitApproval → CreateZohoDraft → NotifyUser
```

**External Events (Human-in-Loop):**
- `FileReuploaded` - User uploads corrected file
- `CorrectionsSubmitted` - User provides corrections
- `SelectionsSubmitted` - User selects customer/items
- `ApprovalReceived` - User approves/rejects order

---

## Data Model

### Canonical Sales Order

```typescript
CanonicalSalesOrder {
  meta: {
    case_id, tenant_id, received_at, source_filename, file_sha256,
    uploader: { aad_user_id, teams_user_id, display_name },
    language_hint: "en" | "fa",
    parsing: { parser_version, contains_formulas, sheets_processed },
    correlation: { trace_id, span_id, teams_activity_id }
  },
  customer: {
    input_name, resolution_status, zoho_customer_id, zoho_customer_name,
    match: { method, confidence, candidates },
    evidence: [{ sheet, cell, raw_value }]
  },
  line_items: [{
    row, sku, gtin, product_name, quantity,
    unit_price_source, unit_price_zoho,  // Zoho pricing prevails
    zoho_item_id, match: { status, method, confidence },
    evidence: { sku: {...}, quantity: {...}, ... }
  }],
  totals: { subtotal_source, tax_total_source, total_source, evidence },
  schema_inference: { selected_sheet, header_row, column_mappings },
  confidence: { overall, by_stage, committee: { providers_used, votes, consensus } },
  issues: [{ code, severity, message, suggested_user_action }],
  approvals: { approved, approved_at, approved_by, approval_method },
  zoho: { organisation_id, salesorder_id, salesorder_number, status }
}
```

### Issue Codes

| Code | Severity | Description |
|------|----------|-------------|
| `FORMULAS_BLOCKED` | blocker | File contains formulas |
| `MISSING_CUSTOMER` | error | No customer name found |
| `AMBIGUOUS_CUSTOMER` | warning | Multiple customer matches |
| `CUSTOMER_NOT_FOUND` | error | Customer not in Zoho |
| `MISSING_ITEM` | error | Line item has no SKU/GTIN |
| `AMBIGUOUS_ITEM` | warning | Multiple item matches |
| `ITEM_NOT_FOUND` | error | Item not in Zoho catalog |
| `ARITHMETIC_MISMATCH` | warning | qty × price ≠ total |
| `LOW_CONFIDENCE` | warning | Schema mapping confidence < threshold |
| `COMMITTEE_DISAGREEMENT` | warning | No consensus on mapping |

---

## Infrastructure

### Azure Resources (Sweden Central)

| Resource | Purpose |
|----------|---------|
| **Azure Bot Service** | Teams channel integration |
| **Static Web App** | Teams Tab UI |
| **Azure Functions (3)** | Workflow, Parser, Zoho integration |
| **Container Apps** | Bot runtime (prod only) |
| **Cosmos DB** | Cases, fingerprints, events, cache |
| **Azure Storage** | Blobs (audit), queues |
| **Key Vault** | Secrets (RBAC-enabled) |
| **Application Insights** | Distributed tracing |
| **Azure AI Foundry** | Hub + Project for AI committee |

### Cosmos DB Containers

| Container | Purpose |
|-----------|---------|
| `cases` | Case state and metadata |
| `fingerprints` | Order fingerprints for idempotency |
| `events` | Append-only audit events |
| `agentThreads` | AI Foundry conversation threads |
| `committeeVotes` | Committee voting records |
| `cache` | Zoho customer/item cache |

### Blob Containers

| Container | Purpose | Retention |
|-----------|---------|-----------|
| `orders-incoming` | Uploaded Excel files | 5 years |
| `orders-audit` | Immutable audit trail | 5 years |
| `committee-evidence` | Raw AI outputs | 5 years |
| `logs-archive` | Archived logs | 5 years |

---

## Configuration

### Environment Variables

```bash
# Azure Bot
MICROSOFT_APP_ID=
MICROSOFT_APP_PASSWORD=
MICROSOFT_APP_TYPE=MultiTenant

# Azure AI Foundry
AZURE_FOUNDRY_ENDPOINT=
AZURE_FOUNDRY_PROJECT_NAME=
AZURE_FOUNDRY_AGENT_NAME=

# Zoho Books
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORGANIZATION_ID=
ZOHO_DC=eu

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER_INCOMING=orders-incoming
AZURE_STORAGE_CONTAINER_AUDIT=orders-audit

# Cosmos DB
COSMOS_ENDPOINT=
COSMOS_KEY=
COSMOS_DATABASE=order-processing

# Monitoring
APPLICATIONINSIGHTS_CONNECTION_STRING=

# External AI Providers
GEMINI_API_KEY=
XAI_API_KEY=

# Feature Flags
ENABLE_FORMULA_BLOCKING=true
ENABLE_COMMITTEE=true
COMMITTEE_PROVIDER_COUNT=3
```

### Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_COMMITTEE` | true | AI committee for field mapping |
| `BLOCK_FORMULAS` | true | Block Excel files with formulas |
| `AUTO_RESOLVE_CUSTOMER` | false | Auto-resolve high-confidence customers |
| `AUTO_RESOLVE_ITEMS` | false | Auto-resolve high-confidence items |
| `ENABLE_ZOHO_CACHE` | true | Cache Zoho master data |
| `STRICT_GTIN_VALIDATION` | true | Validate GTIN check digits |
| `ENABLE_MULTILINGUAL` | true | English + Farsi support |
| `ALLOW_ZERO_QUANTITY` | true | Allow quantity = 0 |

---

## Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm or npm
- Azure CLI
- Teams App Studio or Teams Toolkit

### Setup

```bash
cd app
npm install
cp .env.example .env
# Edit .env with your values

# Run services in dev mode
npm run dev:bot    # Teams bot
npm run dev:api    # REST API
npm run dev:tab    # Teams tab UI
```

### Commands

```bash
npm run build      # Build all workspaces
npm run test       # Run all tests
npm run typecheck  # TypeScript compilation
npm run lint       # ESLint
```

---

## Deployment

### First-Time Deployment (35-55 minutes)

```bash
# Login to Azure
az login

# Deploy infrastructure
az deployment sub create \
  --location swedencentral \
  --template-file app/infra/main.bicep \
  --parameters @app/infra/main.parameters.dev.json

# Setup secrets
./scripts/setup-secrets.sh

# Deploy application code
./scripts/deploy.sh

# Validate deployment
./scripts/validate.sh
```

### Cross-Tenant Setup

When Azure workload is in Tenant A and Teams users are in Tenant B:

1. **Tenant A (Hosting)**
   - Create multi-tenant app registrations (Bot + Tab/API)
   - Deploy Azure resources
   - Configure Azure Bot with Teams channel

2. **Tenant B (Consumer)**
   - Teams admin uploads custom app package
   - Configure app permission policies
   - Grant Entra consent for Tab/API app
   - Assign app roles to users

See [CROSS_TENANT_TEAMS_DEPLOYMENT.md](CROSS_TENANT_TEAMS_DEPLOYMENT.md) for detailed instructions.

---

## Open Questions

### High Priority (Blocking)

| Category | Question |
|----------|----------|
| **Cross-Tenant** | Does Teams file `downloadUrl` work cross-tenant without Graph permissions? |
| **Cross-Tenant** | What Teams admin policies are required in Tenant B? |
| **Zoho** | What is the Sandbox organisation_id? Is there a separate prod org? |
| **Zoho** | What is the exact API name/field ID for the `external_order_key` custom field? |

### Medium Priority

| Category | Question |
|----------|----------|
| **Excel** | Need 30-50 representative spreadsheets covering all variations |
| **Excel** | Policy for multiple orders in one workbook? (Block vs attempt split) |
| **Committee** | Which external providers are approved for production? |
| **Committee** | Weight update cadence and sign-off process? |
| **Access Control** | How is "manager" defined? (App role, Entra group, custom claim?) |
| **Audit** | Confirm 5+ year retention and WORM policy requirements |

---

## Reference Documentation

### Key Documents

| Document | Description |
|----------|-------------|
| [SOLUTION_DESIGN.md](SOLUTION_DESIGN.md) | Full architecture and detailed design |
| [MVP_AND_HOWTO.md](MVP_AND_HOWTO.md) | Step-by-step build and pilot plan |
| [WHAT_WE_NEED_TO_KNOW.md](WHAT_WE_NEED_TO_KNOW.md) | Discovery checklist and open questions |
| [CROSS_TENANT_TEAMS_DEPLOYMENT.md](CROSS_TENANT_TEAMS_DEPLOYMENT.md) | Cross-tenant deployment guide |
| [MODEL_ACCESS_REPORT_2025-12-20.md](MODEL_ACCESS_REPORT_2025-12-20.md) | Azure AI model inventory |

### V7 Subagent Prompts

| Prompt | Purpose |
|--------|---------|
| [01_repo_architecture.md](v7/prompts/subagents/01_repo_architecture.md) | Monorepo scaffolding |
| [02_teams_bot.md](v7/prompts/subagents/02_teams_bot.md) | Teams bot implementation |
| [03_teams_tab_ui.md](v7/prompts/subagents/03_teams_tab_ui.md) | React Teams tab |
| [04_excel_parser.md](v7/prompts/subagents/04_excel_parser.md) | Deterministic Excel parser |
| [05_committee_engine.md](v7/prompts/subagents/05_committee_engine.md) | Multi-model committee |
| [06_foundry_agent_integration.md](v7/prompts/subagents/06_foundry_agent_integration.md) | Azure AI Foundry |
| [07_zoho_integration.md](v7/prompts/subagents/07_zoho_integration.md) | Zoho Books API |
| [08_audit_storage.md](v7/prompts/subagents/08_audit_storage.md) | Audit and storage |
| [09_iac_bicep.md](v7/prompts/subagents/09_iac_bicep.md) | Bicep infrastructure |
| [10_tests_golden_files.md](v7/prompts/subagents/10_tests_golden_files.md) | Testing infrastructure |

### External References

- [Teams File Upload Bot Sample](https://learn.microsoft.com/en-us/samples/officedev/microsoft-teams-samples/)
- [Azure AI Foundry Samples](https://github.com/Azure-Samples/azureai-samples)
- [Teams App Publishing Guide](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/apps-publish-overview)
- [Zoho Books API Documentation](https://www.zoho.com/books/api/v3/)

---

## Constraints

- **Hosting:** Azure Sweden Central (external LLM calls allowed for committee)
- **Quantity = 0:** Valid and must not warn
- **Formulas:** Blocked; user must upload values-only export
- **Pricing:** Zoho pricing prevails; spreadsheet prices are informational
- **Audit:** All artifacts retained ≥ 5 years in Azure Blob Storage
- **Scale:** Designed for 100-200 orders/day

---

## License

Proprietary. Internal use only.
