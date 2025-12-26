# Order Processing Application Documentation

## Overview

The Order Processing Application is a Teams-integrated system that enables salespeople to upload Excel order files via Microsoft Teams, validates and processes them using AI-assisted extraction with a 3-model committee cross-check, and creates Draft Sales Orders in Zoho Books.

### Key Features

- **Teams Integration**: 1:1 bot interface for file uploads and personal tab for case management
- **Deterministic-Led Extraction**: Minimal LLM freedom with evidence-based parsing
- **3-Model Committee**: Cross-checking mappings for reduced errors
- **Human-in-the-Loop**: Issues surfaced to users for correction before order creation
- **Zoho Books Integration**: Draft sales orders with Zoho pricing prevailing
- **5+ Year Audit Trail**: Complete evidence storage in Azure Blob

### Non-Negotiable Requirements

| Requirement | Description |
|-------------|-------------|
| Cross-Tenant | Azure workload in Tenant A, Teams users in Tenant B |
| Formula Blocking | Block files containing formulas (configurable) |
| Zoho Pricing | Spreadsheet prices are audit-only; Zoho rates used |
| Qty=0 Valid | Zero quantity is valid, no warnings |
| Human-in-the-Loop | All issues surfaced for user correction |
| Evidence-Based | Every extracted value has cell reference proof |
| Correlation IDs | End-to-end tracing from Teams to Zoho |

## Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                              TENANT B (Teams Users)                                |
|  +---------------+    +---------------+                                            |
|  |  Salesperson  |    |   Manager     |                                            |
|  |  (Teams)      |    |  (Teams)      |                                            |
|  +-------+-------+    +-------+-------+                                            |
|          | Upload .xlsx       | View cases                                         |
+----------|--------------------|----------------------------------------------------|
           |                    |
           v                    v
+-----------------------------------------------------------------------------------+
|                         TENANT A (Azure - Sweden Central)                          |
|                                                                                    |
|  +--------------------------------------------------------------------------------+|
|  |                         Azure Bot Service                                      ||
|  |  +-------------+    +---------------+    +---------------+                     ||
|  |  | Teams Bot   |--->| File Handler  |--->| Card Builder  |                     ||
|  |  +-------------+    +-------+-------+    +---------------+                     ||
|  +-----------------------------|--------------------------------------------------+|
|                                |                                                   |
|                                v                                                   |
|  +--------------------------------------------------------------------------------+|
|  |                      Azure Durable Functions (Workflow)                        ||
|  |  +----------+   +------------+   +-------------+   +------------+              ||
|  |  | Parse    |-->| Committee  |-->|  Resolve    |-->|  Create    |              ||
|  |  | Excel    |   |  Review    |   |  Entities   |   |  Draft     |              ||
|  |  +----------+   +------------+   +-------------+   +------------+              ||
|  +-----------------------------|--------------------------------------------------+|
|                                |                                                   |
|         +--------------+-------+-------+--------------+                            |
|         v              v               v              v                            |
|  +------------+  +--------------+  +----------+  +----------+                      |
|  |   Parser   |  |  Committee   |  |  Zoho    |  |   API    |                      |
|  |   Service  |  |   Engine     |  |  Service |  |  Service |                      |
|  | (ExcelJS)  |  | (3 providers)|  | (OAuth)  |  |  (REST)  |                      |
|  +------------+  +------+-------+  +----+-----+  +----------+                      |
|                         |               |                                          |
|                         v               v                                          |
|           +---------------------+  +-----------+                                   |
|           |  Azure AI Foundry   |  | Zoho Books|                                   |
|           |  - GPT-5.x          |  | (EU DC)   |                                   |
|           |  - Claude 4.x       |  +-----------+                                   |
|           |  - DeepSeek V3.x    |                                                  |
|           |  - Gemini 2.5       |                                                  |
|           |  - Grok-4           |                                                  |
|           +---------------------+                                                  |
|                                                                                    |
|  +--------------------------------------------------------------------------------+|
|  |                           Storage Layer                                        ||
|  |  +---------------+   +---------------+   +---------------+                     ||
|  |  | Blob Storage  |   |  Cosmos DB    |   |  Key Vault    |                     ||
|  |  | (5y audit)    |   |  (cases)      |   |  (secrets)    |                     ||
|  |  +---------------+   +---------------+   +---------------+                     ||
|  +--------------------------------------------------------------------------------+|
|                                                                                    |
|  +--------------------------------------------------------------------------------+|
|  |                           Observability                                        ||
|  |  +-------------------+   +---------------------+                               ||
|  |  | App Insights      |   | Log Analytics       |                               ||
|  |  | (traces/metrics)  |   | (2y query/5y arch)  |                               ||
|  |  +-------------------+   +---------------------+                               ||
|  +--------------------------------------------------------------------------------+|
+-----------------------------------------------------------------------------------+
```

## Services

| Service | Location | Purpose |
|---------|----------|---------|
| **teams-bot** | `/services/teams-bot/` | Teams 1:1 bot for file uploads and interactions |
| **teams-tab** | `/services/teams-tab/` | React personal tab for case management |
| **parser** | `/services/parser/` | Deterministic Excel parsing with evidence tracking |
| **committee** | `/services/committee/` | 3-model AI committee for mapping validation |
| **workflow** | `/services/workflow/` | Azure Durable Functions orchestrator |
| **zoho** | `/services/zoho/` | Zoho Books API integration (OAuth, matching, drafts) |
| **api** | `/services/api/` | REST API for tab and internal tools |
| **storage** | `/services/storage/` | Azure Blob audit service |
| **agent** | `/services/agent/` | Azure AI Foundry Agent Service integration |

## Documentation Structure

### Setup Guides

- [Development Setup](setup/development.md) - Local development environment configuration
- [Azure Deployment](setup/azure-deployment.md) - Production deployment guide
- [Cross-Tenant Configuration](setup/cross-tenant.md) - Teams multi-tenant setup

### Architecture Documentation

- [System Overview](architecture/overview.md) - High-level architecture
- [Data Flow](architecture/data-flow.md) - Request/response flows with Mermaid diagrams
- [Security Model](architecture/security.md) - Authentication, authorization, secrets

### Operational Runbooks

- [Zoho Outage](runbooks/zoho-outage.md) - Handling Zoho API unavailability
- [Model Change](runbooks/model-change.md) - Updating AI model deployments
- [New Template](runbooks/new-template.md) - Adding new spreadsheet formats
- [Troubleshooting](runbooks/troubleshooting.md) - Common issues, error codes, and solutions

### Quick Links

- [API Reference](../services/api/README.md)
- [Test Guide](../tests/README.md)
- [Infrastructure as Code](../infra/README.md)
- [Changelog](../CHANGELOG.md)

## Key Concepts

### Case Lifecycle

```
  +----------+     +----------+     +-------------+     +---------+
  | Pending  |---->| Parsing  |---->| Needs Input |---->| Ready   |
  +----------+     +----------+     +-------------+     +----+----+
       |                |                  |                 |
       |                v                  v                 v
       |           +--------+         +---------+      +----------+
       +---------->| Failed |<--------| Blocked |      | Creating |
                   +--------+         +---------+      +----+-----+
                                                            |
                                                            v
                                                      +---------+
                                                      | Created |
                                                      +---------+
