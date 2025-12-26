/**
 * Type definitions for the Teams tab application
 */

export type CaseStatus =
  | 'processing'
  | 'needs-input'
  | 'ready'
  | 'draft-created'
  | 'failed'
  | 'blocked';

export type IssueSeverity = 'block' | 'warn' | 'info';

export type IssueCode =
  | 'MISSING_CUSTOMER'
  | 'AMBIGUOUS_ITEM'
  | 'FORMULAS_BLOCKED'
  | 'ARITHMETIC_MISMATCH'
  | 'MISSING_REQUIRED'
  | 'MULTIPLE_SHEETS'
  | 'UNMAPPED_COLUMNS'
  | 'PROTECTED_WORKBOOK'
  | 'MULTI_ORDER_DETECTED';

export type AppRole = 'SalesUser' | 'SalesManager' | 'OpsAuditor';

export interface Evidence {
  sheet: string;
  cell: string;
  raw: string;
}

export interface Issue {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  evidence: Evidence[];
  suggestedFix?: string;
  requiresUserInput: boolean;
}

export interface FieldValue<T> {
  value: T | null;
  evidence: Evidence[];
}

export interface Customer {
  raw: FieldValue<string>;
  resolved: {
    zohoCustomerId: string | null;
    zohoDisplayName: string | null;
    match: 'exact' | 'fuzzy' | 'user-selected' | null;
    confidence: number;
  };
}

export interface OrderLine {
  lineNo: number;
  sku: FieldValue<string>;
  gtin: FieldValue<string>;
  description: FieldValue<string>;
  quantity: FieldValue<number>;
  unitPriceSpreadsheet: FieldValue<number>;
  lineTotalSpreadsheet: FieldValue<number>;
  resolved: {
    zohoItemId: string | null;
    match: 'sku' | 'gtin' | 'user-selected' | null;
    confidence: number;
    zohoRateUsed: number;
  };
}

export interface Totals {
  subtotal: FieldValue<number>;
  total: FieldValue<number>;
}

export interface CaseSource {
  teams: {
    tenantId: string;
    userAadId: string;
    chatId: string;
    messageId: string;
  };
  file: {
    blobUri: string;
    sha256: string;
    originalFileName: string;
  };
}

export interface Case {
  caseId: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    aadId: string;
    displayName: string;
    email: string;
  };
  source: CaseSource;
  detectedLanguage: 'en' | 'fa';
  customer: Customer;
  lines: OrderLine[];
  totalsSpreadsheet: Totals;
  issues: Issue[];
  zohoSalesOrderId?: string;
  zohoSalesOrderNumber?: string;
  zohoDeepLink?: string;
  auditBundleSasUrl?: string;
}

export interface AuditEvent {
  eventId: string;
  caseId: string;
  timestamp: string;
  eventType:
    | 'case_created'
    | 'parsing_started'
    | 'parsing_completed'
    | 'validation_completed'
    | 'user_correction'
    | 'committee_vote'
    | 'draft_created'
    | 'error';
  actor: {
    type: 'user' | 'system' | 'agent';
    id: string;
    displayName?: string;
  };
  details: Record<string, unknown>;
  message: string;
}

export interface CaseListItem {
  caseId: string;
  status: CaseStatus;
  customerName: string | null;
  createdAt: string;
  createdBy: {
    displayName: string;
    email: string;
  };
  zohoDeepLink?: string;
  fileName: string;
}

export interface CaseFilters {
  status?: CaseStatus[];
  salespersonId?: string;
  customerName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TeamsContext {
  theme: 'default' | 'dark' | 'contrast';
  locale: string;
  userObjectId: string;
  userPrincipalName: string;
  tenantId: string;
}

export interface AuthToken {
  accessToken: string;
  expiresAt: number;
}

export interface UserProfile {
  aadId: string;
  displayName: string;
  email: string;
  roles: AppRole[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
