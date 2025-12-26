/**
 * Provider factory
 *
 * Creates and manages provider instances
 */

import { BaseProvider } from './base-provider';
import { AzureOpenAIProvider } from './azure-openai-provider';
import { AzureAnthropicProvider } from './azure-anthropic-provider';
import { AzureDeepSeekProvider } from './azure-deepseek-provider';
import { GeminiProvider } from './gemini-provider';
import { XAIProvider } from './xai-provider';
import { ProviderConfig, ProviderFactoryOptions } from '../types';
import { selectProviders, SelectionResult, isSelectionDiverse } from './selection';

/**
 * Factory for creating provider instances
 */
export class ProviderFactory {
  private configs: ProviderConfig[];
  private providers: Map<string, BaseProvider>;

  constructor(options: ProviderFactoryOptions) {
    this.configs = options.configs;
    this.providers = new Map();
    this.initializeProviders();
  }

  /**
   * Initialize all configured providers
   */
  private initializeProviders(): void {
    for (const config of this.configs) {
      if (!config.enabled) {
        continue;
      }

      try {
        const provider = this.createProvider(config);
        this.providers.set(config.id, provider);
      } catch (error) {
        console.error(`Failed to initialize provider ${config.id}:`, error);
      }
    }
  }

  /**
   * Create a provider instance based on type
   */
  private createProvider(config: ProviderConfig): BaseProvider {
    switch (config.type) {
      case 'azure-openai':
        return new AzureOpenAIProvider(config);
      case 'azure-anthropic':
        return new AzureAnthropicProvider(config);
      case 'azure-deepseek':
        return new AzureDeepSeekProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'xai':
        return new XAIProvider(config);
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  /**
   * Get a provider by ID
   */
  getProvider(id: string): BaseProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all enabled provider IDs
   */
  getEnabledProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Select N random providers from the pool
   *
   * Uses diversity-aware selection to avoid selecting multiple providers
   * from the same family (e.g., two OpenAI models).
   */
  selectRandomProviders(count: number, pool?: string[]): BaseProvider[] {
    const availableIds = pool || this.getEnabledProviderIds();
    const enabledIds = availableIds.filter((id) => this.providers.has(id));

    if (enabledIds.length < count) {
      throw new Error(
        `Not enough enabled providers. Requested: ${count}, Available: ${enabledIds.length}`
      );
    }

    // Use diversity-aware selection
    const result = selectProviders(this.providers, {
      count,
      pool: enabledIds,
      enforceDiversity: true,
    });

    if (!result.diversityMet) {
      console.warn(
        `Provider selection diversity not fully met. Skipped providers: ${result.skippedDueToFamily.join(', ')}`
      );
    }

    return result.selectedIds.map((id) => this.providers.get(id)!);
  }

  /**
   * Select providers with detailed result
   *
   * Returns selection metadata including diversity information
   */
  selectProvidersWithDetails(
    count: number,
    pool?: string[],
    enforceDiversity: boolean = true
  ): { providers: BaseProvider[]; selectionResult: SelectionResult } {
    const availableIds = pool || this.getEnabledProviderIds();
    const enabledIds = availableIds.filter((id) => this.providers.has(id));

    const selectionResult = selectProviders(this.providers, {
      count,
      pool: enabledIds,
      enforceDiversity,
    });

    const providers = selectionResult.selectedIds.map((id) => this.providers.get(id)!);

    return { providers, selectionResult };
  }

  /**
   * Check if current selection would be diverse
   */
  wouldBeDiverse(providerIds: string[]): boolean {
    return isSelectionDiverse(providerIds);
  }

  /**
   * Get provider count
   */
  getProviderCount(): number {
    return this.providers.size;
  }
}