```

| Status | Description |
|--------|-------------|
| `pending` | File received, awaiting processing |
| `parsing` | Excel being analyzed |
| `blocked` | Processing blocked (formulas, protected sheet) |
| `needs_input` | User corrections required |
| `ready` | Awaiting user approval |
| `creating` | Creating Zoho draft |
| `created` | Successfully created in Zoho |
| `failed` | Processing failed |

### Committee System

Three AI providers review schema mappings to reduce single-model errors:

- **Provider Selection**: 3 providers randomly selected from pool
- **Weighted Voting**: Votes weighted by calibrated accuracy
- **Consensus Types**: Unanimous, Majority, Split, No Consensus
- **Disagreements**: Flagged for human resolution
- **Calibration**: Golden files used to calibrate weights

### Audit Trail

All interactions are logged to Azure Blob Storage with 5+ year retention:

- **Original Files**: Retained with immutable storage policy
- **Audit Events**: Sequence-numbered events per case
- **Evidence Pack**: Cell references for all extracted values
- **Committee Outputs**: Individual model responses and aggregated votes
- **API Logs**: All Zoho API requests/responses

### Correlation IDs

Every request carries correlation context for end-to-end tracing:

```typescript
{
  trace_id: string;      // End-to-end trace
  span_id: string;       // Current operation
  case_id: string;       // Business correlation
  teams_activity_id?: string;
  foundry_run_id?: string;
}
```

Propagation methods:
- HTTP headers: `x-correlation-id`, `x-trace-id`
- Service Bus: message properties
- Cosmos DB: document fields
- Logs: structured fields

## Infrastructure

### Azure Resources (Sweden Central)

| Resource | Purpose |
|----------|---------|
| Storage Account | Blob storage for files, audit trails, logs |
| Cosmos DB | NoSQL for cases, fingerprints, events |
| Key Vault | Secrets management (OAuth tokens, API keys) |
| Function Apps | Workflow, parser, Zoho integration |
| Static Web App | Teams personal tab (React) |
| Bot Service | Teams bot registration |
| App Insights | Application monitoring |
| Log Analytics | Centralized logging (730-day retention) |

### Data Retention

| Data Type | Hot | Cool | Archive | Total |
|-----------|-----|------|---------|-------|
| Orders & Audit | 30d | 365d | 4+ years | 5+ years |
| Logs | 90d | 640d | - | 730 days |
| Agent Threads | 30d (TTL) | - | - | 30 days |

## Security

### Authentication

- **Teams Bot**: Multi-tenant Entra ID app with Bot Framework
- **Teams Tab**: OAuth 2.0 with PKCE via Teams SSO
- **Internal APIs**: Managed Identity + APIM subscription keys

### Authorization

| Role | Access |
|------|--------|
| SalesUser | Own cases only |
| SalesManager | Team cases |
| OpsAuditor | All cases (read-only) |

### Secrets

All secrets stored in Azure Key Vault:
- Zoho OAuth credentials
- External AI provider API keys
- Bot Framework secrets

## Scaling Characteristics

- **Design Capacity**: 100-200 orders/day
- **Burst Handling**: Queue-based for resilience
- **Committee Calls**: Parallelized (3 providers concurrent)
- **Zoho Rate Limits**: Automatic backoff with retry queue

## Support & Escalation

| Issue Type | L1 | L2 | L3 |
|------------|----|----|-----|
| Bot down | On-call | Platform | Microsoft |
| Parser bugs | On-call | Dev team | - |
| Zoho issues | On-call | Platform | Zoho support |
| AI issues | On-call | Dev team | Provider support |
| Data loss | Platform | Security | Management |
