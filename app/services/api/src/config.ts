/**
 * Application configuration
 * Loads and validates environment variables
 */

export interface AppConfig {
  server: {
    port: number;
    nodeEnv: string;
    corsOrigins: string[];
  };
  cosmos: {
    endpoint: string;
    databaseId: string;
    containers: {
      cases: string;
      auditEvents: string;
      fingerprints: string;
    };
  };
  storage: {
    accountUrl: string;
    containers: {
      uploads: string;
      auditBundles: string;
    };
  };
  apim: {
    subscriptionKey?: string;
  };
  auth: {
    tenantId?: string;
  };
  logging: {
    level: string;
  };
}

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): AppConfig {
  return {
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
    },
    cosmos: {
      endpoint:
        process.env.COSMOS_ENDPOINT ||
        'https://localhost:8081', // Cosmos emulator default
      databaseId: process.env.COSMOS_DATABASE || 'order-processing',
      containers: {
        cases: process.env.COSMOS_CONTAINER_CASES || 'cases',
        auditEvents: process.env.COSMOS_CONTAINER_AUDIT || 'audit-events',
        fingerprints: process.env.COSMOS_CONTAINER_FINGERPRINTS || 'fingerprints',
      },
    },
    storage: {
      accountUrl:
        process.env.STORAGE_ACCOUNT_URL ||
        'https://devstoreaccount1.blob.core.windows.net', // Azurite default
      containers: {
        uploads: process.env.STORAGE_CONTAINER_UPLOADS || 'uploads',
        auditBundles: process.env.STORAGE_CONTAINER_AUDIT || 'audit-bundles',
      },
    },
    apim: {
      subscriptionKey: process.env.APIM_SUBSCRIPTION_KEY,
    },
    auth: {
      tenantId: process.env.AZURE_TENANT_ID,
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
  };
}

/**
 * Validate required configuration
 */
export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  if (!config.cosmos.endpoint) {
    errors.push('COSMOS_ENDPOINT is required');
  }

  if (!config.storage.accountUrl) {
    errors.push('STORAGE_ACCOUNT_URL is required');
  }

  if (config.server.nodeEnv === 'production') {
    if (!config.apim.subscriptionKey) {
      console.warn('APIM_SUBSCRIPTION_KEY not set - internal auth may fail');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Export singleton config
export const config = loadConfig();

// Validate on load
if (process.env.NODE_ENV !== 'test') {
  validateConfig(config);
}
