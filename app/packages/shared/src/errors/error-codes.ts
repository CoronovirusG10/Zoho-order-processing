/**
 * Error code constants for the application
 */

/**
 * All possible error codes in the system
 */
export type ErrorCode =
  // General errors
  | 'UNKNOWN_ERROR'
  | 'INTERNAL_ERROR'
  | 'CONFIGURATION_ERROR'

  // Validation errors
  | 'VALIDATION_ERROR'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'INVALID_INPUT'
  | 'MISSING_REQUIRED_FIELD'

  // Data errors
  | 'DATA_ERROR'
  | 'PARSE_ERROR'
  | 'INVALID_FORMAT'

  // File errors
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_CORRUPTED'
  | 'FORMULAS_BLOCKED'

  // Excel parsing errors
  | 'EXCEL_PARSE_ERROR'
  | 'SHEET_NOT_FOUND'
  | 'HEADER_NOT_FOUND'
  | 'INVALID_SHEET_STRUCTURE'
  | 'MULTIPLE_CANDIDATE_SHEETS'

  // Customer/Item resolution errors
  | 'CUSTOMER_NOT_FOUND'
  | 'CUSTOMER_AMBIGUOUS'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_AMBIGUOUS'
  | 'SKU_INVALID'
  | 'GTIN_INVALID'

  // Arithmetic/validation errors
  | 'ARITHMETIC_MISMATCH'
  | 'QUANTITY_INVALID'
  | 'PRICE_INVALID'

  // Case/state errors
  | 'CASE_NOT_FOUND'
  | 'INVALID_CASE_STATE'
  | 'DUPLICATE_FINGERPRINT'
  | 'CASE_ALREADY_PROCESSED'

  // External service errors
  | 'EXTERNAL_SERVICE_ERROR'
  | 'EXTERNAL_SERVICE_UNAVAILABLE'
  | 'ZOHO_API_ERROR'
  | 'ZOHO_UNAVAILABLE'
  | 'TEAMS_API_ERROR'

  // Authorization errors
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'

  // Committee/AI errors
  | 'COMMITTEE_DISAGREEMENT'
  | 'COMMITTEE_FAILED'
  | 'LLM_ERROR'
  | 'MAPPING_CONFIDENCE_LOW';

/**
 * Error code metadata
 */
export interface ErrorCodeMetadata {
  code: ErrorCode;
  description: string;
  isTransient: boolean;
  isRetryable: boolean;
  defaultMessage: string;
}

/**
 * Metadata for all error codes
 */
