/**
 * Temporal Worker Configuration
 *
 * Connects to Temporal server and registers workflows and activities
 * for the order-processing task queue.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import path from 'path';
import { initializeCosmosClient, getCasesRepository } from './repositories/index.js';
import {
  initializeResolveCustomerActivity,
  initializeResolveItemsActivity,
} from './activities';
import {
  getFeatureFlags,
  validateZohoConfig,
  logFeatureFlagStatus,
  getZohoModeDescription,
} from './config';

// Zoho imports for activity dependency injection
import {
  ZohoOAuthManager,
  ZohoCustomersApi,
  ZohoItemsApi,
  CustomerCache,
  ItemCache,
  CustomerMatcher,
  ItemMatcher,
} from '@order-processing/zoho';

async function run(): Promise<void> {
  console.log('Initializing Temporal worker...');

  // Initialize Cosmos DB client (if endpoint is configured)
  // Non-blocking: worker will start even if Cosmos fails (activities degrade gracefully)
  if (process.env.COSMOS_ENDPOINT) {
    console.log('Initializing Cosmos DB client...');
    try {
      await initializeCosmosClient();
      console.log('Cosmos DB client initialized successfully');
    } catch (err) {
      console.warn('Cosmos DB client initialization failed - activities will use fallback behavior');
      console.warn('Error:', err instanceof Error ? err.message : String(err));
      // Continue without Cosmos - activities have graceful degradation
    }
  } else {
    console.warn('COSMOS_ENDPOINT not set - case persistence will be unavailable');
  }

  // Initialize Zoho dependencies for resolveCustomer and resolveItems activities
  // Non-blocking: worker will start even if Zoho initialization fails (activities degrade gracefully)
  await initializeZohoDependencies();

  // Connect to Temporal server
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  console.log(`Connected to Temporal at ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);

  // Create the worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: 'order-processing',
    // Use path.join for cross-platform compatibility
    workflowsPath: path.join(__dirname, 'workflows'),
    activities,
    // Concurrency settings
    maxConcurrentWorkflowTaskExecutions: 10,
    maxConcurrentActivityTaskExecutions: 20,
    // Shutdown grace period
    shutdownGraceTime: '30s',
  });

  console.log('Worker created with configuration:', {
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: 'order-processing',
    maxConcurrentWorkflowTasks: 10,
    maxConcurrentActivityTasks: 20,
  });

  // Signal ready to PM2
  if (process.send) {
    process.send('ready');
    console.log('Sent ready signal to PM2');
  }

  // Track shutdown state
  let isShuttingDown = false;

  // Graceful shutdown handler
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}, initiating graceful shutdown...`);

    try {
      // Worker.shutdown() will complete any in-progress tasks
      // and reject any new tasks
      await worker.shutdown();
      console.log('Worker shutdown complete');

      // Close the connection
      await connection.close();
      console.log('Connection closed');

      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });

  console.log('Starting Temporal worker on task queue: order-processing');

  // Run the worker - this blocks until shutdown
  await worker.run();
}

/**
 * Initialize Zoho dependencies for resolveCustomer and resolveItems activities
 *
 * This function:
 * 1. Checks feature flags to determine if real Zoho should be used
 * 2. Validates Zoho configuration if needed
 * 3. Creates the OAuth manager, API clients, caches, and matchers
 * 4. Injects them into the activity initialization functions
 *
 * Feature flag modes:
 * - 'mock': Always use mock data, skip Zoho initialization
 * - 'real': Always use real Zoho (fail if not configured)
 * - 'auto': Use real if configured, mock otherwise (default)
 */
