/**
 * Committee Engine - Public API
 *
 * Multi-provider AI committee for schema mapping validation
 */

// Core engine
export { CommitteeEngine, createDefaultConfig } from './engine';

// Provider factory
export { ProviderFactory } from './providers/provider-factory';

// Provider selection utilities
export {
  selectProviders,
  getProviderFamily,
  getDiverseProviderPool,
  isSelectionDiverse,
  registerProviderFamily,
} from './providers/selection';
export type { ProviderFamily, SelectionOptions, SelectionResult } from './providers/selection';

// Provider implementations (for direct use if needed)
export { BaseProvider } from './providers/base-provider';
export { AzureOpenAIProvider } from './providers/azure-openai-provider';
export { AzureAnthropicProvider } from './providers/azure-anthropic-provider';
export { AzureDeepSeekProvider } from './providers/azure-deepseek-provider';
export { GeminiProvider } from './providers/gemini-provider';
export { XAIProvider } from './providers/xai-provider';

// Configuration
export {
  getDefaultProviderConfigs,
  getRecommendedProviderPool,
  validateProviderConfig,
} from './config/provider-config';
export {
  DEFAULT_WEIGHTS,
  loadWeights,
  saveWeights,
  normalizeWeights,
  getProviderWeight,
} from './config/weights';
export {
  loadWeightsFromFile,
  saveCalibrationResults,
  formatWeightSummary,
  getDefaultWeightFilePath,
  validateWeightConfig,
} from './config/weights-file';
export type { WeightConfigFile } from './config/weights-file';

// Validation
export {
  PROVIDER_OUTPUT_SCHEMA,
  ValidationError,
  getValidator,
  validateProviderOutput,
  isValidProviderOutput,
  validateFieldCoverage,
  validateColumnIdConstraints,
  validateFull,
} from './validation';

// Utilities
export {
  EvidencePackBuilder,
  buildEvidencePack,
  detectLanguage,
} from './utils';
export type { EvidencePackBuilderOptions, ColumnData } from './utils';

// Prompts
export { getMappingReviewSystemPrompt } from './prompts/mapping-review-prompt';
export { getExtractionReviewSystemPrompt } from './prompts/extraction-review-prompt';

// Aggregation
export { aggregateVotes } from './aggregation/weighted-voting';
export {
  detectConsensus,
  detectFieldConsensus,
  isSufficientConsensus,
} from './aggregation/consensus-detector';

// Tasks
export { executeSchemaMappingReview, validateProviderOutputs } from './tasks/schema-mapping-review';
export { executeExtractionReview } from './tasks/extraction-review';

// Types
export type {
  EvidencePack,
  ColumnStats,
  ProviderMapping,
  ProviderIssue,
  ProviderMappingOutput,
  ProviderOutput,
  FieldVote,
  ConsensusType,
  AggregatedResult,
  CommitteeConfig,
  CommitteeTaskType,
  CommitteeTask,
  SchemaMappingTask,
  ExtractionReviewTask,
  CommitteeResult,
  ProviderConfig,
  ProviderFactoryOptions,
  CalibrationResult,
  GoldenTestCase,
  SupportedLanguage,
} from './types';
