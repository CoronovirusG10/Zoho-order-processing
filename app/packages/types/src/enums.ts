/**
 * Enums for order processing system
 */

/**
 * Resolution status for customer and item matching
 */
export enum ResolutionStatus {
  Unresolved = 'unresolved',
  Resolved = 'resolved',
  Ambiguous = 'ambiguous',
  NotFound = 'not_found',
}

/**
 * Method used for customer matching
 */
export enum CustomerMatchMethod {
  Exact = 'exact',
  Fuzzy = 'fuzzy',
  UserSelected = 'user_selected',
  None = 'none',
}

/**
 * Method used for item matching
 */
export enum ItemMatchMethod {
  Sku = 'sku',
  Gtin = 'gtin',
  NameFuzzy = 'name_fuzzy',
  UserSelected = 'user_selected',
  None = 'none',
}

/**
 * Method used for column mapping
 */
export enum ColumnMappingMethod {
  Dictionary = 'dictionary',
  Fuzzy = 'fuzzy',
  Embedding = 'embedding',
  LlmTiebreak = 'llm_tiebreak',
  Manual = 'manual',
}

/**
 * Consensus type from AI committee
 */
export enum ConsensusType {
  Unanimous = 'unanimous',
  Majority = 'majority',
  Split = 'split',
  NoConsensus = 'no_consensus',
}

/**
 * Issue severity levels
 */
export enum IssueSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Blocker = 'blocker',
}

/**
 * Known issue codes that can be raised during order processing
 */
export enum IssueCode {
  FormulasBlocked = 'FORMULAS_BLOCKED',
  MissingCustomer = 'MISSING_CUSTOMER',
  AmbiguousCustomer = 'AMBIGUOUS_CUSTOMER',
  CustomerNotFound = 'CUSTOMER_NOT_FOUND',
  MissingItem = 'MISSING_ITEM',
  AmbiguousItem = 'AMBIGUOUS_ITEM',
  ItemNotFound = 'ITEM_NOT_FOUND',
  ArithmeticMismatch = 'ARITHMETIC_MISMATCH',
  InvalidQuantity = 'INVALID_QUANTITY',
  InvalidPrice = 'INVALID_PRICE',
  MissingRequiredField = 'MISSING_REQUIRED_FIELD',
  DuplicateLineItem = 'DUPLICATE_LINE_ITEM',
  LowConfidence = 'LOW_CONFIDENCE',
  SchemaInferenceFailed = 'SCHEMA_INFERENCE_FAILED',
  NoLineItems = 'NO_LINE_ITEMS',
  InvalidCurrency = 'INVALID_CURRENCY',
  CommitteeDisagreement = 'COMMITTEE_DISAGREEMENT',
}

/**
 * Case processing status
 */
export enum CaseStatus {
  Pending = 'pending',
  Parsing = 'parsing',
  NeedsInput = 'needs_input',
  Ready = 'ready',
  Creating = 'creating',
  Created = 'created',
  Failed = 'failed',
}

/**
 * Approval method
 */
export enum ApprovalMethod {
  AdaptiveCard = 'adaptive_card',
  Tab = 'tab',
  Command = 'command',
}

/**
 * Actor type for events
 */
export enum ActorType {
  User = 'user',
  System = 'system',
  Bot = 'bot',
  Agent = 'agent',
  Admin = 'admin',
  Scheduler = 'scheduler',
}
