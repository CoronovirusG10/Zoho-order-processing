# Type Hierarchy

Complete type hierarchy for `@order-processing/types`.

## Enums

### ResolutionStatus
- `unresolved` - Not yet matched
- `resolved` - Successfully matched
- `ambiguous` - Multiple matches found
- `not_found` - No matches found

### CustomerMatchMethod
- `exact` - Exact name match
- `fuzzy` - Fuzzy string matching
- `user_selected` - Manually selected by user
- `none` - No matching attempted

### ItemMatchMethod
- `sku` - Matched by SKU
- `gtin` - Matched by GTIN barcode
- `name_fuzzy` - Fuzzy name matching
- `user_selected` - Manually selected by user
- `none` - No matching attempted

### ColumnMappingMethod
- `dictionary` - Dictionary-based mapping
- `fuzzy` - Fuzzy string matching
- `embedding` - Semantic embedding similarity
- `llm_tiebreak` - LLM used to break ties
- `manual` - Manually specified

### ConsensusType
- `unanimous` - All providers agree
- `majority` - Majority agreement
- `split` - Evenly split
- `no_consensus` - No clear consensus

### IssueSeverity
- `info` - Informational
- `warning` - Warning
- `error` - Error
- `blocker` - Blocking issue

### IssueCode
- `FORMULAS_BLOCKED` - Formulas present in spreadsheet
- `MISSING_CUSTOMER` - Customer field missing
- `AMBIGUOUS_CUSTOMER` - Multiple customer matches
- `CUSTOMER_NOT_FOUND` - Customer not in Zoho
- `MISSING_ITEM` - Item field missing
- `AMBIGUOUS_ITEM` - Multiple item matches
- `ITEM_NOT_FOUND` - Item not in Zoho
- `ARITHMETIC_MISMATCH` - Line totals don't match
- `INVALID_QUANTITY` - Invalid quantity value
- `INVALID_PRICE` - Invalid price value
- `MISSING_REQUIRED_FIELD` - Required field missing
- `DUPLICATE_LINE_ITEM` - Duplicate line item detected
- `LOW_CONFIDENCE` - Confidence below threshold
- `SCHEMA_INFERENCE_FAILED` - Could not infer schema
- `NO_LINE_ITEMS` - No line items found
- `INVALID_CURRENCY` - Invalid currency code
- `COMMITTEE_DISAGREEMENT` - AI providers disagree

### CaseStatus
- `pending` - Waiting to process
- `parsing` - Parsing in progress
- `needs_input` - Waiting for user input
- `ready` - Ready to create in Zoho
- `creating` - Creating in Zoho
- `created` - Successfully created
- `failed` - Failed to create

### ApprovalMethod
- `adaptive_card` - Approved via Teams adaptive card
- `tab` - Approved via Teams tab
- `command` - Approved via bot command

### ActorType
- `user` - Human user
- `system` - System/automated process
- `bot` - Teams bot
- `agent` - AI agent
- `admin` - Administrator
- `scheduler` - Scheduled task

## Core Interfaces

### CanonicalSalesOrder
Main data structure representing a sales order.

**Properties:**
- `meta: OrderMeta` - Metadata about the case
- `customer: Customer` - Customer information
- `line_items: LineItem[]` - Array of line items (min 1)
- `totals?: Totals` - Order totals
- `schema_inference?: SchemaInference` - Schema detection info
- `confidence: Confidence` - Confidence scores
- `issues: Issue[]` - Array of issues
- `approvals?: Approvals` - Approval information
- `zoho?: ZohoSalesOrder` - Zoho integration data

### OrderMeta
Metadata about the order processing case.

**Required:**
- `case_id: string` - Unique case identifier
- `tenant_id: string` - Teams tenant ID
- `received_at: string` - ISO 8601 timestamp
- `source_filename: string` - Original filename
- `file_sha256: string` - SHA-256 hash (64 hex chars)

**Optional:**
- `uploader?: Uploader` - User who uploaded
- `language_hint?: string | null` - Language code (e.g., "en", "fa")
- `parsing?: ParsingInfo` - Parsing metadata
- `correlation?: Correlation` - Tracing IDs

### Customer
Customer information and matching results.

**Required:**
- `input_name: string | null` - Raw name from spreadsheet
- `resolution_status: ResolutionStatus` - Matching status

**Optional:**
- `selected_by_user?: string | null` - User-selected name
- `zoho_customer_id?: string | null` - Zoho customer ID
- `zoho_customer_name?: string | null` - Zoho customer name
- `match?: CustomerMatch` - Match details
- `evidence?: EvidenceCell[]` - Evidence cells

