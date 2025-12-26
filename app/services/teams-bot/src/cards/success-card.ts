/**
 * Success card - shown when order is created in Zoho
 */

import { buildCard } from './card-builder.js';
import { ZohoCreationResult } from '../types/teams-types.js';

const SUCCESS_TEMPLATE = {
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
              items: [
                {
                  type: 'TextBlock',
                  text: '✅',
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
      text: 'Case: ${caseId}',
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
          text: '⚠️ **Important:** This is a DRAFT order. Please review in Zoho Books and confirm before sending to customer.',
          wrap: true,
          weight: 'Bolder',
        },
      ],
      spacing: 'Medium',
    },
    {
      type: 'FactSet',
      facts: [
        {
          title: 'Zoho Sales Order',
          value: '${salesorderNumber}',
        },
        {
          title: 'Status',
          value: '${status}',
        },
      ],
      spacing: 'Medium',
    },
  ],
  actions: [
    {
      type: 'Action.OpenUrl',
      title: 'View in Zoho Books',
      url: '${zohoUrl}',
    },
    {
      type: 'Action.OpenUrl',
      title: 'Download Audit Bundle',
      url: '${auditUrl}',
    },
  ],
};

export function createSuccessCard(
  caseId: string,
  result: ZohoCreationResult,
  auditBundleUrl: string
): any {
  return buildCard(SUCCESS_TEMPLATE, {
    caseId,
    salesorderNumber: result.salesorderNumber,
    status: result.status,
    zohoUrl: result.url,
    auditUrl: auditBundleUrl,
  });
}
