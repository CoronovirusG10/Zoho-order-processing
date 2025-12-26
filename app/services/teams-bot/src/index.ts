/**
 * Main entry point for the Teams bot service
 */

import express, { Request, Response } from 'express';
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationBotFrameworkAuthenticationOptions,
  TurnContext,
} from 'botbuilder';
import { OrderProcessingBot } from './bot.js';
import { CorrelationMiddleware } from './middleware/correlation-middleware.js';
import { LoggingMiddleware } from './middleware/logging-middleware.js';
import { ErrorMiddleware } from './middleware/error-middleware.js';

// Read environment variables
const PORT = process.env.PORT || 3000;
const MICROSOFT_APP_ID = process.env.MICROSOFT_APP_ID;
const MICROSOFT_APP_PASSWORD = process.env.MICROSOFT_APP_PASSWORD;
const MICROSOFT_APP_TYPE = process.env.MICROSOFT_APP_TYPE || 'MultiTenant';
const MICROSOFT_APP_TENANT_ID = process.env.MICROSOFT_APP_TENANT_ID;

// Validate required configuration
if (!MICROSOFT_APP_ID || !MICROSOFT_APP_PASSWORD) {
  throw new Error(
    'MICROSOFT_APP_ID and MICROSOFT_APP_PASSWORD must be set in environment variables'
  );
}

// Create bot framework authentication
const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
  {
    MicrosoftAppId: MICROSOFT_APP_ID,
    MicrosoftAppPassword: MICROSOFT_APP_PASSWORD,
    MicrosoftAppType: MICROSOFT_APP_TYPE,
    MicrosoftAppTenantId: MICROSOFT_APP_TENANT_ID,
  } as ConfigurationBotFrameworkAuthenticationOptions
);

// Create adapter
const adapter = new CloudAdapter(botFrameworkAuthentication);

// Add middleware
adapter.use(new CorrelationMiddleware());
adapter.use(new LoggingMiddleware({ logActivityContent: false }));
adapter.use(new ErrorMiddleware());

// Create bot
const bot = new OrderProcessingBot();

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'teams-bot',
    timestamp: new Date().toISOString(),
  });
});

// Bot messages endpoint
app.post('/api/messages', async (req: Request, res: Response) => {
  await adapter.process(req, res, async (context: TurnContext) => {
    await bot.run(context);
  });
});

// Status update endpoint (called by parser/workflow services)
app.post('/api/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationReference, card } = req.body;

    if (!conversationReference || !card) {
      res.status(400).json({
        error: 'Missing conversationReference or card in request body',
      });
      return;
    }

    await bot.postStatusUpdate(conversationReference, adapter, card);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to post status update:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(JSON.stringify({
    event: 'server.started',
    port: PORT,
    timestamp: new Date().toISOString(),
    config: {
      appId: MICROSOFT_APP_ID,
      appType: MICROSOFT_APP_TYPE,
      tenantId: MICROSOFT_APP_TENANT_ID || 'not set',
    },
  }));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(JSON.stringify({
    event: 'server.shutdown',
    timestamp: new Date().toISOString(),
  }));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(JSON.stringify({
    event: 'server.shutdown',
    timestamp: new Date().toISOString(),
  }));
  process.exit(0);
});
