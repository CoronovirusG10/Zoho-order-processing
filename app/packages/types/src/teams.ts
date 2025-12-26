/**
 * Microsoft Teams related types
 */

/**
 * Information about the user who uploaded a file
 */
export interface Uploader {
  /** Azure Active Directory user ID */
  aad_user_id?: string;
  /** Teams-specific user ID */
  teams_user_id?: string;
  /** Display name of the user */
  display_name?: string;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Correlation IDs for distributed tracing
 */
export interface Correlation {
  /** OpenTelemetry trace ID */
  trace_id?: string;
  /** OpenTelemetry span ID */
  span_id?: string;
  /** Teams activity ID from the bot framework */
  teams_activity_id?: string;
  /** Microsoft Foundry run ID (for event correlation) */
  foundry_run_id?: string;
  /** Allow additional properties */
  [key: string]: unknown;
}
