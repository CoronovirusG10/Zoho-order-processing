/**
 * Item Selection Card
 *
 * Adaptive card for item disambiguation when multiple matches are found.
 * Presents candidate items with match scores and pricing for user selection.
 */

import { languageService, SupportedLanguage } from '../services/language-service.js';

/**
 * Item candidate from Zoho catalog matching
 */
export interface ItemCandidate {
  zohoItemId: string;
  name: string;
  sku?: string;
  gtin?: string;
  rate: number;
  score: number;
  matchReasons?: string[];
}

/**
 * Props for creating an item selection card
 */
export interface ItemSelectionCardProps {
  caseId: string;
  tenantId: string;
  workflowId: string;
  lineRow: number;
  extractedDescription: string;
  quantity: number;
  candidates: ItemCandidate[];
  language?: SupportedLanguage;
}

/**
 * Create an adaptive card for item selection
 *
 * @param props - Card configuration including candidates
 * @returns Adaptive card JSON object
 */
export function createItemSelectionCard(props: ItemSelectionCardProps): object {
  const {
    caseId,
    tenantId,
    workflowId,
    lineRow,
    extractedDescription,
    quantity,
    candidates,
    language = 'en',
  } = props;

  const ls = languageService;

  // Format currency for display
  const formatPrice = (rate: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(rate);
  };

  // Build choice items with detailed info
  const choices = candidates.map((candidate) => {
    const matchPercent = Math.round(candidate.score * 100);
    const details: string[] = [];

    if (candidate.sku) {
      details.push(`SKU: ${candidate.sku}`);
    }
    if (candidate.gtin) {
      details.push(`GTIN: ${candidate.gtin}`);
    }

    const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
    const priceStr = formatPrice(candidate.rate);
    const title = `${candidate.name}${detailStr} - ${priceStr} (${matchPercent}% match)`;

    return {
      title,
      value: JSON.stringify({
        id: candidate.zohoItemId,
        name: candidate.name,
        rate: candidate.rate,
        sku: candidate.sku,
      }),
    };
  });

  // Build the card body
  const body: object[] = [
    // Header
    {
      type: 'Container',
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
                  text: '🔍',
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
                  text: language === 'en'
                    ? `Item Selection Required (Row ${lineRow})`
                    : `انتخاب کالا لازم است (ردیف ${lineRow})`,
                  wrap: true,
                },
                {
                  type: 'TextBlock',
                  text: language === 'en'
                    ? `انتخاب کالا لازم است (ردیف ${lineRow})`
                    : `Item Selection Required (Row ${lineRow})`,
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
    // Case ID
    {
      type: 'TextBlock',
      text: `${ls.getMessage('caseId', language)}: ${caseId}`,
      isSubtle: true,
      wrap: true,
      spacing: 'Small',
    },
    // Description of what was extracted
    {
      type: 'FactSet',
      spacing: 'Medium',
      facts: [
        {
          title: language === 'en' ? 'Original description' : 'توضیحات اصلی',
          value: extractedDescription,
        },
        {
          title: language === 'en' ? 'Quantity' : 'تعداد',
          value: String(quantity),
        },
      ],
    },
    // Instruction
    {
      type: 'TextBlock',
      text: language === 'en'
        ? 'Please select the correct item from the Zoho catalog:'
        : 'لطفا کالای صحیح را از کاتالوگ Zoho انتخاب کنید:',
      wrap: true,
      spacing: 'Medium',
    },
    // Item selection
    {
      type: 'Container',
      style: 'emphasis',
      spacing: 'Medium',
      items: [
        {
          type: 'Input.ChoiceSet',
          id: 'selectedItemId',
          style: 'expanded',
          isRequired: true,
          errorMessage: language === 'en'
            ? 'Please select an item'
            : 'لطفا یک کالا انتخاب کنید',
          choices,
        },
      ],
    },
  ];

  // Add note about pricing
  body.push({
    type: 'TextBlock',
    text: language === 'en'
      ? '* Prices shown are from Zoho catalog. Final pricing may vary based on customer-specific agreements.'
      : '* قیمت‌های نمایش داده شده از کاتالوگ Zoho هستند. قیمت نهایی ممکن است بر اساس توافقات مشتری متفاوت باشد.',
    isSubtle: true,
    size: 'Small',
    wrap: true,
    spacing: 'Medium',
  });

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body,
    actions: [
      {
        type: 'Action.Submit',
        title: language === 'en' ? 'Select Item' : 'انتخاب کالا',
        style: 'positive',
        data: {
          action: 'select_item',
          caseId,
          tenantId,
          workflowId,
          lineRow,
        },
      },
      {
        type: 'Action.Submit',
        title: language === 'en' ? 'Skip This Line' : 'رد کردن این ردیف',
        data: {
          action: 'skip_item',
          caseId,
          tenantId,
          workflowId,
          lineRow,
        },
      },
    ],
  };
}

