/**
 * Cards Index
 *
 * Re-exports all adaptive card creation functions for the Teams bot.
 */

// Card builder utilities
export { buildCard, replaceVariables } from './card-builder.js';

// Status cards
export { createProcessingCard } from './processing-card.js';
export { createReviewCard } from './review-card.js';
export { createSuccessCard } from './success-card.js';

// Issue cards
export { createIssuesCard, createFormulaBlockedCard } from './issues-card.js';

// Selection cards for disambiguation
export {
  createCustomerSelectionCard,
  type CustomerCandidate,
  type CustomerSelectionCardProps,
} from './customer-selection-card.js';

export {
  createItemSelectionCard,
  createBatchItemSelectionCard,
  type ItemCandidate,
  type ItemSelectionCardProps,
} from './item-selection-card.js';

// Cancel confirmation card
export { createCancelConfirmationCard } from './cancel-confirmation-card.js';