async function initializeZohoDependencies(): Promise<void> {
  // Log feature flag status at startup
  logFeatureFlagStatus();

  const flags = getFeatureFlags();
  const zohoConfig = validateZohoConfig();

  console.log('Zoho mode:', getZohoModeDescription());

  // If mock mode is explicitly set, skip Zoho initialization
  if (flags.zohoMode === 'mock') {
    console.log('ZOHO_MODE=mock: Skipping Zoho initialization, activities will use mock behavior');
    return;
  }

  // If real mode is set but config is missing, fail fast
  if (flags.zohoMode === 'real' && !zohoConfig.valid) {
    throw new Error(
      `ZOHO_MODE=real but missing required configuration: ${zohoConfig.missing.join(', ')}. ` +
      'Either set ZOHO_MODE=mock or provide all required Zoho environment variables.'
    );
  }

  // In auto mode with missing config, use mock behavior
  if (!zohoConfig.valid) {
    console.warn('Zoho configuration incomplete - activities will use mock behavior');
    console.warn('Missing:', zohoConfig.missing.join(', '));
    return;
  }

  // Get Zoho config from environment (already validated)
  const zohoClientId = process.env.ZOHO_CLIENT_ID!;
  const zohoClientSecret = process.env.ZOHO_CLIENT_SECRET!;
  const zohoRefreshToken = process.env.ZOHO_REFRESH_TOKEN!;
  const zohoOrganizationId = process.env.ZOHO_ORGANIZATION_ID!;
  const zohoRegion = zohoConfig.details.region;

  console.log('Initializing Zoho dependencies (real mode)...');

  try {
    // Create OAuth manager with dev mode (uses environment variables)
    const oauthManager = new ZohoOAuthManager({
      devMode: true,
      devCredentials: {
        clientId: zohoClientId,
        clientSecret: zohoClientSecret,
        refreshToken: zohoRefreshToken,
        organizationId: zohoOrganizationId,
        region: zohoRegion as 'eu' | 'com' | 'in' | 'au' | 'jp',
      },
    });

    // Create API clients
    const customersApi = new ZohoCustomersApi(oauthManager);
    const itemsApi = new ZohoItemsApi(oauthManager);

    // Create caches (which implement IZohoCustomerService and IZohoItemService)
    const customerCache = new CustomerCache(customersApi);
    const itemCache = new ItemCache(itemsApi);

    // Create matchers
    const customerMatcher = new CustomerMatcher();
    const itemMatcher = new ItemMatcher({
      fuzzyNameMatchEnabled: false, // SKU/GTIN only by default
    });

    // Get cases repository (may not be initialized if Cosmos is not configured)
    let casesRepository;
    try {
      casesRepository = getCasesRepository();
    } catch {
      console.warn('Cases repository not available - resolveCustomer will use partial initialization');
      casesRepository = null;
    }

    // Initialize resolveCustomer activity (needs cases repository)
    if (casesRepository) {
      // Wrap CustomerCache to implement IZohoCustomerService interface
      const customerService = {
        getCustomers: () => customerCache.getCustomers(),
      };

      initializeResolveCustomerActivity(casesRepository, customerService, customerMatcher);
      console.log('resolveCustomer activity initialized with Zoho dependencies');
    } else {
      console.warn('resolveCustomer activity not initialized - cases repository unavailable');
    }

    // Initialize resolveItems activity
    // Wrap ItemCache to implement IZohoItemService interface
    const itemService = {
      getItems: () => itemCache.getItems(),
    };

    initializeResolveItemsActivity(itemService, itemMatcher);
    console.log('resolveItems activity initialized with Zoho dependencies');

    // Optionally pre-load caches (non-blocking)
    // This helps reduce latency on first activity execution
    customerCache.refreshCache().catch((err) => {
      console.warn('Failed to pre-load customer cache:', err instanceof Error ? err.message : String(err));
    });
    itemCache.refreshCache().catch((err) => {
      console.warn('Failed to pre-load item cache:', err instanceof Error ? err.message : String(err));
    });

    console.log('Zoho dependencies initialized successfully');
  } catch (err) {
    console.warn('Zoho dependencies initialization failed - activities will use fallback behavior');
    console.warn('Error:', err instanceof Error ? err.message : String(err));
    // Continue without Zoho - activities have graceful degradation
  }
}

// Start the worker
run().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