/**
 * Create a batch item selection card for multiple unresolved items
 *
 * @param props - Configuration with multiple line items
 * @returns Adaptive card JSON object
 */
export function createBatchItemSelectionCard(props: {
  caseId: string;
  tenantId: string;
  workflowId: string;
  unresolvedItems: Array<{
    lineRow: number;
    extractedDescription: string;
    quantity: number;
    candidates: ItemCandidate[];
  }>;
  language?: SupportedLanguage;
}): object {
  const { caseId, tenantId, workflowId, unresolvedItems, language = 'en' } = props;
  const ls = languageService;

  // Build body with all unresolved items
  const body: object[] = [
    // Header
    {
      type: 'Container',
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
                  text: '🔍',
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
                  text: language === 'en'
                    ? `Item Selection Required (${unresolvedItems.length} items)`
                    : `انتخاب کالا لازم است (${unresolvedItems.length} مورد)`,
                  wrap: true,
                },
              ],
            },
          ],
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
    // Instruction
    {
      type: 'TextBlock',
      text: language === 'en'
        ? 'The following items could not be automatically matched. Please select the correct items:'
        : 'موارد زیر به صورت خودکار مطابقت نیافتند. لطفا کالاهای صحیح را انتخاب کنید:',
      wrap: true,
      spacing: 'Medium',
    },
  ];

  // Add each unresolved item
  unresolvedItems.forEach((item, index) => {
    const formatPrice = (rate: number): string => {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(rate);
    };

    const choices = item.candidates.map((candidate) => {
      const matchPercent = Math.round(candidate.score * 100);
      const skuStr = candidate.sku ? ` (SKU: ${candidate.sku})` : '';
      const priceStr = formatPrice(candidate.rate);
      return {
        title: `${candidate.name}${skuStr} - ${priceStr} (${matchPercent}%)`,
        value: JSON.stringify({
          id: candidate.zohoItemId,
          name: candidate.name,
          rate: candidate.rate,
        }),
      };
    });

    // Add "Skip" option
    choices.push({
      title: language === 'en' ? '(Skip this line)' : '(رد کردن این ردیف)',
      value: JSON.stringify({ skip: true }),
    });

    body.push({
      type: 'Container',
      style: index % 2 === 0 ? 'default' : 'emphasis',
      spacing: 'Medium',
      separator: index > 0,
      items: [
        {
          type: 'TextBlock',
          text: `**Row ${item.lineRow}:** ${item.extractedDescription} (Qty: ${item.quantity})`,
          wrap: true,
        },
        {
          type: 'Input.ChoiceSet',
          id: `selectedItem_${item.lineRow}`,
          style: 'compact',
          isRequired: true,
          choices,
        },
      ],
    });
  });

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body,
    actions: [
      {
        type: 'Action.Submit',
        title: language === 'en' ? 'Submit Selections' : 'ارسال انتخاب‌ها',
        style: 'positive',
        data: {
          action: 'submit_item_selections',
          caseId,
          tenantId,
          workflowId,
          lineRows: unresolvedItems.map(i => i.lineRow),
        },
      },
      {
        type: 'Action.Submit',
        title: language === 'en' ? 'Cancel' : 'لغو',
        data: {
          action: 'cancel_selection',
          caseId,
          tenantId,
          workflowId,
          selectionType: 'items',
        },
      },
    ],
  };
}
