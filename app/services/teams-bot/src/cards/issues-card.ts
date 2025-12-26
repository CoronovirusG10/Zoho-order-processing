/**
 * Issues card - shown when there are blocking issues
 * Enhanced with inline correction inputs for each issue
 */

import { IssueItem } from '../types/teams-types.js';
import { languageService, SupportedLanguage } from '../services/language-service.js';

/**
 * Issue categories for grouping
 */
type IssueCategory = 'customer' | 'item' | 'quantity' | 'sku' | 'gtin' | 'general';

/**
 * Extended issue with correction input metadata
 */
interface IssueWithInput extends IssueItem {
  inputId?: string;
  inputType?: 'text' | 'number' | 'choice';
  inputPlaceholder?: string;
  choices?: Array<{ title: string; value: string }>;
}

/**
 * Create an issues card with inline correction inputs
 * Each issue can have an associated input field for user corrections
 */
export function createIssuesCard(
  caseId: string,
  issues: IssueItem[],
  language: SupportedLanguage = 'en'
): any {
  const ls = languageService;

  // Build the card body
  const body: any[] = [
    // Header - bilingual
    {
      type: 'Container',
      items: [
        {
          type: 'TextBlock',
          weight: 'Bolder',
          size: 'Large',
          text: ls.getMessage('actionRequired', language),
          color: 'Attention',
        },
        {
          type: 'TextBlock',
          text: ls.getMessage('actionRequired', language === 'en' ? 'fa' : 'en'),
          isSubtle: true,
          size: 'Small',
        },
      ],
    },
    // Case ID
    {
      type: 'TextBlock',
      text: `${ls.getMessage('caseId', language)}: ${caseId}`,
      isSubtle: true,
      wrap: true,
      spacing: 'Small',
    },
    // Description - bilingual
    {
      type: 'TextBlock',
      text: ls.getMessage('issuesFound', language),
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: ls.getMessage('issuesFound', language === 'en' ? 'fa' : 'en'),
      isSubtle: true,
      size: 'Small',
      wrap: true,
    },
  ];

  // Group issues by severity and add inline inputs
  const blockers = issues.filter(i => i.severity === 'blocker');
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  // Add blocker issues with inputs
  if (blockers.length > 0) {
    body.push(createIssueCategorySection('blocker', blockers, caseId, language));
  }

  // Add error issues with inputs
  if (errors.length > 0) {
    body.push(createIssueCategorySection('error', errors, caseId, language));
  }

  // Add warning issues (no inputs needed)
  if (warnings.length > 0) {
    body.push(createWarningsSection(warnings, language));
  }

  // Add general notes input
  body.push({
    type: 'Container',
    spacing: 'Medium',
    items: [
      {
        type: 'TextBlock',
        text: language === 'en' ? 'Additional Notes' : 'یادداشت‌های اضافی',
        weight: 'Bolder',
      },
      {
        type: 'Input.Text',
        id: 'userNotes',
        isMultiline: true,
        placeholder: language === 'en'
          ? "Optional notes or corrections (e.g. 'customer is ACME Ltd')"
          : 'یادداشت‌ها یا اصلاحات اختیاری (مثلاً نام مشتری)',
      },
    ],
  });

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body,
    actions: [
      {
        type: 'Action.Submit',
        title: ls.getMessage('submitCorrections', language),
        style: 'positive',
        data: {
          action: 'submit_corrections',
          caseId,
        },
      },
      {
        type: 'Action.Submit',
        title: ls.getMessage('uploadRevised', language),
        data: {
          action: 'request_reupload',
          caseId,
        },
      },
    ],
  };
}

/**
 * Create a section for a category of issues (blockers or errors) with inline inputs
 */
function createIssueCategorySection(
  severity: 'blocker' | 'error',
  issues: IssueItem[],
  caseId: string,
  language: SupportedLanguage
): any {
  const icon = severity === 'blocker' ? '🚫' : '❌';
  const title = severity === 'blocker'
    ? (language === 'en' ? 'Blocking Issues' : 'مشکلات مسدودکننده')
    : (language === 'en' ? 'Errors' : 'خطاها');

  const items: any[] = [
    {
      type: 'TextBlock',
      text: `${icon} **${title}**`,
      wrap: true,
      weight: 'Bolder',
      color: severity === 'blocker' ? 'Attention' : 'Warning',
    },
  ];

  issues.forEach((issue, idx) => {
    const issueContainer = createIssueWithInput(issue, idx, caseId, language);
    items.push(issueContainer);
  });

  return {
    type: 'Container',
    spacing: 'Medium',
    style: severity === 'blocker' ? 'attention' : 'warning',
    items,
  };
}

