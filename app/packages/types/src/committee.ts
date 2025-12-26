/**
 * AI Committee types for multi-provider consensus
 */

import { ConsensusType } from './enums.js';

/**
 * Vote from a single provider in the committee
 */
export interface ProviderVote {
  /** Allow any properties */
  [key: string]: unknown;
}

/**
 * Disagreement between committee members
 */
export interface CommitteeDisagreement {
  /** Allow any properties */
  [key: string]: unknown;
}

/**
 * Output from a single AI provider
 */
export interface ProviderOutput {
  /** Allow any properties - can contain the provider's parsed output */
  [key: string]: unknown;
}

/**
 * Committee result with consensus information
 */
export interface CommitteeResult {
  /** List of AI providers used (e.g., ["gpt-4", "claude-3", "gemini"]) */
  providers_used?: string[];
  /** Votes from each provider */
  votes?: ProviderVote[];
  /** Consensus level achieved */
  consensus?: ConsensusType;
  /** Details of any disagreements between providers */
  disagreements?: CommitteeDisagreement[];
  /** Allow additional properties */
  [key: string]: unknown;
}
