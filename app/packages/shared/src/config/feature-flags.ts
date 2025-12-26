/**
 * Feature flag definitions and utilities
 */

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  requiresEnv?: string;
}

/**
 * All feature flags in the system
 */
export const FEATURE_FLAGS = {
  /**
   * Enable AI committee for field mapping
   */
  ENABLE_COMMITTEE: {
    key: 'ENABLE_COMMITTEE',
    enabled: true,
    description: 'Enable 3-model committee for field mapping validation',
  },

  /**
   * Enable formula blocking in Excel files
   */
  BLOCK_FORMULAS: {
    key: 'BLOCK_FORMULAS',
    enabled: true,
    description: 'Block Excel files containing formulas in data ranges',
  },

  /**
   * Enable automatic customer resolution
   */
  AUTO_RESOLVE_CUSTOMER: {
    key: 'AUTO_RESOLVE_CUSTOMER',
    enabled: false,
    description: 'Automatically resolve customer when confidence is high',
  },

  /**
   * Enable automatic item resolution
   */
  AUTO_RESOLVE_ITEMS: {
    key: 'AUTO_RESOLVE_ITEMS',
    enabled: false,
    description: 'Automatically resolve items when confidence is high',
  },

  /**
   * Enable Zoho master data caching
   */
  ENABLE_ZOHO_CACHE: {
    key: 'ENABLE_ZOHO_CACHE',
    enabled: true,
    description: 'Cache Zoho customer and item data for offline validation',
  },

  /**
   * Enable Application Insights logging
   */
  ENABLE_APP_INSIGHTS: {
    key: 'ENABLE_APP_INSIGHTS',
    enabled: true,
    description: 'Send telemetry to Application Insights',
    requiresEnv: 'APPLICATIONINSIGHTS_CONNECTION_STRING',
  },

  /**
   * Enable arithmetic validation
   */
  ENABLE_ARITHMETIC_VALIDATION: {
    key: 'ENABLE_ARITHMETIC_VALIDATION',
    enabled: true,
    description: 'Validate line totals match quantity * unit price',
  },

  /**
   * Allow quantity = 0
   */
  ALLOW_ZERO_QUANTITY: {
    key: 'ALLOW_ZERO_QUANTITY',
    enabled: true,
    description: 'Allow line items with quantity = 0',
  },

  /**
   * Enable GTIN validation with check digit
   */
  STRICT_GTIN_VALIDATION: {
    key: 'STRICT_GTIN_VALIDATION',
    enabled: true,
    description: 'Validate GTIN check digits strictly',
  },

  /**
   * Enable multilingual support (English + Farsi)
   */
  ENABLE_MULTILINGUAL: {
    key: 'ENABLE_MULTILINGUAL',
    enabled: true,
    description: 'Support English and Farsi headers/messages',
  },

  /**
   * Enable audit bundle generation
   */
  ENABLE_AUDIT_BUNDLES: {
    key: 'ENABLE_AUDIT_BUNDLES',
    enabled: true,
    description: 'Generate and store audit bundles for all cases',
  },

  /**
   * Enable Teams file download via Graph API (fallback)
   */
  USE_GRAPH_FILE_DOWNLOAD: {
    key: 'USE_GRAPH_FILE_DOWNLOAD',
    enabled: false,
    description: 'Use Graph API for Teams file downloads instead of direct URL',
  },
} as const satisfies Record<string, FeatureFlag>;

/**
 * Feature flag keys
 */
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  const flag = FEATURE_FLAGS[key];

  if (!flag.enabled) {
    return false;
  }

  // Check if required environment variable is set
  if ('requiresEnv' in flag && flag.requiresEnv && !process.env[flag.requiresEnv]) {
    return false;
  }

  // Check for environment override
  const envKey = `FEATURE_${key}`;
  const envValue = process.env[envKey];

  if (envValue !== undefined) {
    return envValue.toLowerCase() === 'true' || envValue === '1';
  }

  return flag.enabled;
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): FeatureFlagKey[] {
  return Object.keys(FEATURE_FLAGS).filter((key) =>
    isFeatureEnabled(key as FeatureFlagKey)
  ) as FeatureFlagKey[];
}

/**
 * Get feature flag metadata
 */
export function getFeatureFlag(key: FeatureFlagKey): FeatureFlag {
  return FEATURE_FLAGS[key];
}

/**
 * Get all feature flags as an object
 */
export function getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const result: Record<string, boolean> = {};

  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    result[key] = isFeatureEnabled(key);
  }

  return result as Record<FeatureFlagKey, boolean>;
}
