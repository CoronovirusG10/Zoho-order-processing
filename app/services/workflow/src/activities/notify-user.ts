/**
 * Notify User Activity (Temporal)
 *
 * Sends adaptive cards and messages to the user in Teams.
 * Handles different notification types (blocked, issues, approval ready, complete).
 */

import { log } from '@temporalio/activity';

// Notification types
export type NotificationType =
  | 'blocked'
  | 'issues'
  | 'selection_needed'
  | 'ready_for_approval'
  | 'complete'
  | 'failed';

// Input/Output interfaces
export interface NotifyUserInput {
  caseId: string;
  type: NotificationType;
  reason?: string;
  issues?: unknown[];
  candidates?: unknown;
  zohoOrderId?: string;
}

export interface NotifyUserOutput {
  success: boolean;
  messageId?: string;
}

/**
 * Sends a notification to the user in Teams
 * @param input - The input containing caseId, type, and notification details
 * @returns Success status and message ID
 */
export async function notifyUser(input: NotifyUserInput): Promise<NotifyUserOutput> {
  const { caseId, type } = input;

  log.info(`[${caseId}] Sending notification to user. Type: ${type}`);

  try {
    // TODO: Call Teams bot service
    // POST /api/notify
    // Body: { caseId, type, ...input }
    // Returns: { success, messageId }

    const teamsBotUrl = process.env.TEAMS_BOT_SERVICE_URL || 'http://localhost:3978/api';

    // Mock implementation for now
    let message = '';
    switch (type) {
      case 'blocked':
        message = `File is blocked: ${input.reason}. Please re-upload with corrections.`;
        break;
      case 'issues':
        message = `Issues detected: ${JSON.stringify(input.issues)}`;
        break;
      case 'selection_needed':
        message = 'Please select from the following options...';
        break;
      case 'ready_for_approval':
        message = 'Order is ready for your approval.';
        break;
      case 'complete':
        message = `Draft sales order created successfully: ${input.zohoOrderId}`;
        break;
      case 'failed':
        message = `Order processing failed: ${input.reason}`;
        break;
    }

    log.info(`[${caseId}] Notification sent: ${message}`);

    return {
      success: true,
      messageId: `msg-${Date.now()}`,
    };
  } catch (error) {
    log.error(`[${caseId}] Failed to send notification: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
