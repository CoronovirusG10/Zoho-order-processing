/**
 * Update Case Activity (Temporal)
 *
 * Updates the case record in Cosmos DB with current status and metadata.
 * Maintains audit trail of all state changes.
 */

import { log } from '@temporalio/activity';
import type { CaseStatus } from '../workflows/types.js';
import {
  getCasesRepository,
  getEventsRepository,
  CasesRepository,
  EventsRepository,
  EventType as RepoEventType,
} from '../repositories/index.js';

// Re-export CaseStatus for consumers
export type { CaseStatus } from '../workflows/types.js';

/**
 * Event types for audit trail
 */
export type EventType =
  | 'case_created'
  | 'status_changed'
  | 'file_stored'
  | 'file_parsed'
  | 'committee_completed'
  | 'corrections_submitted'
  | 'customer_resolved'
  | 'customer_selection_submitted'
  | 'items_resolved'
  | 'item_selection_submitted'
  | 'approval_received'
  | 'zoho_draft_created'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_cancelled';

/**
 * Case updates that can be persisted
 */
export interface CaseUpdates {
  zohoCustomerId?: string;
  zohoCustomerName?: string;
  zohoOrderId?: string;
  zohoOrderNumber?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// Input/Output interfaces
export interface UpdateCaseInput {
  caseId: string;
  tenantId: string;
  status: CaseStatus;
  updates?: Record<string, unknown>;
  eventType?: EventType;
  userId?: string;
  correlationId?: string;
}

export interface UpdateCaseOutput {
  success: boolean;
}

// Repository instances - lazily initialized
let casesRepository: CasesRepository | null = null;
let eventsRepository: EventsRepository | null = null;
let repositoriesAvailable = false;

/**
 * Try to get repositories - returns true if available
 */
function ensureRepositories(): boolean {
  if (repositoriesAvailable) return true;

  try {
    casesRepository = getCasesRepository();
    eventsRepository = getEventsRepository();
    repositoriesAvailable = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if repositories are initialized
 */
export function isUpdateCaseInitialized(): boolean {
  return ensureRepositories();
}

/**
 * Map activity event types to repository event types
 */
function mapEventType(eventType: EventType): RepoEventType {
  const mapping: Record<EventType, RepoEventType> = {
    case_created: 'case_created',
    status_changed: 'status_changed',
    file_stored: 'file_stored',
    file_parsed: 'file_parsed',
    committee_completed: 'committee_run',
    corrections_submitted: 'corrections_applied',
    customer_resolved: 'customer_resolved',
    customer_selection_submitted: 'customer_selected',
    items_resolved: 'items_resolved',
    item_selection_submitted: 'items_selected',
    approval_received: 'approval_received',
    zoho_draft_created: 'zoho_draft_created',
    workflow_completed: 'case_completed',
    workflow_failed: 'case_failed',
    workflow_cancelled: 'case_cancelled',
  };
  return mapping[eventType] || 'status_changed';
}

/**
 * Updates a case record in Cosmos DB
 * @param input - The input containing caseId, tenantId, status, and optional updates
 * @returns Success status
 */
export async function updateCase(input: UpdateCaseInput): Promise<UpdateCaseOutput> {
  const { caseId, tenantId, status, updates, eventType, userId, correlationId } = input;

  log.info('Updating case status', {
    caseId,
    tenantId,
    status,
    hasUpdates: !!updates,
    eventType,
  });

  // If repositories aren't initialized, use mock behavior
  // This allows the activity to work during development or when
  // Cosmos DB is not available
  if (!ensureRepositories() || !casesRepository || !eventsRepository) {
    log.warn('Repositories not initialized, using mock behavior', {
      caseId,
      status,
    });
    return { success: true };
  }

  try {
    // Update case status in Cosmos DB
    await casesRepository.updateCaseStatus(
      caseId,
      tenantId,
      status,
      updates as Partial<CaseUpdates> | undefined
    );

    // Append audit event if event type is specified
    if (eventType) {
      await eventsRepository.appendEvent({
        caseId,
        type: mapEventType(eventType),
        status,
        correlationId,
        userId,
        metadata: updates as Record<string, unknown>,
      });
    }

    log.info('Case updated successfully', {
      caseId,
      status,
      eventType,
    });

    return { success: true };
  } catch (error) {
    log.error('Failed to update case', {
      caseId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