/**
 * Create an issue item with inline correction input
 */
function createIssueWithInput(
  issue: IssueItem,
  index: number,
  caseId: string,
  language: SupportedLanguage
): any {
  const issueText = language === 'fa' && issue.messageFa ? issue.messageFa : issue.message;
  const inputId = `correction_${issue.code}_${index}`;
  const category = detectIssueCategory(issue);

  const items: any[] = [
    // Issue message
    {
      type: 'TextBlock',
      text: `${index + 1}. ${issueText}`,
      wrap: true,
      spacing: 'Small',
    },
  ];

  // Add bilingual hint if Farsi message available and language is English
  if (language === 'en' && issue.messageFa) {
    items.push({
      type: 'TextBlock',
      text: issue.messageFa,
      wrap: true,
      isSubtle: true,
      size: 'Small',
    });
  }

  // Add suggested action if available
  if (issue.suggestedUserAction) {
    items.push({
      type: 'TextBlock',
      text: `→ ${issue.suggestedUserAction}`,
      wrap: true,
      isSubtle: true,
      color: 'Good',
    });
  }

  // Add inline input based on issue category
  const inputElement = createInputForCategory(category, inputId, issue, language);
  if (inputElement) {
    items.push(inputElement);
  }

  return {
    type: 'Container',
    items,
    separator: index > 0,
    spacing: 'Small',
  };
}

/**
 * Create appropriate input element based on issue category
 */
function createInputForCategory(
  category: IssueCategory,
  inputId: string,
  issue: IssueItem,
  language: SupportedLanguage
): any | null {
  switch (category) {
    case 'customer':
      return {
        type: 'Input.Text',
        id: inputId,
        placeholder: language === 'en'
          ? 'Enter correct customer name'
          : 'نام صحیح مشتری را وارد کنید',
        spacing: 'Small',
      };

    case 'sku':
      return {
        type: 'Input.Text',
        id: inputId,
        placeholder: language === 'en'
          ? 'Enter correct SKU (e.g., ABC-123)'
          : 'کد محصول صحیح را وارد کنید',
        spacing: 'Small',
      };

    case 'gtin':
      return {
        type: 'Input.Text',
        id: inputId,
        placeholder: language === 'en'
          ? 'Enter correct GTIN/barcode'
          : 'بارکد صحیح را وارد کنید',
        spacing: 'Small',
      };

    case 'quantity':
      return {
        type: 'Input.Number',
        id: inputId,
        placeholder: language === 'en'
          ? 'Enter correct quantity'
          : 'مقدار صحیح را وارد کنید',
        min: 0,
        spacing: 'Small',
      };

    case 'item':
      return {
        type: 'Input.Text',
        id: inputId,
        placeholder: language === 'en'
          ? 'Enter item correction or select from Zoho'
          : 'اصلاح کالا را وارد کنید',
        spacing: 'Small',
      };

    default:
      return null;
  }
}

/**
 * Detect the category of an issue based on its code and fields
 */
function detectIssueCategory(issue: IssueItem): IssueCategory {
  const code = issue.code.toLowerCase();
  const fields = (issue.fields || []).map(f => f.toLowerCase());

  if (code.includes('customer') || fields.some(f => f.includes('customer'))) {
    return 'customer';
  }

  if (code.includes('sku') || fields.some(f => f.includes('sku'))) {
    return 'sku';
  }

  if (code.includes('gtin') || code.includes('barcode') || fields.some(f => f.includes('gtin'))) {
    return 'gtin';
  }

  if (code.includes('qty') || code.includes('quantity') || fields.some(f => f.includes('quantity'))) {
    return 'quantity';
  }

  if (code.includes('item') || code.includes('product') || fields.some(f => f.includes('item'))) {
    return 'item';
  }

  return 'general';
}

