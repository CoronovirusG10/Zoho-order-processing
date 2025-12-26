import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { correlationMiddleware } from './middleware/correlation.js';
import { loggingMiddleware } from './middleware/logging.js';
import { errorHandler } from './middleware/error-handler.js';
import { casesRouter } from './routes/cases.js';
import { healthRouter } from './routes/health.js';
import { toolsRouter } from './routes/tools.js';
import { botEventsRouter } from './routes/bot-events.js';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS - configure based on environment
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [];
  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : '*',
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request tracking and logging
  app.use(correlationMiddleware);
  app.use(loggingMiddleware);

  // Health endpoints (no auth required)
  app.use('/health', healthRouter);

  // API routes (auth required)
  app.use('/api/cases', casesRouter);
  app.use('/api/bot', botEventsRouter);

  // Tool routes (internal auth via APIM or Managed Identity)
  app.use('/tools', toolsRouter);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
