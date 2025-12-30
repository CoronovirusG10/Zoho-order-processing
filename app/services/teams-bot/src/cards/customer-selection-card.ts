/**
 * Customer Selection Card
 *
 * Adaptive card for customer disambiguation when multiple matches are found.
 * Presents candidate customers with match scores for user selection.
 */

import { languageService, SupportedLanguage } from '../services/language-service.js';

/**
 * Customer candidate from Zoho matching
 */
export interface CustomerCandidate {
  zohoCustomerId: string;
  name: string;
  email?: string;
  phone?: string;
  score: number;
  matchReasons?: string[];
}

/**
 * Props for creating a customer selection card
 */
export interface CustomerSelectionCardProps {
  caseId: string;
  tenantId: string;
  workflowId: string;
  extractedName: string;
  candidates: CustomerCandidate[];
  language?: SupportedLanguage;
}

/**
 * Create an adaptive card for customer selection
 *
 * @param props - Card configuration including candidates
 * @returns Adaptive card JSON object
 */
export function createCustomerSelectionCard(props: CustomerSelectionCardProps): object {
  const {
    caseId,
    tenantId,
    workflowId,
    extractedName,
    candidates,
    language = 'en',
  } = props;

  const ls = languageService;

  // Build choice items with detailed info
  const choices = candidates.map((candidate) => {
    const matchPercent = Math.round(candidate.score * 100);
    const details: string[] = [];

    if (candidate.email) {
      details.push(candidate.email);
    }
    if (candidate.phone) {
      details.push(candidate.phone);
    }

    const detailStr = details.length > 0 ? ` - ${details.join(', ')}` : '';
    const title = `${candidate.name} (${matchPercent}% match)${detailStr}`;

    return {
      title,
      value: JSON.stringify({
        id: candidate.zohoCustomerId,
        name: candidate.name,
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
                    ? 'Customer Selection Required'
                    : 'انتخاب مشتری لازم است',
                  wrap: true,
                },
                {
                  type: 'TextBlock',
                  text: language === 'en'
                    ? 'انتخاب مشتری لازم است'
                    : 'Customer Selection Required',
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
    // Description
    {
      type: 'TextBlock',
      text: language === 'en'
        ? `Multiple matches found for customer: **"${extractedName}"**`
        : `چند مورد مطابق برای مشتری پیدا شد: **"${extractedName}"**`,
      wrap: true,
      spacing: 'Medium',
    },
    {
      type: 'TextBlock',
      text: language === 'en'
        ? 'Please select the correct customer from the options below:'
        : 'لطفا مشتری صحیح را از گزینه های زیر انتخاب کنید:',
      wrap: true,
      spacing: 'Small',
    },
    // Customer selection
    {
      type: 'Container',
      style: 'emphasis',
      spacing: 'Medium',
      items: [
        {
          type: 'Input.ChoiceSet',
          id: 'selectedCustomerId',
          style: 'expanded',
          isRequired: true,
          errorMessage: language === 'en'
            ? 'Please select a customer'
            : 'لطفا یک مشتری انتخاب کنید',
          choices,
        },
      ],
    },
  ];

  // Add match reasons if available for first candidate
  if (candidates.length > 0 && candidates[0].matchReasons && candidates[0].matchReasons.length > 0) {
    body.push({
      type: 'Container',
      spacing: 'Medium',
      items: [
        {
          type: 'TextBlock',
          text: language === 'en' ? 'Match Details:' : 'جزئیات تطابق:',
          weight: 'Bolder',
          size: 'Small',
        },
        {
          type: 'TextBlock',
          text: candidates[0].matchReasons.join(', '),
          isSubtle: true,
          size: 'Small',
          wrap: true,
        },
      ],
    });
  }

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body,
    actions: [
      {
        type: 'Action.Submit',
        title: language === 'en' ? 'Select Customer' : 'انتخاب مشتری',
        style: 'positive',
        data: {
          action: 'select_customer',
          caseId,
          tenantId,
          workflowId,
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
          selectionType: 'customer',
        },
      },
    ],
  };
}
