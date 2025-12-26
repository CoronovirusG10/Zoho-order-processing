/**
 * Review card - shown when order is ready for approval
 */

import { buildCard } from './card-builder.js';
import { OrderReview } from '../types/teams-types.js';

const REVIEW_TEMPLATE = {
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
      text: 'Case: ${caseId}',
      isSubtle: true,
      wrap: true,
    },
    {
      type: 'FactSet',
      facts: [
        {
          title: 'Customer',
          value: '${customerName}',
        },
        {
          title: 'Line items',
          value: '${lineItemCount}',
        },
        {
          title: 'Total (source)',
          value: '${totalSource}',
        },
        {
          title: 'Total (Zoho pricing)',
          value: '${totalZoho}',
        },
      ],
    },
    {
      type: 'TextBlock',
      text: 'Warnings / Ambiguities',
      weight: 'Bolder',
      spacing: 'Medium',
    },
    {
      type: 'TextBlock',
      text: '${warnings}',
      wrap: true,
      isSubtle: true,
    },
  ],
  actions: [
    {
      type: 'Action.Submit',
      title: 'Approve & Create Draft in Zoho',
      data: {
        action: 'approve_create',
        caseId: '${caseId}',
      },
    },
    {
      type: 'Action.Submit',
      title: 'Request Changes',
      data: {
        action: 'request_changes',
        caseId: '${caseId}',
      },
    },
  ],
};

export function createReviewCard(review: OrderReview): any {
  const warnings = review.warnings.length > 0
    ? review.warnings.join('\n')
    : 'No warnings';

  return buildCard(REVIEW_TEMPLATE, {
    caseId: review.caseId,
    customerName: review.customerName,
    lineItemCount: String(review.lineItemCount),
    totalSource: review.totalSource,
    totalZoho: review.totalZoho,
    warnings,
  });
}