/**
 * Create warnings section (informational only, no inputs)
 */
function createWarningsSection(warnings: IssueItem[], language: SupportedLanguage): any {
  const items: any[] = [
    {
      type: 'TextBlock',
      text: language === 'en' ? '⚠️ **Warnings**' : '⚠️ **هشدارها**',
      wrap: true,
      weight: 'Bolder',
    },
  ];

  warnings.forEach((warning, idx) => {
    const text = language === 'fa' && warning.messageFa ? warning.messageFa : warning.message;
    items.push({
      type: 'TextBlock',
      text: `${idx + 1}. ${text}`,
      wrap: true,
      isSubtle: true,
    });
  });

  return {
    type: 'Container',
    spacing: 'Medium',
    items,
  };
}

/**
 * Create a formula blocked card (special case of issues card)
 */
export function createFormulaBlockedCard(
  caseId: string,
  fileName: string,
  formulaCount: number,
  language: SupportedLanguage = 'en'
): any {
  const ls = languageService;

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
                items: [
                  {
                    type: 'TextBlock',
                    text: '🚫',
                    size: 'ExtraLarge',
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
                    size: 'Large',
                    text: ls.getMessage('formulaBlocked', language),
                    wrap: true,
                    color: 'Attention',
                  },
                  {
                    type: 'TextBlock',
                    text: ls.getMessage('formulaBlocked', language === 'en' ? 'fa' : 'en'),
                    isSubtle: true,
                    size: 'Small',
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
        text: `${ls.getMessage('caseId', language)}: ${caseId}`,
        isSubtle: true,
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'FactSet',
        facts: [
          {
            title: ls.getMessage('file', language),
            value: fileName,
          },
          {
            title: language === 'en' ? 'Formulas detected' : 'فرمول‌های شناسایی شده',
            value: String(formulaCount),
          },
        ],
      },
      {
        type: 'TextBlock',
        text: ls.getMessage('formulaBlockedDetail', language),
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: ls.getMessage('formulaBlockedDetail', language === 'en' ? 'fa' : 'en'),
        wrap: true,
        isSubtle: true,
        size: 'Small',
      },
      {
        type: 'Container',
        style: 'emphasis',
        spacing: 'Medium',
        items: [
          {
            type: 'TextBlock',
            text: language === 'en'
              ? '**How to export as values-only:**'
              : '**نحوه ذخیره به صورت مقادیر:**',
            weight: 'Bolder',
          },
          {
            type: 'TextBlock',
            text: language === 'en'
              ? '1. Open in Excel\n2. Select all cells (Ctrl+A)\n3. Copy (Ctrl+C)\n4. Paste Special → Values only\n5. Save as new file'
              : '1. فایل را در اکسل باز کنید\n2. همه سلول‌ها را انتخاب کنید\n3. کپی کنید\n4. Paste Special → Values only\n5. به عنوان فایل جدید ذخیره کنید',
            wrap: true,
            size: 'Small',
          },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: ls.getMessage('uploadRevised', language),
        style: 'positive',
        data: {
          action: 'request_reupload',
          caseId,
          reason: 'formula_blocked',
        },
      },
    ],
  };
}

// Legacy function for backward compatibility
function formatIssuesList(issues: IssueItem[]): string {
  const lines: string[] = [];

  // Group by severity
  const blockers = issues.filter(i => i.severity === 'blocker');
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (blockers.length > 0) {
    lines.push('**Blocking Issues:**');
    blockers.forEach((issue, idx) => {
      lines.push(`${idx + 1}. ${issue.message}`);
      if (issue.suggestedUserAction) {
        lines.push(`   → ${issue.suggestedUserAction}`);
      }
    });
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push('**Errors:**');
    errors.forEach((issue, idx) => {
      lines.push(`${idx + 1}. ${issue.message}`);
      if (issue.suggestedUserAction) {
        lines.push(`   → ${issue.suggestedUserAction}`);
      }
    });
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('**Warnings:**');
    warnings.forEach((issue, idx) => {
      lines.push(`${idx + 1}. ${issue.message}`);
    });
  }

  return lines.join('\n');
}
