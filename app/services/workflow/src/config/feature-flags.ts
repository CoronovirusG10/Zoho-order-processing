/**
 * Feature Flags Configuration
 *
 * Controls runtime behavior for Zoho integration and other features.
 * Supports environment variables and provides validation utilities.
 *
 * ZOHO_MODE options:
 * - 'mock': Always use mock data (for development/testing)
 * - 'real': Always use real Zoho API (fail if not configured)
 * - 'auto': Use real if configured, mock otherwise (default)
 */

export type ZohoMode = 'mock' | 'real' | 'auto';

/**
 * Feature flags for controlling system behavior
 */
export interface FeatureFlags {
  /** Zoho integration mode: mock, real, or auto (default) */
  zohoMode: ZohoMode;
  /** Whether to use mock customer resolution */
  useMockCustomer: boolean;
  /** Whether to use mock item resolution */
  useMockItems: boolean;
  /** Whether to use mock draft creation */
  useMockDraft: boolean;
  /** Enable audit logging for activities */
  enableAuditLogging: boolean;
  /** Enable reminder notifications */
  enableReminderNotifications: boolean;
}

/**
 * Zoho configuration validation result
 */
export interface ZohoConfigValidation {
  /** Whether all required config is present */
  valid: boolean;
  /** List of missing environment variables */
  missing: string[];
  /** Configuration details (for logging) */
  details: {
    clientId: boolean;
    clientSecret: boolean;
    refreshToken: boolean;
    organizationId: boolean;
    region: string;
  };
}

/**
 * Required Zoho environment variables
 */
const REQUIRED_ZOHO_VARS = [
  'ZOHO_CLIENT_ID',
  'ZOHO_CLIENT_SECRET',
  'ZOHO_REFRESH_TOKEN',
  'ZOHO_ORGANIZATION_ID',
] as const;

// Singleton cache for feature flags
let cachedFlags: FeatureFlags | null = null;
let cachedZohoValidation: ZohoConfigValidation | null = null;

/**
 * Get the current feature flags configuration
 *
 * Reads from environment variables and determines appropriate mock/real settings.
 * Results are cached for performance (call resetFeatureFlags() to clear cache).
 *
 * @returns Feature flags configuration
 */
export function getFeatureFlags(): FeatureFlags {
  if (cachedFlags) {
    return cachedFlags;
  }

  const zohoMode = parseZohoMode(process.env.ZOHO_MODE);
  const zohoConfig = validateZohoConfig();

  // Determine mock usage based on mode and config availability
  let useMock: boolean;
  if (zohoMode === 'mock') {
    useMock = true;
  } else if (zohoMode === 'real') {
    useMock = false; // Will fail if not configured
  } else {
    // auto mode: use real if configured, mock otherwise
    useMock = !zohoConfig.valid;
  }

  cachedFlags = {
    zohoMode,
    useMockCustomer: useMock,
    useMockItems: useMock,
    useMockDraft: useMock,
    enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
    enableReminderNotifications: process.env.ENABLE_REMINDERS !== 'false',
  };

  return cachedFlags;
}

/**
 * Reset cached feature flags (useful for testing)
 */
export function resetFeatureFlags(): void {
  cachedFlags = null;
  cachedZohoValidation = null;
}

/**
 * Parse and validate ZOHO_MODE environment variable
 *
 * @param value - Raw environment variable value
 * @returns Validated ZohoMode
 */
function parseZohoMode(value: string | undefined): ZohoMode {
  if (!value) {
    return 'auto';
  }

  const normalized = value.toLowerCase().trim();
  if (normalized === 'mock' || normalized === 'real' || normalized === 'auto') {
    return normalized;
  }

  console.warn(`Invalid ZOHO_MODE value: "${value}". Using "auto" instead.`);
  return 'auto';
}

/**
 * Validate Zoho configuration completeness
 *
 * Checks for required environment variables needed for real Zoho integration.
 * Results are cached for performance.
 *
 * @returns Validation result with missing variables
 */
export function validateZohoConfig(): ZohoConfigValidation {
  if (cachedZohoValidation) {
    return cachedZohoValidation;
  }

  const missing = REQUIRED_ZOHO_VARS.filter((key) => !process.env[key]);

  cachedZohoValidation = {
    valid: missing.length === 0,
    missing,
    details: {
      clientId: !!process.env.ZOHO_CLIENT_ID,
      clientSecret: !!process.env.ZOHO_CLIENT_SECRET,
      refreshToken: !!process.env.ZOHO_REFRESH_TOKEN,
      organizationId: !!process.env.ZOHO_ORGANIZATION_ID,
      region: process.env.ZOHO_REGION || process.env.ZOHO_DC || 'eu',
    },
  };

  return cachedZohoValidation;
}

/**
 * Check if Zoho integration should use real API
 *
 * Convenience function that checks both mode and config.
 *
 * @returns true if real Zoho API should be used
 * @throws Error if mode is 'real' but config is incomplete
 */
export function shouldUseRealZoho(): boolean {
  const flags = getFeatureFlags();
  const config = validateZohoConfig();

  if (flags.zohoMode === 'real' && !config.valid) {
    throw new Error(
      `ZOHO_MODE=real but missing required configuration: ${config.missing.join(', ')}`
    );
  }

  return !flags.useMockCustomer;
}

/**
 * Log feature flag status (for worker startup)
 *
 * Outputs current configuration to console for visibility.
 */
export function logFeatureFlagStatus(): void {
  const flags = getFeatureFlags();
  const config = validateZohoConfig();

  console.log('=== Feature Flags Configuration ===');
  console.log(`ZOHO_MODE: ${flags.zohoMode}`);
  console.log(`  useMockCustomer: ${flags.useMockCustomer}`);
  console.log(`  useMockItems: ${flags.useMockItems}`);
  console.log(`  useMockDraft: ${flags.useMockDraft}`);
  console.log(`Zoho config valid: ${config.valid}`);

  if (!config.valid) {
    console.log(`  Missing: ${config.missing.join(', ')}`);
  }

  console.log(`Audit logging: ${flags.enableAuditLogging ? 'enabled' : 'disabled'}`);
  console.log(`Reminder notifications: ${flags.enableReminderNotifications ? 'enabled' : 'disabled'}`);
  console.log('===================================');
}

/**
 * Get a human-readable summary of the current Zoho mode
 *
 * Useful for logging and status displays.
 *
 * @returns Summary string describing current mode
 */
export function getZohoModeDescription(): string {
  const flags = getFeatureFlags();
  const config = validateZohoConfig();

  switch (flags.zohoMode) {
    case 'mock':
      return 'Mock mode (ZOHO_MODE=mock): All Zoho operations return mock data';

    case 'real':
      if (config.valid) {
        return 'Real mode (ZOHO_MODE=real): Using live Zoho API';
      }
      return `Real mode (ZOHO_MODE=real): CONFIGURATION ERROR - Missing: ${config.missing.join(', ')}`;

    case 'auto':
    default:
      if (config.valid) {
        return 'Auto mode: Using live Zoho API (configuration detected)';
      }
      return 'Auto mode: Using mock data (Zoho not configured)';
  }
}