### LineItem
Individual line item in the order.

**Required:**
- `row: number` - 0-based row index
- `quantity: number` - Quantity (can be 0)

**Optional:**
- `source_row_number?: number | null` - 1-based spreadsheet row
- `sku?: string | null` - Stock Keeping Unit
- `gtin?: string | null` - Global Trade Item Number
- `product_name?: string | null` - Product name
- `unit_price_source?: number | null` - Price from spreadsheet
- `unit_price_zoho?: number | null` - Price from Zoho (takes precedence)
- `line_total_source?: number | null` - Line total from spreadsheet
- `currency?: string | null` - ISO 4217 currency code
- `zoho_item_id?: string | null` - Zoho item ID
- `match?: ItemMatch` - Match details
- `evidence?: LineItemEvidence` - Evidence for fields
- `flags?: string[]` - Flags for this item

### Issue
Issue raised during processing.

**Required:**
- `code: string` - Issue code
- `severity: IssueSeverity` - Severity level
- `message: string` - Human-readable message

**Optional:**
- `fields?: string[]` - Affected fields
- `evidence?: EvidenceCell[]` - Related evidence
- `suggested_user_action?: string | null` - Suggested action

## Supporting Interfaces

### EvidenceCell
Points to a specific cell in the spreadsheet.

**Required:**
- `sheet: string` - Sheet name
- `cell: string` - Cell reference (e.g., "A1")

**Optional:**
- `raw_value?: unknown` - Raw cell value
- `display_value?: string | null` - Formatted value
- `number_format?: string | null` - Excel number format

### Correlation
Distributed tracing IDs.

- `trace_id?: string` - OpenTelemetry trace ID
- `span_id?: string` - OpenTelemetry span ID
- `teams_activity_id?: string` - Teams activity ID
- `foundry_run_id?: string` - Microsoft Foundry run ID

### CommitteeResult
AI committee consensus information.

- `providers_used?: string[]` - Provider names
- `votes?: ProviderVote[]` - Individual votes
- `consensus?: ConsensusType` - Consensus type
- `disagreements?: CommitteeDisagreement[]` - Disagreements

## Event Types

### OrderProcessingEvent
Audit event for tracking actions.

**Required:**
- `ts: string` - ISO 8601 timestamp
- `event_type: string` - Event type identifier
- `case_id: string` - Case ID
- `tenant_id: string` - Tenant ID
- `sequence: number` - Monotonic sequence number

**Optional:**
- `correlation?: Correlation` - Tracing IDs
- `actor?: Actor` - Who triggered the event
- `data?: Record<string, unknown>` - Event payload
- `pointers?: Record<string, string>` - URIs to large payloads
- `redactions?: Redactions` - Redaction info

### Actor
Entity that triggered an event.

- `type?: ActorType` - Actor type
- `aad_user_id?: string | null` - Azure AD user ID
- `display_name?: string | null` - Display name
- `ip?: string | null` - IP address

## Type Relationships

```
CanonicalSalesOrder
├── meta: OrderMeta
│   ├── uploader?: Uploader
│   ├── parsing?: ParsingInfo
│   └── correlation?: Correlation
├── customer: Customer
│   ├── resolution_status: ResolutionStatus (enum)
│   ├── match?: CustomerMatch
│   │   ├── method?: CustomerMatchMethod (enum)
│   │   └── candidates?: ZohoCustomerCandidate[]
│   └── evidence?: EvidenceCell[]
├── line_items: LineItem[]
│   ├── match?: ItemMatch
│   │   ├── status?: ResolutionStatus (enum)
│   │   ├── method?: ItemMatchMethod (enum)
│   │   └── candidates?: ZohoItemCandidate[]
│   └── evidence?: LineItemEvidence
│       └── [field]: EvidenceCell
├── totals?: Totals
│   └── evidence?: TotalsEvidence
│       └── [field]: EvidenceCell
├── schema_inference?: SchemaInference
│   └── column_mappings?: ColumnMapping[]
│       └── method?: ColumnMappingMethod (enum)
├── confidence: Confidence
│   └── committee?: CommitteeResult
│       └── consensus?: ConsensusType (enum)
├── issues: Issue[]
│   ├── severity: IssueSeverity (enum)
│   └── evidence?: EvidenceCell[]
├── approvals?: Approvals
│   └── approval_method?: ApprovalMethod (enum)
└── zoho?: ZohoSalesOrder

OrderProcessingEvent
├── correlation?: Correlation
├── actor?: Actor
│   └── type?: ActorType (enum)
├── data?: Record<string, unknown>
├── pointers?: Record<string, string>
└── redactions?: Redactions
```
