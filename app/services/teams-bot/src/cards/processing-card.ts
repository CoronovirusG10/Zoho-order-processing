/**
 * Processing card - shown while parsing/validating
 */

import { buildCard } from './card-builder.js';

const PROCESSING_TEMPLATE = {
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
      text: 'Case: ${caseId}',
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
        {
          title: 'File',
          value: '${fileName}',
        },
        {
          title: 'Correlation ID',
          value: '${correlationId}',
        },
        {
          title: 'Status',
          value: '${status}',
        },
      ],
      spacing: 'Medium',
    },
  ],
};

export function createProcessingCard(
  caseId: string,
  fileName: string,
  correlationId: string,
  status: string = 'Analyzing spreadsheet...'
): any {
  return buildCard(PROCESSING_TEMPLATE, {
    caseId,
    fileName,
    correlationId,
    status,
  });
}
