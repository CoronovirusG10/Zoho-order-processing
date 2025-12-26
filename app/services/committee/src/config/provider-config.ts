/**
 * Default provider configurations
 *
 * These configurations are used as defaults and can be overridden via environment variables
 */

import { ProviderConfig } from '../types';

/**
 * Get default provider configurations
 *
 * Uses environment variables for sensitive data (API keys, endpoints)
 */
export function getDefaultProviderConfigs(): ProviderConfig[] {
  return [
    // Azure OpenAI - GPT-5.1
    {
      id: 'azure-gpt-5.1',
      name: 'Azure GPT-5.1',
      type: 'azure-openai',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      deploymentName: 'gpt-5.1',
      model: 'gpt-5.1',
      temperature: 0.1,
      maxTokens: 4000,
      enabled: !!process.env.AZURE_OPENAI_ENDPOINT,
    },

    // Azure OpenAI - GPT-5.2
    {
      id: 'azure-gpt-5.2',
      name: 'Azure GPT-5.2',
      type: 'azure-openai',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      deploymentName: 'gpt-5.2',
      model: 'gpt-5.2',
      temperature: 0.1,
      maxTokens: 4000,
      enabled: !!process.env.AZURE_OPENAI_ENDPOINT,
    },

    // Azure OpenAI - GPT-4.1
    {
      id: 'azure-gpt-4.1',
      name: 'Azure GPT-4.1',
      type: 'azure-openai',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      deploymentName: 'gpt-4.1',
      model: 'gpt-4.1',
      temperature: 0.1,
      maxTokens: 4000,
      enabled: !!process.env.AZURE_OPENAI_ENDPOINT,
    },

    // Azure Anthropic - Claude Opus 4.5
    {
      id: 'azure-claude-opus-4.5',
      name: 'Azure Claude Opus 4.5',
      type: 'azure-anthropic',
      endpoint: process.env.AZURE_ANTHROPIC_ENDPOINT || '',
      deploymentName: 'claude-opus-4-5',
      model: 'claude-opus-4-5',
      temperature: 0.1,
      maxTokens: 4000,
      enabled: !!process.env.AZURE_ANTHROPIC_ENDPOINT,
    },

    // Azure Anthropic - Claude Sonnet 4.5
    {
      id: 'azure-claude-sonnet-4.5',
      name: 'Azure Claude Sonnet 4.5',
      type: 'azure-anthropic',
      endpoint: process.env.AZURE_ANTHROPIC_ENDPOINT || '',
      deploymentName: 'claude-sonnet-4-5',
      model: 'claude-sonnet-4-5',
      temperature: 0.1,
      maxTokens: 4000,
      enabled: !!process.env.AZURE_ANTHROPIC_ENDPOINT,
    },

    // Azure DeepSeek - V3.2
    {
      id: 'azure-deepseek-v3.2',
      name: 'Azure DeepSeek V3.2',
      type: 'azure-deepseek',
      endpoint: process.env.AZURE_DEEPSEEK_ENDPOINT || '',
      deploymentName: 'DeepSeek-V3.2',
      model: 'DeepSeek-V3.2',
      temperature: 0.1,
      maxTokens: 4000,
      enabled: !!process.env.AZURE_DEEPSEEK_ENDPOINT,
    },

    // Google Gemini - 2.5 Pro
    {
      id: 'gemini-2.5-pro',
      name: 'Google Gemini 2.5 Pro',
      type: 'gemini',
      apiKey: process.env.GOOGLE_API_KEY || '',
      model: 'gemini-2.5-pro',
      temperature: 0.1,
      maxTokens: 4000,
      enabled: !!process.env.GOOGLE_API_KEY,
    },

    // xAI - Grok-4 Fast Reasoning
    {
      id: 'xai-grok-4-reasoning',
      name: 'xAI Grok-4 Fast Reasoning',
      type: 'xai',
      apiKey: process.env.XAI_API_KEY || '',
      model: 'grok-4-fast-reasoning',
      temperature: 0.1,
      maxTokens: 4000,
      enabled: !!process.env.XAI_API_KEY,
    },
  ];
}

/**
 * Get recommended provider pool for committee
 *
 * Selects a diverse set of providers from different families
 */
export function getRecommendedProviderPool(): string[] {
  return [
    'azure-gpt-5.1',
    'azure-claude-opus-4.5',
    'azure-deepseek-v3.2',
    'gemini-2.5-pro',
    'xai-grok-4-reasoning',
  ];
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: ProviderConfig): string[] {
  const errors: string[] = [];

  if (!config.id) {
    errors.push('Provider ID is required');
  }

  if (!config.name) {
    errors.push('Provider name is required');
  }

  if (!config.type) {
    errors.push('Provider type is required');
  }

  // Azure providers need endpoint and deployment
  if (config.type.startsWith('azure-')) {
    if (!config.endpoint) {
      errors.push(`Azure provider ${config.id} requires endpoint`);
    }
    if (!config.deploymentName) {
      errors.push(`Azure provider ${config.id} requires deploymentName`);
    }
  }

  // External providers need API key
  if (config.type === 'gemini' || config.type === 'xai') {
    if (!config.apiKey) {
      errors.push(`External provider ${config.id} requires apiKey`);
    }
  }

  if (config.temperature < 0 || config.temperature > 2) {
    errors.push('Temperature must be between 0 and 2');
  }

  if (config.maxTokens <= 0) {
    errors.push('maxTokens must be positive');
  }

  return errors;
}
