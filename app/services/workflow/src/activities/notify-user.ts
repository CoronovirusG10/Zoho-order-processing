/**
 * Notify User Activity
 *
 * Sends adaptive cards and messages to the user in Teams.
 * Handles different notification types (blocked, issues, approval ready, complete).
 */

import { InvocationContext } from '@azure/functions';
import { NotifyUserInput, NotifyUserOutput } from '../types';

export async function notifyUserActivity(
  input: NotifyUserInput,
  context: InvocationContext
): Promise<NotifyUserOutput> {
  const { caseId, type } = input;

  context.log(`[${caseId}] Sending notification to user. Type: ${type}`);

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

    context.log(`[${caseId}] Notification sent: ${message}`);

    return {
      success: true,
      messageId: `msg-${Date.now()}`,
    };
  } catch (error) {
    context.error(`[${caseId}] Failed to send notification:`, error);
    throw error;
  }
}

export default notifyUserActivity;
