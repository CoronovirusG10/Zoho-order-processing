/**
 * Provider weights configuration
 *
 * Weights are used in weighted voting aggregation.
 * Higher weights indicate more trusted/accurate providers.
 */

/**
 * Default provider weights
 * These should be calibrated using golden files
 */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  // Azure GPT models (generally strong at schema mapping)
  'azure-gpt-5.1': 1.1,
  'azure-gpt-5.2': 1.15, // Latest model, slightly higher weight
  'azure-gpt-4.1': 1.0,

  // Azure Claude models (excellent at following constraints)
  'azure-claude-opus-4.5': 1.2, // Strongest Claude model
  'azure-claude-sonnet-4.5': 1.1,

  // Azure DeepSeek (good reasoning)
  'azure-deepseek-v3.2': 1.0,

  // Google Gemini (strong multilingual)
  'gemini-2.5-pro': 1.05,

  // xAI Grok (good at reasoning tasks)
  'xai-grok-4-reasoning': 1.0,
};

/**
 * Load weights from storage or use defaults
 *
 * Priority:
 * 1. Environment variable COMMITTEE_WEIGHTS_FILE pointing to config file
 * 2. Default calibrated-weights.json in config directory
 * 3. DEFAULT_WEIGHTS constant
 *
 * In production, weights should be loaded from a configuration store
 * that is updated by the calibration process.
 */
export function loadWeights(): Record<string, number> {
  // Try to load from environment-specified file
  const envFile = process.env.COMMITTEE_WEIGHTS_FILE;
  if (envFile) {
    try {
      const { loadWeightsFromFile } = require('./weights-file');
      const weights = loadWeightsFromFile(envFile);
      if (weights) {
        console.log(`Loaded weights from ${envFile}`);
        return weights;
      }
    } catch {
      // Fall through to defaults
    }
  }

  // Try to load from default config file
  try {
    const { loadWeightsFromFile, getDefaultWeightFilePath } = require('./weights-file');
    const defaultPath = getDefaultWeightFilePath();
    const weights = loadWeightsFromFile(defaultPath);
    if (weights) {
      console.log(`Loaded weights from ${defaultPath}`);
      return weights;
    }
  } catch {
    // Fall through to defaults
  }

  // Use hardcoded defaults
  return { ...DEFAULT_WEIGHTS };
}

/**
 * Save calibrated weights
 *
 * @param weights - Updated weights from calibration
 */
export async function saveWeights(weights: Record<string, number>): Promise<void> {
  // TODO: Save to Azure App Configuration or similar
  console.log('Saving weights:', weights);
  // In production, this would write to a persistent store
}

/**
 * Calculate normalized weights
 *
 * Ensures all weights sum to the number of providers
 */
export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const providerIds = Object.keys(weights);
  const totalWeight = providerIds.reduce((sum, id) => sum + weights[id], 0);

  if (totalWeight === 0) {
    // All weights are zero, return uniform weights
    return Object.fromEntries(providerIds.map((id) => [id, 1.0]));
  }

  const normalized: Record<string, number> = {};
  for (const id of providerIds) {
    normalized[id] = (weights[id] / totalWeight) * providerIds.length;
  }

  return normalized;
}

/**
 * Get weight for a specific provider
 */
export function getProviderWeight(providerId: string, weights?: Record<string, number>): number {
  const allWeights = weights || loadWeights();
  return allWeights[providerId] || 1.0; // Default to 1.0 if not found
}
