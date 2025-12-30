/**
 * PM2 Ecosystem Configuration for Workflow Service
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload ecosystem.config.cjs
 */

module.exports = {
  apps: [
    {
      name: 'workflow-worker',
      script: 'dist/worker.js',
      cwd: '/data/order-processing/app/services/workflow',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        // Temporal
        TEMPORAL_ADDRESS: 'localhost:7233',
        TEMPORAL_NAMESPACE: 'default',
        // Cosmos DB
        COSMOS_ENDPOINT: 'https://cosmos-visionarylab.documents.azure.com:443/',
        COSMOS_DATABASE: 'order-processing',
        // Azure Storage
        AZURE_STORAGE_ACCOUNT_NAME: 'pippaistoragedev',
        AZURE_STORAGE_CONTAINER_INCOMING: 'orders-incoming',
        // Internal services
        API_SERVICE_URL: 'http://localhost:3000',
        ZOHO_SERVICE_URL: 'http://localhost:3010',
        TEAMS_BOT_SERVICE_URL: 'http://localhost:3978',
      },
      error_file: '/home/azureuser/.pm2/logs/workflow-worker-error.log',
      out_file: '/home/azureuser/.pm2/logs/workflow-worker-out.log',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'workflow-api',
      script: 'dist/server.js',
      cwd: '/data/order-processing/app/services/workflow',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        // Temporal
        TEMPORAL_ADDRESS: 'localhost:7233',
        TEMPORAL_NAMESPACE: 'default',
        // Cosmos DB
        COSMOS_ENDPOINT: 'https://cosmos-visionarylab.documents.azure.com:443/',
        COSMOS_DATABASE: 'order-processing',
      },
      error_file: '/home/azureuser/.pm2/logs/workflow-api-error.log',
      out_file: '/home/azureuser/.pm2/logs/workflow-api-out.log',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
