/**
 * Order processing event types for audit logging
 */

import { ActorType } from './enums.js';
import { Correlation } from './teams.js';

/**
 * Actor who triggered the event
 */
export interface Actor {
  /** Type of actor */
  type?: ActorType;
  /** Azure Active Directory user ID */
  aad_user_id?: string | null;
  /** Display name of the actor */
  display_name?: string | null;
  /** IP address if available */
  ip?: string | null;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Redaction information for sensitive data
 */
export interface Redactions {
  /** Whether the event contains secrets */
  contains_secrets?: boolean;
  /** Whether the event contains PII */
  contains_pii?: boolean;
  /** Redaction policy applied */
  policy?: string;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Order Processing Event - audit event for tracking actions in the system
 */
export interface OrderProcessingEvent {
  /** ISO 8601 timestamp */
  ts: string;
  /** Event type identifier */
  event_type: string;
  /** Case ID this event belongs to */
  case_id: string;
  /** Tenant ID */
  tenant_id: string;
  /** Monotonic per-case event sequence number */
  sequence: number;
  /** Correlation IDs for distributed tracing */
  correlation?: Correlation;
  /** Actor who triggered the event */
  actor?: Actor;
  /** Event-specific data payload */
  data?: Record<string, unknown>;
  /** URIs to blobs/documents containing large payloads */
  pointers?: Record<string, string>;
  /** Redaction information */
  redactions?: Redactions;
  /** Allow additional properties */
  [key: string]: unknown;
}
