# System Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TENANT B (Teams Users)                          │
│  ┌──────────────┐    ┌──────────────┐                                        │
│  │  Salesperson │    │   Manager    │                                        │
│  │  (Teams)     │    │  (Teams)     │                                        │
│  └──────┬───────┘    └──────┬───────┘                                        │
│         │ Upload .xlsx      │ View cases                                     │
└─────────┼───────────────────┼────────────────────────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TENANT A (Azure - Sweden Central)                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Azure Bot Service                               │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │ │
│  │  │  Teams Bot  │───▶│ File Handler│───▶│ Card Builder│                 │ │
│  │  └─────────────┘    └──────┬──────┘    └─────────────┘                 │ │
│  └────────────────────────────┼───────────────────────────────────────────┘ │
│                               │                                              │
│                               ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Azure Durable Functions                            │ │
│  │  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐            │ │
│  │  │ Parse   │──▶│Committee │──▶│  Resolve  │──▶│  Create  │            │ │
│  │  │ Excel   │   │  Review  │   │ Entities  │   │  Draft   │            │ │
│  │  └─────────┘   └──────────┘   └───────────┘   └──────────┘            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                               │                                              │
│         ┌─────────────────────┼─────────────────────┐                        │
│         ▼                     ▼                     ▼                        │
│  ┌─────────────┐     ┌─────────────────┐    ┌─────────────┐                 │
│  │   Parser    │     │   Committee     │    │    Zoho     │                 │
│  │   Service   │     │    Engine       │    │   Service   │                 │
│  │ (ExcelJS)   │     │ (3 providers)   │    │ (OAuth/API) │                 │
│  └─────────────┘     └────────┬────────┘    └──────┬──────┘                 │
│                               │                     │                        │
│                               ▼                     ▼                        │
│                   ┌───────────────────────┐  ┌─────────────┐                │
│                   │  Azure AI Foundry     │  │ Zoho Books  │                │
│                   │  - GPT-5.x            │  │ (EU DC)     │                │
│                   │  - Claude 4.x         │  └─────────────┘                │
│                   │  - DeepSeek V3.x      │        ▲                        │
│                   │  - Grok-4             │        │                        │
│                   └───────────────────────┘        │                        │
│                                                    │                        │
│  ┌────────────────────────────────────────────────┼───────────────────────┐ │
│  │                        Storage Layer           │                        │ │
│  │  ┌─────────────┐   ┌─────────────┐   ┌────────┴────┐                   │ │
│  │  │ Blob Storage│   │  Cosmos DB  │   │  Key Vault  │                   │ │
│  │  │ (5y audit)  │   │  (cases)    │   │  (secrets)  │                   │ │
│  │  └─────────────┘   └─────────────┘   └─────────────┘                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Observability                                    │ │
│  │  ┌─────────────────┐   ┌───────────────────┐                           │ │
│  │  │ App Insights    │   │ Log Analytics     │                           │ │
│  │  │ (traces/metrics)│   │ (2y query/5y arch)│                           │ │
│  │  └─────────────────┘   └───────────────────┘                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Teams Bot
- Receives file uploads in personal chat
- Posts adaptive cards for user interaction
- Handles approval/correction workflows
- Multi-tenant authentication

### Workflow Orchestrator (Durable Functions)
- Coordinates the order processing pipeline
- Manages state across async operations
- Handles retries and failure recovery
- Supports human-in-the-loop patterns

### Parser Service
- Deterministic Excel parsing
- Formula detection and blocking
- Schema inference (English + Farsi)
- Evidence collection for every value

### Committee Engine
- Runs 3 AI providers in parallel
- Aggregates votes with weighted voting
- Detects consensus/disagreement
- Forces human input when uncertain

### Zoho Service
- OAuth token management
- Customer/item resolution
- Draft sales order creation
- Retry queue for outages

### Storage Layer
- **Blob Storage**: Raw files, audit bundles, model outputs
- **Cosmos DB**: Case state, fingerprints, cache
- **Key Vault**: All secrets and credentials

## Data Flow

1. User uploads Excel file in Teams
2. Bot downloads file to Blob Storage
3. Parser extracts data with evidence
4. Committee reviews mappings
5. User corrects any issues
6. Zoho service resolves entities
7. User approves final order
8. Draft created in Zoho Books
9. Confirmation sent to user

## Security Model

- Multi-tenant Entra apps
- Managed Identity for Azure services
- All secrets in Key Vault
- RBAC for data access
- Immutable audit storage

## Scaling Characteristics

- Designed for 100-200 orders/day
- Queue-based for burst handling
- Committee calls are parallelized
- Zoho rate limits respected
