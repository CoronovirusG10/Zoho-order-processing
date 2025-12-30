/**
 * Notify User Activity (Temporal)
 *
 * Sends adaptive cards and messages to the user in Teams via the Teams bot service.
 * The Teams bot exposes POST /api/status which accepts a conversationReference and
 * a pre-built adaptive card.
 *
 * This activity builds the appropriate card based on notification type and posts
 * it to the Teams bot service.
 */

import { log } from '@temporalio/activity';

// Notification types for order processing workflow
export type NotificationType =
  | 'processing'        // Initial processing card - file is being analyzed
  | 'blocked'           // File blocked (e.g., contains formulas), need re-upload
  | 'issues'            // Issues detected, need user corrections
  | 'selection_needed'  // Ambiguous matches, need user selection
  | 'ready_for_approval' // Order ready for user approval before creating in Zoho
  | 'complete'          // Order created successfully in Zoho
  | 'failed'            // Order processing failed
  | 'reminder'          // Reminder after waiting for user input
  | 'escalation'        // Escalation notification (includes manager)
  | 'timeout_warning';  // Final warning before auto-cancel

// Issue severity levels (matching teams-bot IssueItem)
export interface IssueItem {
  code: string;
  severity: 'info' | 'warning' | 'error' | 'blocker';
  message: string;
  messageEn: string;
  messageFa?: string;
  fields?: string[];
  suggestedUserAction?: string;
}

// Order review data for approval cards
export interface OrderReview {
  customerName: string;
  lineItemCount: number;
  totalSource: string;
  totalZoho: string;
  warnings: string[];
}

// Zoho creation result for success cards
export interface ZohoCreationResult {
  salesorderId: string;
  salesorderNumber: string;
  status: string;
  url: string;
}

// Selection candidates for ambiguous matches
export interface SelectionCandidates {
  customers?: Array<{
    id: string;
    name: string;
    score: number;
  }>;
  items?: Array<{
    lineIndex: number;
    originalDescription: string;
    candidates: Array<{
      id: string;
      name: string;
      sku: string;
      score: number;
    }>;
  }>;
}

// Input interface for notifyUser activity
export interface NotifyUserInput {
  caseId: string;
  type: NotificationType;
  conversationReference?: unknown; // Bot Framework ConversationReference
  correlationId: string;

  // Optional fields based on notification type
  fileName?: string;            // For 'processing' type
  status?: string;              // For 'processing' type - current processing status
  reason?: string;              // For 'blocked' and 'failed' types
  formulaCount?: number;        // For 'blocked' type (formula blocked)
  issues?: IssueItem[];         // For 'issues' type
  candidates?: SelectionCandidates; // For 'selection_needed' type
  orderReview?: OrderReview;    // For 'ready_for_approval' type
  zohoResult?: ZohoCreationResult; // For 'complete' type
  zohoOrderId?: string;         // Legacy - use zohoResult instead
  zohoOrderNumber?: string;     // Legacy - use zohoResult instead
  auditBundleUrl?: string;      // For 'complete' type
  auditManifestPath?: string;   // For 'complete' type - path to audit manifest in blob storage

  // Fields for reminder/escalation/timeout notifications
  waitContext?: HumanWaitContext;
}

// Context for human wait scenarios
export interface HumanWaitContext {
  waitType: 'corrections' | 'customer_selection' | 'item_selection' | 'approval';
  waitDuration: string;
  userId?: string;
  managerUserId?: string;
  timeUntilCancel?: string;
}

