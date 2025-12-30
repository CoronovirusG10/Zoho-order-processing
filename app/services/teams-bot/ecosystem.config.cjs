// PM2 Ecosystem Configuration for Teams Bot
require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
  apps: [{
    name: 'teams-bot',
    script: './dist/index.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3978,
      MICROSOFT_APP_ID: process.env.MICROSOFT_APP_ID,
      MICROSOFT_APP_PASSWORD: process.env.MICROSOFT_APP_PASSWORD,
      MICROSOFT_APP_TYPE: process.env.MICROSOFT_APP_TYPE || 'SingleTenant',
      MICROSOFT_APP_TENANT_ID: process.env.MICROSOFT_APP_TENANT_ID,
      ALLOWED_TENANT_IDS: process.env.ALLOWED_TENANT_IDS,
      ALLOW_ANY_TENANT: process.env.ALLOW_ANY_TENANT || 'false',
      AZURE_STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME,
      AZURE_STORAGE_CONTAINER_INCOMING: process.env.AZURE_STORAGE_CONTAINER_INCOMING,
      COSMOS_ENDPOINT: process.env.COSMOS_ENDPOINT,
      USE_COSMOS_DB: process.env.USE_COSMOS_DB || 'true',
      PARSER_ENDPOINT: process.env.PARSER_ENDPOINT || 'http://localhost:3001',
      WORKFLOW_ENDPOINT: process.env.WORKFLOW_ENDPOINT || 'http://localhost:3002',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE || 'en',
    },
    error_file: '/home/azureuser/.pm2/logs/teams-bot-error.log',
    out_file: '/home/azureuser/.pm2/logs/teams-bot-out.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
  }]
};
