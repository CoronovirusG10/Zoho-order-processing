/**
 * Provider selection utilities
 *
 * Handles random selection of providers from the pool with diversity constraints.
 */

import { BaseProvider } from './base-provider';

/**
 * Provider family classification
 * Used to ensure diversity in provider selection
 */
export type ProviderFamily = 'openai' | 'anthropic' | 'deepseek' | 'google' | 'xai';

/**
 * Map provider IDs to their families
 */
const PROVIDER_FAMILIES: Record<string, ProviderFamily> = {
  // OpenAI family
  'azure-gpt-5.1': 'openai',
  'azure-gpt-5.2': 'openai',
  'azure-gpt-4.1': 'openai',

  // Anthropic family
  'azure-claude-opus-4.5': 'anthropic',
  'azure-claude-sonnet-4.5': 'anthropic',

  // DeepSeek family
  'azure-deepseek-v3.2': 'deepseek',

  // Google family
  'gemini-2.5-pro': 'google',

  // xAI family
  'xai-grok-4-reasoning': 'xai',
};

/**
 * Get the family for a provider ID
 */
export function getProviderFamily(providerId: string): ProviderFamily | undefined {
  return PROVIDER_FAMILIES[providerId];
}

/**
 * Selection options for provider selection
 */
export interface SelectionOptions {
  /**
   * Number of providers to select
   */
  count: number;

  /**
   * Pool of provider IDs to select from
   */
  pool: string[];

  /**
   * Whether to enforce diversity (no two providers from same family)
   * Default: true
   */
  enforceDiversity?: boolean;

  /**
   * Optional seed for reproducible random selection (testing)
   */
  seed?: number;
}

/**
 * Selection result
 */
export interface SelectionResult {
  selectedIds: string[];
  families: ProviderFamily[];
  diversityMet: boolean;
  skippedDueToFamily: string[];
}

/**
 * Select providers with optional diversity enforcement
 *
 * @param providers - Map of provider ID to provider instance
 * @param options - Selection options
 * @returns Selected providers and metadata
 */
export function selectProviders(
  providers: Map<string, BaseProvider>,
  options: SelectionOptions
): SelectionResult {
  const { count, pool, enforceDiversity = true } = options;

  // Filter to available providers from pool
  const availableIds = pool.filter((id) => providers.has(id));

  if (availableIds.length < count) {
    throw new Error(
      `Not enough enabled providers. Requested: ${count}, Available: ${availableIds.length}`
    );
  }

  // Shuffle available providers
  const shuffled = shuffleArray([...availableIds], options.seed);

  const selected: string[] = [];
  const families: ProviderFamily[] = [];
  const skippedDueToFamily: string[] = [];
  const usedFamilies = new Set<ProviderFamily>();

  for (const providerId of shuffled) {
    if (selected.length >= count) {
      break;
    }

    const family = getProviderFamily(providerId);

    // Check diversity constraint
    if (enforceDiversity && family && usedFamilies.has(family)) {
      skippedDueToFamily.push(providerId);
      continue;
    }

    selected.push(providerId);
    if (family) {
      families.push(family);
      usedFamilies.add(family);
    }
  }

  // If we couldn't get enough providers with diversity, relax the constraint
  if (selected.length < count && skippedDueToFamily.length > 0) {
    const remaining = count - selected.length;
    selected.push(...skippedDueToFamily.slice(0, remaining));
  }

  if (selected.length < count) {
    throw new Error(
      `Could not select ${count} providers. Only found ${selected.length}`
    );
  }

  return {
    selectedIds: selected,
    families,
    diversityMet: usedFamilies.size === selected.length,
    skippedDueToFamily,
  };
}

/**
 * Fisher-Yates shuffle with optional seed
 */
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const result = [...array];
  const random = seed !== undefined ? seededRandom(seed) : Math.random;

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Simple seeded random for reproducible testing
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Get recommended diverse provider pool
 *
 * Returns one provider from each family for maximum diversity
 */
export function getDiverseProviderPool(): string[] {
  return [
    'azure-gpt-5.1',         // OpenAI
    'azure-claude-opus-4.5', // Anthropic
    'azure-deepseek-v3.2',   // DeepSeek
    'gemini-2.5-pro',        // Google
    'xai-grok-4-reasoning',  // xAI
  ];
}

/**
 * Check if a selection is diverse (no family duplicates)
 */
export function isSelectionDiverse(providerIds: string[]): boolean {
  const families = new Set<ProviderFamily>();

  for (const id of providerIds) {
    const family = getProviderFamily(id);
    if (family) {
      if (families.has(family)) {
        return false;
      }
      families.add(family);
    }
  }

  return true;
}

/**
 * Register a new provider's family mapping
 * Useful for custom providers
 */
export function registerProviderFamily(providerId: string, family: ProviderFamily): void {
  PROVIDER_FAMILIES[providerId] = family;
}
