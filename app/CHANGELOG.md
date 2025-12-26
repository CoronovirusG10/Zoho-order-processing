# Changelog

All notable changes to the Order Processing application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-12-26

### Added

#### Teams Integration
- Teams 1:1 bot for file uploads in personal chat
- Multi-tenant bot configuration (Azure Tenant A, Teams users in Tenant B)
- Adaptive cards for processing status, issues, review, and success states
- File download from Teams attachments with immediate storage to Blob
- Correlation ID propagation from Teams activity through all services
- Teams personal tab for case management (React + Vite)
- Case list with filters (status, date, customer)
- Case detail view with audit trail
- Role-based access (SalesUser, SalesManager, OpsAuditor)

#### Excel Parser Service
- Deterministic Excel parsing with ExcelJS
- Formula detection and blocking (configurable)
- Protected sheet detection and blocking
- Multi-language support (English and Farsi headers)
- Automatic header row detection with scoring algorithm
- Schema inference with synonym dictionaries
- Persian/Arabic digit normalization
- Flexible number parsing (multiple locale formats)
- Totals row detection and skipping
- Arithmetic validation with configurable tolerance
- Qty=0 support (valid, no warnings)
- Evidence collection with cell references for all extracted values
- Confidence scoring per extraction stage

#### Committee Engine
- 3-model committee for cross-checking schema mappings
- Provider pool: Azure OpenAI (GPT-5.x), Anthropic (Claude 4.x), DeepSeek V3.x, Gemini 2.5, xAI Grok-4
- Random provider selection (3 from pool per case)
- Weighted voting based on calibrated accuracy
- Consensus detection (unanimous, majority, split, no consensus)
- Bounded evidence pack (headers, 5 samples, stats only)
- JSON schema validation for all provider outputs
- Graceful degradation (minimum 2/3 providers must succeed)
- Golden file calibration for weight adjustment
- Audit trail storage to Blob

#### Zoho Books Integration
- Draft sales orders creation only (no customer/item creation)
- Zoho pricing prevails (spreadsheet prices audit-only)
- OAuth 2.0 token management with automatic refresh
- Thread-safe token refresh with locking
- Customer matching (exact, fuzzy with Fuse.js)
- Item matching (SKU exact, GTIN custom field, name fuzzy)
- Two-tier caching (in-memory + Cosmos DB)
- Background cache refresh service
- Idempotency via SHA-256 fingerprinting
- Retry queue with exponential backoff for outages
- Full API request/response audit logging
- Rate limit handling with Retry-After header

#### Workflow Orchestrator
- Azure Durable Functions for stateful orchestration
- Complete workflow: Parse -> Committee -> Resolve -> Approve -> Create
- Human-in-the-loop patterns for corrections and selections
- External events for user interactions (FileReuploaded, CorrectionsSubmitted, SelectionsSubmitted, ApprovalReceived)
- Automatic retries with configurable policies
- Workflow replay and termination support
- Case state persistence in Cosmos DB

#### API Service
- REST API for Teams tab (case list, detail, audit trail)
- Bot webhook handlers (file upload, corrections, approval)
- Tool endpoints for Azure AI Foundry Agent
- JWT authentication (Teams SSO)
- Role-based authorization
- Rate limiting (100 req/15min public, 30 req/min bot)
- Correlation middleware for tracing
- Health check endpoints (ready, live)

#### Storage & Audit
- Azure Blob Storage with 5+ year retention
- Immutable storage policy for audit containers
- Lifecycle management (Hot -> Cool -> Archive)
- Blob change feed enabled
- Cosmos DB for case state, fingerprints, events, agent threads
- Continuous backup (7 days)
- Structured audit events with sequence numbers

#### Observability
- Application Insights integration for all services
- Structured JSON logging
- Correlation ID propagation end-to-end
- Custom events for business metrics
- Custom metrics for monitoring
- Log Analytics workspace (730-day retention)
- Diagnostic settings for all resources

#### Infrastructure as Code
- Bicep templates for complete infrastructure
- Modular design (storage, cosmos, keyvault, appinsights, functionapp, bot, staticwebapp)
- Environment-specific parameters (dev, prod)
- Private endpoints support for production
- RBAC assignments for Managed Identity
- Deployment scripts (Bash and PowerShell)

#### Testing Framework
- Vitest configuration for all services
- Golden file testing infrastructure
- Mock providers for external services
- Test utilities and fixtures

#### Shared Packages
- `@order-processing/types`: TypeScript types and JSON schemas
- `@order-processing/shared`: Logging, correlation, errors, validation utilities

### Security

- Multi-tenant Entra ID authentication
- Managed Identity for Azure service access
- All secrets in Key Vault (never in code)
- TLS 1.2+ enforced
- HTTPS only for all endpoints
- Input validation with JSON schemas
- Formula blocking to prevent manipulation
- RBAC for data access
- Immutable audit storage
- No PII in logs (redaction policies)

### Documentation

- Comprehensive README with architecture diagrams
- Setup guides (development, Azure deployment, cross-tenant)
- Architecture documentation (overview, data flow, security)
- Operational runbooks (Zoho outage, model change, troubleshooting)
- Service-specific documentation
- API documentation with examples
- Test documentation

### Non-Negotiable Requirements Implemented

| Requirement | Implementation |
|-------------|----------------|
| Cross-tenant | Bot/Tab apps in Tenant A, users in Tenant B |
| Formula blocking | Parser detects and blocks (FORMULAS_BLOCKED issue) |
| Zoho pricing prevails | unit_price_zoho from Zoho catalog, unit_price_source for audit |
| Qty=0 valid | No warning for zero quantity lines |
| Human-in-the-loop | Issues surfaced via adaptive cards for user correction |
| Evidence-based | Every value has cell reference in evidence object |
| Correlation IDs | case_id = correlation_id, propagated through all services |

### Known Limitations

- Graph API fallback for file download not yet implemented
- Manager notifications not yet implemented
- Batch file uploads not supported
- Maximum file size: 25MB
- Maximum line items per order: 500
- Case expiration: 7 days without user action

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2025-12-26 | Initial pre-production release |

[Unreleased]: https://github.com/company/order-processing/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/company/order-processing/releases/tag/v0.1.0
