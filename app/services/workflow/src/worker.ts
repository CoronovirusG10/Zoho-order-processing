/**
 * Temporal Worker Configuration
 *
 * Connects to Temporal server and registers workflows and activities
 * for the order-processing task queue.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import path from 'path';
import { initializeCosmosClient } from './repositories/index.js';

async function run(): Promise<void> {
  console.log('Initializing Temporal worker...');

  // Initialize Cosmos DB client (if endpoint is configured)
  if (process.env.COSMOS_ENDPOINT) {
    console.log('Initializing Cosmos DB client...');
    try {
      await initializeCosmosClient();
      console.log('Cosmos DB client initialized successfully');
    } catch (err) {
      console.error('Failed to initialize Cosmos DB client:', err);
      throw err;
    }
  } else {
    console.warn('COSMOS_ENDPOINT not set - case persistence will be unavailable');
  }

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

// Start the worker
run().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
