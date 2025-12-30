/**
 * Cancel Confirmation Card
 *
 * Adaptive card for confirming order cancellation.
 * Displays case details and provides confirm/dismiss actions.
 */

import { SupportedLanguage } from '../services/language-service.js';
import { CaseDocument } from '../services/case-service.js';

/**
 * Status display mapping for English
 */
const statusDisplayEn: Record<string, string> = {
  storing_file: 'Uploading',
  parsing: 'Analyzing',
  running_committee: 'AI Review',
  awaiting_corrections: 'Needs Corrections',
  resolving_customer: 'Matching Customer',
  awaiting_customer_selection: 'Select Customer',
  resolving_items: 'Matching Items',
  awaiting_item_selection: 'Select Items',
  awaiting_approval: 'Ready for Approval',
  creating_zoho_draft: 'Creating Order',
  queued_for_zoho: 'Queued',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

/**
 * Status display mapping for Farsi
 */
const statusDisplayFa: Record<string, string> = {
  storing_file: 'در حال آپلود',
  parsing: 'در حال تجزیه',
  running_committee: 'بررسی هوش مصنوعی',
  awaiting_corrections: 'نیاز به اصلاح',
  resolving_customer: 'تطبیق مشتری',
  awaiting_customer_selection: 'انتخاب مشتری',
  resolving_items: 'تطبیق اقلام',
  awaiting_item_selection: 'انتخاب اقلام',
  awaiting_approval: 'آماده تأیید',
  creating_zoho_draft: 'ایجاد سفارش',
  queued_for_zoho: 'در صف',
  completed: 'تکمیل شده',
  cancelled: 'لغو شده',
  failed: 'ناموفق',
};

/**
 * Get localized status display
 */
function getStatusDisplay(status: string, language: SupportedLanguage): string {
  const map = language === 'fa' ? statusDisplayFa : statusDisplayEn;
  return map[status] || status;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string, language: SupportedLanguage): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  const locale = language === 'fa' ? 'fa-IR' : 'en-US';
  return date.toLocaleDateString(locale, options);
}

/**
 * Create a cancel confirmation adaptive card
 *
 * @param caseId - The case ID to cancel
 * @param caseData - Full case document from Cosmos DB
 * @param language - Display language
 * @returns Adaptive card JSON object
 */
export function createCancelConfirmationCard(
  caseId: string,
  caseData: CaseDocument,
  language: SupportedLanguage = 'en'
): object {
  const isRtl = language === 'fa';

  // Localized strings
  const strings = language === 'fa'
    ? {
        title: 'لغو سفارش',
        confirmQuestion: `آیا مطمئن هستید که می‌خواهید سفارش ${caseId} را لغو کنید؟`,
        warning: 'این عملیات قابل بازگشت نیست.',
        fileLabel: 'فایل',
        statusLabel: 'وضعیت',
        createdLabel: 'ایجاد شده',
        customerLabel: 'مشتری',
        confirmButton: 'بله، لغو کن',
        dismissButton: 'خیر، نگه دار',
      }
    : {
        title: 'Cancel Order',
        confirmQuestion: `Are you sure you want to cancel order ${caseId}?`,
        warning: 'This action cannot be undone.',
        fileLabel: 'File',
        statusLabel: 'Status',
        createdLabel: 'Created',
        customerLabel: 'Customer',
        confirmButton: 'Yes, Cancel',
        dismissButton: 'No, Keep',
      };

  // Build facts array
  const facts: Array<{ title: string; value: string }> = [
    {
      title: strings.fileLabel,
      value: caseData.fileName || 'Unknown',
    },
    {
      title: strings.statusLabel,
      value: getStatusDisplay(caseData.status, language),
    },
    {
      title: strings.createdLabel,
      value: formatDate(caseData.createdAt, language),
    },
  ];

  // Add customer name if available
  if (caseData.zohoCustomerName) {
    facts.push({
      title: strings.customerLabel,
      value: caseData.zohoCustomerName,
    });
  }

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: strings.title,
        weight: 'Bolder',
        size: 'Medium',
        color: 'Attention',
        horizontalAlignment: isRtl ? 'Right' : 'Left',
      },
      {
        type: 'TextBlock',
        text: strings.confirmQuestion,
        wrap: true,
        horizontalAlignment: isRtl ? 'Right' : 'Left',
      },
      {
        type: 'TextBlock',
        text: strings.warning,
        wrap: true,
        isSubtle: true,
        size: 'Small',
        horizontalAlignment: isRtl ? 'Right' : 'Left',
      },
      {
        type: 'Container',
        separator: true,
        spacing: 'Medium',
        items: [
          {
            type: 'FactSet',
            facts,
          },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: strings.confirmButton,
        style: 'destructive',
        data: {
          action: 'confirm_cancel',
          caseId,
          tenantId: caseData.tenantId,
          workflowId: `order-processing-${caseId}`, // Standard workflow ID format
        },
      },
      {
        type: 'Action.Submit',
        title: strings.dismissButton,
        data: {
          action: 'dismiss',
          caseId,
        },
      },
    ],
  };
}