export const ERROR_METADATA: Record<ErrorCode, ErrorCodeMetadata> = {
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    description: 'An unknown error occurred',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'An unexpected error occurred. Please try again.',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    description: 'Internal system error',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'An internal error occurred. Please contact support.',
  },
  CONFIGURATION_ERROR: {
    code: 'CONFIGURATION_ERROR',
    description: 'Configuration is invalid or missing',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'System configuration error. Please contact support.',
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    description: 'Input validation failed',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'The provided data is invalid.',
  },
  SCHEMA_VALIDATION_FAILED: {
    code: 'SCHEMA_VALIDATION_FAILED',
    description: 'JSON schema validation failed',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Data does not match the expected format.',
  },
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    description: 'Input data is invalid',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Invalid input provided.',
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    description: 'Required field is missing',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'A required field is missing.',
  },
  DATA_ERROR: {
    code: 'DATA_ERROR',
    description: 'Data processing error',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Error processing data.',
  },
  PARSE_ERROR: {
    code: 'PARSE_ERROR',
    description: 'Failed to parse data',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Failed to parse the provided data.',
  },
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    description: 'Data format is invalid',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Invalid data format.',
  },
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    description: 'File not found',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'The requested file was not found.',
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    description: 'File exceeds size limit',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'File is too large. Maximum size is 10MB.',
  },
  UNSUPPORTED_FILE_TYPE: {
    code: 'UNSUPPORTED_FILE_TYPE',
    description: 'File type not supported',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Only .xlsx files are supported.',
  },
  FILE_CORRUPTED: {
    code: 'FILE_CORRUPTED',
    description: 'File is corrupted or unreadable',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'File is corrupted or cannot be read.',
  },
  FORMULAS_BLOCKED: {
    code: 'FORMULAS_BLOCKED',
    description: 'File contains formulas which are not allowed',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'File contains formulas. Please export values only and reupload.',
  },
  EXCEL_PARSE_ERROR: {
    code: 'EXCEL_PARSE_ERROR',
    description: 'Failed to parse Excel file',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Failed to parse Excel file.',
  },
  SHEET_NOT_FOUND: {
    code: 'SHEET_NOT_FOUND',
    description: 'Worksheet not found',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'The specified worksheet was not found.',
  },
  HEADER_NOT_FOUND: {
    code: 'HEADER_NOT_FOUND',
    description: 'Header row not found',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Could not detect header row in the spreadsheet.',
  },
  INVALID_SHEET_STRUCTURE: {
    code: 'INVALID_SHEET_STRUCTURE',
    description: 'Sheet structure is invalid',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Spreadsheet structure is invalid or unrecognizable.',
  },
  MULTIPLE_CANDIDATE_SHEETS: {
    code: 'MULTIPLE_CANDIDATE_SHEETS',
    description: 'Multiple sheets found, user must select one',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Multiple worksheets detected. Please select which one to process.',
  },
  CUSTOMER_NOT_FOUND: {
    code: 'CUSTOMER_NOT_FOUND',
    description: 'Customer not found in Zoho',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Customer not found. Please select from available options.',
  },
  CUSTOMER_AMBIGUOUS: {
    code: 'CUSTOMER_AMBIGUOUS',
    description: 'Multiple customers match',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Multiple customers found. Please select the correct one.',
  },
  ITEM_NOT_FOUND: {
    code: 'ITEM_NOT_FOUND',
    description: 'Item not found in Zoho',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Item not found. Please verify SKU or GTIN.',
  },
  ITEM_AMBIGUOUS: {
    code: 'ITEM_AMBIGUOUS',
    description: 'Multiple items match',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Multiple items found. Please select the correct one.',
  },
  SKU_INVALID: {
    code: 'SKU_INVALID',
    description: 'SKU format is invalid',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'SKU format is invalid.',
  },
  GTIN_INVALID: {
    code: 'GTIN_INVALID',
    description: 'GTIN format is invalid or check digit failed',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'GTIN is invalid.',
  },
  ARITHMETIC_MISMATCH: {
    code: 'ARITHMETIC_MISMATCH',
    description: 'Line totals do not match expected values',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Arithmetic mismatch detected in line items.',
  },
  QUANTITY_INVALID: {
    code: 'QUANTITY_INVALID',
    description: 'Quantity is invalid or negative',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Quantity must be zero or greater.',
  },
  PRICE_INVALID: {
    code: 'PRICE_INVALID',
    description: 'Price is invalid',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Price is invalid.',
  },
  CASE_NOT_FOUND: {
    code: 'CASE_NOT_FOUND',
    description: 'Case not found',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Case not found.',
  },
  INVALID_CASE_STATE: {
    code: 'INVALID_CASE_STATE',
    description: 'Case is in invalid state for this operation',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Case is in an invalid state for this operation.',
  },
  DUPLICATE_FINGERPRINT: {
    code: 'DUPLICATE_FINGERPRINT',
    description: 'Order with same fingerprint already exists',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'This order has already been processed.',
  },
  CASE_ALREADY_PROCESSED: {
    code: 'CASE_ALREADY_PROCESSED',
    description: 'Case has already been processed',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'This case has already been processed.',
  },
  EXTERNAL_SERVICE_ERROR: {
    code: 'EXTERNAL_SERVICE_ERROR',
    description: 'External service error',
    isTransient: false,
    isRetryable: true,
    defaultMessage: 'An error occurred communicating with an external service.',
  },
  EXTERNAL_SERVICE_UNAVAILABLE: {
    code: 'EXTERNAL_SERVICE_UNAVAILABLE',
    description: 'External service is temporarily unavailable',
    isTransient: true,
    isRetryable: true,
    defaultMessage: 'Service temporarily unavailable. Please try again later.',
  },
  ZOHO_API_ERROR: {
    code: 'ZOHO_API_ERROR',
    description: 'Zoho API returned an error',
    isTransient: false,
    isRetryable: true,
    defaultMessage: 'Error communicating with Zoho Books.',
  },
  ZOHO_UNAVAILABLE: {
    code: 'ZOHO_UNAVAILABLE',
    description: 'Zoho API is unavailable',
    isTransient: true,
    isRetryable: true,
    defaultMessage: 'Zoho Books is temporarily unavailable.',
  },
  TEAMS_API_ERROR: {
    code: 'TEAMS_API_ERROR',
    description: 'Teams API error',
    isTransient: false,
    isRetryable: true,
    defaultMessage: 'Error communicating with Microsoft Teams.',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    description: 'User is not authorized',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'You are not authorized to perform this action.',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    description: 'Access forbidden',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Access to this resource is forbidden.',
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    description: 'Authentication token is invalid',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Invalid authentication token.',
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    description: 'Authentication token has expired',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Authentication token has expired. Please sign in again.',
  },
  COMMITTEE_DISAGREEMENT: {
    code: 'COMMITTEE_DISAGREEMENT',
    description: 'AI committee models disagreed on mapping',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'AI models disagree on field mapping. Manual selection required.',
  },
  COMMITTEE_FAILED: {
    code: 'COMMITTEE_FAILED',
    description: 'AI committee failed to complete',
    isTransient: true,
    isRetryable: true,
    defaultMessage: 'AI validation failed. Please try again.',
  },
  LLM_ERROR: {
    code: 'LLM_ERROR',
    description: 'LLM service error',
    isTransient: true,
    isRetryable: true,
    defaultMessage: 'AI service error. Please try again.',
  },
  MAPPING_CONFIDENCE_LOW: {
    code: 'MAPPING_CONFIDENCE_LOW',
    description: 'Field mapping confidence is too low',
    isTransient: false,
    isRetryable: false,
    defaultMessage: 'Unable to confidently map spreadsheet fields. Manual review required.',
  },
};

/**
 * Get metadata for an error code
 */
export function getErrorMetadata(code: ErrorCode): ErrorCodeMetadata {
  return ERROR_METADATA[code];
}

/**
 * Check if an error code represents a transient error
 */
export function isTransientError(code: ErrorCode): boolean {
  return ERROR_METADATA[code].isTransient;
}

/**
 * Check if an error code is retryable
 */
export function isRetryableError(code: ErrorCode): boolean {
  return ERROR_METADATA[code].isRetryable;
}