export interface NotifyUserOutput {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Teams bot service URL
const TEAMS_BOT_URL = process.env.TEAMS_BOT_SERVICE_URL || 'http://localhost:3978';

/**
 * Sends a notification to the user in Teams
 *
 * This activity:
 * 1. Builds an appropriate adaptive card based on notification type
 * 2. Posts the card to the Teams bot /api/status endpoint
 * 3. The Teams bot then uses proactive messaging to send the card to the user
 *
 * @param input - The input containing caseId, type, and notification details
 * @returns Success status and optional message ID
 */
export async function notifyUser(input: NotifyUserInput): Promise<NotifyUserOutput> {
  log.info('Sending notification to user', {
    caseId: input.caseId,
    type: input.type,
    correlationId: input.correlationId,
    hasConversationRef: !!input.conversationReference,
  });

  // Validate required fields
  if (!input.conversationReference) {
    log.warn('No conversation reference provided, cannot send proactive message', {
      caseId: input.caseId,
      type: input.type,
    });
    return {
      success: false,
      error: 'No conversation reference provided',
    };
  }

  try {
    // Build the appropriate card based on notification type
    const card = buildNotificationCard(input);

    // POST to Teams bot /api/status endpoint
    const response = await fetch(`${TEAMS_BOT_URL}/api/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': input.correlationId,
      },
      body: JSON.stringify({
        conversationReference: input.conversationReference,
        card,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('Teams bot returned error', {
        caseId: input.caseId,
        status: response.status,
        error: errorText,
      });
      // Don't throw - notification failure shouldn't fail the workflow
      return {
        success: false,
        error: `Teams bot error: ${response.status} ${errorText}`,
      };
    }

    const result = await response.json() as { success: boolean; messageId?: string };

    log.info('Notification sent successfully', {
      caseId: input.caseId,
      type: input.type,
      messageId: result.messageId,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to send notification', {
      caseId: input.caseId,
      type: input.type,
      error: errorMessage,
    });

    // Don't throw - notification failure shouldn't fail the workflow
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Build an adaptive card based on notification type
 *
 * Note: Ideally these card templates would live in the Teams bot service to avoid
 * duplication. For now, we build basic cards here that can be enhanced later.
 */
function buildNotificationCard(input: NotifyUserInput): Record<string, unknown> {
  switch (input.type) {
    case 'processing':
      return buildProcessingCard(input);
    case 'blocked':
      return buildBlockedCard(input);
    case 'issues':
      return buildIssuesCard(input);
    case 'selection_needed':
      return buildSelectionCard(input);
    case 'ready_for_approval':
      return buildApprovalCard(input);
    case 'complete':
      return buildSuccessCard(input);
    case 'failed':
      return buildFailedCard(input);
    case 'reminder':
      return buildReminderCard(input);
    case 'escalation':
      return buildEscalationCard(input);
    case 'timeout_warning':
      return buildTimeoutWarningCard(input);
    default:
      return buildGenericCard(input);
  }
}

/**
 * Processing card - shown while file is being analyzed
 */
function buildProcessingCard(input: NotifyUserInput): Record<string, unknown> {
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [
              {
                type: 'Image',
                url: 'https://adaptivecards.io/content/pending.gif',
                size: 'Small',
              },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                weight: 'Bolder',
                text: 'Processing Order...',
                wrap: true,
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: 'Your file is being processed. This may take a moment.',
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'File', value: input.fileName || 'Unknown' },
          { title: 'Status', value: input.status || 'Analyzing spreadsheet...' },
        ],
        spacing: 'Medium',
      },
    ],
  };
}

/**
 * Blocked card - shown when file cannot be processed (e.g., formulas detected)
 */
function buildBlockedCard(input: NotifyUserInput): Record<string, unknown> {
  const isFormulaBlocked = input.reason?.toLowerCase().includes('formula') || input.formulaCount;

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'attention',
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [{ type: 'TextBlock', text: '\uD83D\uDEAB', size: 'ExtraLarge' }],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    weight: 'Bolder',
                    size: 'Large',
                    text: isFormulaBlocked ? 'File Blocked - Formulas Detected' : 'File Blocked',
                    wrap: true,
                    color: 'Attention',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: input.reason || 'The file cannot be processed in its current state.',
        wrap: true,
        spacing: 'Medium',
      },
      ...(isFormulaBlocked ? [
        {
          type: 'Container',
          style: 'emphasis',
          spacing: 'Medium',
          items: [
            {
              type: 'TextBlock',
              text: '**How to export as values-only:**',
              weight: 'Bolder',
            },
            {
              type: 'TextBlock',
              text: '1. Open in Excel\n2. Select all cells (Ctrl+A)\n3. Copy (Ctrl+C)\n4. Paste Special -> Values only\n5. Save as new file',
              wrap: true,
              size: 'Small',
            },
          ],
        },
      ] : []),
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Upload Revised File',
        style: 'positive',
        data: {
          action: 'request_reupload',
          caseId: input.caseId,
          reason: input.reason,
        },
      },
    ],
  };
}

/**
 * Issues card - shown when validation issues need user correction
 */
function buildIssuesCard(input: NotifyUserInput): Record<string, unknown> {
  const issues = input.issues || [];
  const blockers = issues.filter(i => i.severity === 'blocker');
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  const issuesList: Array<Record<string, unknown>> = [];

  if (blockers.length > 0) {
    issuesList.push({
      type: 'TextBlock',
      text: `\uD83D\uDEAB **Blocking Issues (${blockers.length})**`,
      wrap: true,
      weight: 'Bolder',
      color: 'Attention',
    });
    blockers.forEach((issue, idx) => {
      issuesList.push({
        type: 'TextBlock',
        text: `${idx + 1}. ${issue.message}${issue.suggestedUserAction ? `\n   -> ${issue.suggestedUserAction}` : ''}`,
        wrap: true,
        spacing: 'Small',
      });
    });
  }

  if (errors.length > 0) {
    issuesList.push({
      type: 'TextBlock',
      text: `\u274C **Errors (${errors.length})**`,
      wrap: true,
      weight: 'Bolder',
      color: 'Warning',
      spacing: 'Medium',
    });
    errors.forEach((issue, idx) => {
      issuesList.push({
        type: 'TextBlock',
        text: `${idx + 1}. ${issue.message}${issue.suggestedUserAction ? `\n   -> ${issue.suggestedUserAction}` : ''}`,
        wrap: true,
        spacing: 'Small',
      });
    });
  }

  if (warnings.length > 0) {
    issuesList.push({
      type: 'TextBlock',
      text: `\u26A0\uFE0F **Warnings (${warnings.length})**`,
      wrap: true,
      weight: 'Bolder',
      spacing: 'Medium',
    });
    warnings.forEach((issue, idx) => {
      issuesList.push({
        type: 'TextBlock',
        text: `${idx + 1}. ${issue.message}`,
        wrap: true,
        isSubtle: true,
        spacing: 'Small',
      });
    });
  }

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        weight: 'Bolder',
        size: 'Large',
        text: 'Action Required',
        color: 'Attention',
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: 'The following issues were found and need your attention:',
        wrap: true,
      },
      ...issuesList,
      {
        type: 'Container',
        spacing: 'Medium',
        items: [
          {
            type: 'TextBlock',
            text: 'Additional Notes',
            weight: 'Bolder',
          },
          {
            type: 'Input.Text',
            id: 'userNotes',
            isMultiline: true,
            placeholder: 'Optional notes or corrections',
          },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Submit Corrections',
        style: 'positive',
        data: {
          action: 'submit_corrections',
          caseId: input.caseId,
        },
      },
      {
        type: 'Action.Submit',
        title: 'Upload Revised File',
        data: {
          action: 'request_reupload',
          caseId: input.caseId,
        },
      },
    ],
  };
}

/**
 * Selection card - shown when user needs to select from ambiguous matches
 */
function buildSelectionCard(input: NotifyUserInput): Record<string, unknown> {
  const candidates = input.candidates;
  const selectionItems: Array<Record<string, unknown>> = [];

  // Customer selection
  if (candidates?.customers && candidates.customers.length > 0) {
    selectionItems.push({
      type: 'TextBlock',
      text: '**Select Customer:**',
      weight: 'Bolder',
      spacing: 'Medium',
    });
    selectionItems.push({
      type: 'Input.ChoiceSet',
      id: 'selectedCustomer',
      style: 'expanded',
      choices: candidates.customers.map(c => ({
        title: `${c.name} (${Math.round(c.score * 100)}% match)`,
        value: c.id,
      })),
    });
  }

  // Item selections
  if (candidates?.items && candidates.items.length > 0) {
    candidates.items.forEach((item, lineIdx) => {
      selectionItems.push({
        type: 'TextBlock',
        text: `**Line ${item.lineIndex + 1}: "${item.originalDescription}"**`,
        weight: 'Bolder',
        spacing: 'Medium',
      });
      selectionItems.push({
        type: 'Input.ChoiceSet',
        id: `selectedItem_${item.lineIndex}`,
        style: 'expanded',
        choices: item.candidates.map(c => ({
          title: `${c.name} (SKU: ${c.sku}, ${Math.round(c.score * 100)}% match)`,
          value: c.id,
        })),
      });
    });
  }

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        weight: 'Bolder',
        size: 'Large',
        text: 'Selection Required',
        color: 'Warning',
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: 'We found multiple possible matches. Please select the correct options:',
        wrap: true,
      },
      ...selectionItems,
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Confirm Selections',
        style: 'positive',
        data: {
          action: 'submit_selections',
          caseId: input.caseId,
        },
      },
      {
        type: 'Action.Submit',
        title: 'Upload Revised File',
        data: {
          action: 'request_reupload',
          caseId: input.caseId,
        },
      },
    ],
  };
}

/**
 * Approval card - shown when order is ready for user approval
 */
function buildApprovalCard(input: NotifyUserInput): Record<string, unknown> {
  const review = input.orderReview;
  const warnings = review?.warnings || [];

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        weight: 'Bolder',
        size: 'Large',
        text: 'Draft Sales Order Preview',
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Customer', value: review?.customerName || 'Unknown' },
          { title: 'Line items', value: String(review?.lineItemCount || 0) },
          { title: 'Total (source)', value: review?.totalSource || 'N/A' },
          { title: 'Total (Zoho pricing)', value: review?.totalZoho || 'N/A' },
        ],
      },
      ...(warnings.length > 0 ? [
        {
          type: 'TextBlock',
          text: 'Warnings / Ambiguities',
          weight: 'Bolder',
          spacing: 'Medium',
        },
        {
          type: 'TextBlock',
          text: warnings.join('\n'),
          wrap: true,
          isSubtle: true,
        },
      ] : []),
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Approve & Create Draft in Zoho',
        style: 'positive',
        data: {
          action: 'approve_create',
          caseId: input.caseId,
        },
      },
      {
        type: 'Action.Submit',
        title: 'Request Changes',
        data: {
          action: 'request_changes',
          caseId: input.caseId,
        },
      },
    ],
  };
}

/**
 * Success card - shown when order is created in Zoho
 */
function buildSuccessCard(input: NotifyUserInput): Record<string, unknown> {
  const result = input.zohoResult;
  const orderNumber = result?.salesorderNumber || input.zohoOrderNumber || 'Unknown';
  const zohoUrl = result?.url || '#';
  const auditUrl = input.auditBundleUrl || '#';

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'emphasis',
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [{ type: 'TextBlock', text: '\u2705', size: 'ExtraLarge' }],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    weight: 'Bolder',
                    size: 'Large',
                    text: 'Draft Sales Order Created',
                    wrap: true,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'Container',
        style: 'warning',
        items: [
          {
            type: 'TextBlock',
            text: '\u26A0\uFE0F **Important:** This is a DRAFT order. Please review in Zoho Books and confirm before sending to customer.',
            wrap: true,
            weight: 'Bolder',
          },
        ],
        spacing: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Zoho Sales Order', value: orderNumber },
          { title: 'Status', value: result?.status || 'draft' },
        ],
        spacing: 'Medium',
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View in Zoho Books',
        url: zohoUrl,
      },
      ...(auditUrl !== '#' ? [{
        type: 'Action.OpenUrl',
        title: 'Download Audit Bundle',
        url: auditUrl,
      }] : []),
    ],
  };
}

/**
 * Failed card - shown when order processing failed
 */
function buildFailedCard(input: NotifyUserInput): Record<string, unknown> {
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'attention',
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [{ type: 'TextBlock', text: '\u274C', size: 'ExtraLarge' }],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    weight: 'Bolder',
                    size: 'Large',
                    text: 'Order Processing Failed',
                    wrap: true,
                    color: 'Attention',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: input.reason || 'An unexpected error occurred while processing your order.',
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: 'Please try uploading the file again or contact support if the problem persists.',
        wrap: true,
        isSubtle: true,
        spacing: 'Small',
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Try Again',
        style: 'positive',
        data: {
          action: 'request_reupload',
          caseId: input.caseId,
          reason: 'retry_after_failure',
        },
      },
    ],
  };
}

/**
 * Reminder card - shown when user hasn't responded after initial wait period
 */
function buildReminderCard(input: NotifyUserInput): Record<string, unknown> {
  const context = input.waitContext;
  const waitTypeLabels: Record<string, string> = {
    corrections: 'review and correct issues',
    customer_selection: 'select a customer',
    item_selection: 'select items',
    approval: 'approve the order',
  };
  const actionLabel = waitTypeLabels[context?.waitType || 'approval'] || 'take action';

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'warning',
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [{ type: 'TextBlock', text: '\u23F0', size: 'ExtraLarge' }],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    weight: 'Bolder',
                    size: 'Large',
                    text: 'Reminder: Action Required',
                    wrap: true,
                    color: 'Warning',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: `Your order has been pending for **${context?.waitDuration || '24 hours'}**.`,
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: `Please ${actionLabel} to continue processing.`,
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: 'If no action is taken, this order may be escalated or cancelled.',
        wrap: true,
        isSubtle: true,
        spacing: 'Small',
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'View Order Details',
        style: 'positive',
        data: {
          action: 'view_pending_order',
          caseId: input.caseId,
          waitType: context?.waitType,
        },
      },
    ],
  };
}

/**
 * Escalation card - shown when order has been waiting too long (includes manager notification)
 */
function buildEscalationCard(input: NotifyUserInput): Record<string, unknown> {
  const context = input.waitContext;
  const waitTypeLabels: Record<string, string> = {
    corrections: 'corrections review',
    customer_selection: 'customer selection',
    item_selection: 'item selection',
    approval: 'approval',
  };
  const actionLabel = waitTypeLabels[context?.waitType || 'approval'] || 'action';

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'attention',
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [{ type: 'TextBlock', text: '\u26A0\uFE0F', size: 'ExtraLarge' }],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    weight: 'Bolder',
                    size: 'Large',
                    text: 'Escalation: Order Requires Immediate Attention',
                    wrap: true,
                    color: 'Attention',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: `This order has been waiting **${context?.waitDuration || '48+ hours'}** for ${actionLabel}.`,
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: 'This notification has been escalated. Please take immediate action to prevent automatic cancellation.',
        wrap: true,
        weight: 'Bolder',
      },
      ...(context?.managerUserId ? [
        {
          type: 'TextBlock',
          text: `Manager has been notified.`,
          wrap: true,
          isSubtle: true,
          spacing: 'Small',
        },
      ] : []),
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Take Action Now',
        style: 'positive',
        data: {
          action: 'view_pending_order',
          caseId: input.caseId,
          waitType: context?.waitType,
          escalated: true,
        },
      },
    ],
  };
}

/**
 * Timeout warning card - final warning before auto-cancel
 */
function buildTimeoutWarningCard(input: NotifyUserInput): Record<string, unknown> {
  const context = input.waitContext;
  const waitTypeLabels: Record<string, string> = {
    corrections: 'corrections',
    customer_selection: 'customer selection',
    item_selection: 'item selection',
    approval: 'approval',
  };
  const actionLabel = waitTypeLabels[context?.waitType || 'approval'] || 'action';

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'attention',
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [{ type: 'TextBlock', text: '\uD83D\uDEA8', size: 'ExtraLarge' }],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    weight: 'Bolder',
                    size: 'Large',
                    text: 'URGENT: Order Will Be Cancelled',
                    wrap: true,
                    color: 'Attention',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: `This order will be **automatically cancelled** in **${context?.timeUntilCancel || '24 hours'}** if no ${actionLabel} is received.`,
        wrap: true,
        spacing: 'Medium',
        weight: 'Bolder',
        color: 'Attention',
      },
      {
        type: 'TextBlock',
        text: `Total wait time: ${context?.waitDuration || '6+ days'}`,
        wrap: true,
        isSubtle: true,
      },
      {
        type: 'TextBlock',
        text: 'Please take action immediately to prevent cancellation.',
        wrap: true,
        spacing: 'Small',
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Take Action Now',
        style: 'positive',
        data: {
          action: 'view_pending_order',
          caseId: input.caseId,
          waitType: context?.waitType,
          urgent: true,
        },
      },
      {
        type: 'Action.Submit',
        title: 'Cancel Order',
        style: 'destructive',
        data: {
          action: 'cancel_order',
          caseId: input.caseId,
          reason: 'user_cancelled_before_timeout',
        },
      },
    ],
  };
}

/**
 * Generic card - fallback for unknown notification types
 */
function buildGenericCard(input: NotifyUserInput): Record<string, unknown> {
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        weight: 'Bolder',
        text: 'Order Processing Update',
      },
      {
        type: 'TextBlock',
        text: `Case: ${input.caseId}`,
        isSubtle: true,
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: `Status: ${input.type}`,
        wrap: true,
      },
    ],
  };
}
