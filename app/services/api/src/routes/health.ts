import { Router, Request, Response } from 'express';
import { HealthResponse } from '../types.js';
import { asyncHandler } from '../middleware/error-handler.js';

const router = Router();

// Package version
const VERSION = '0.1.0';

/**
 * GET /health - Basic health check
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const response: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: VERSION,
    };
    res.json(response);
  })
);

/**
 * GET /health/ready - Readiness probe (check dependencies)
 */
router.get(
  '/ready',
  asyncHandler(async (req: Request, res: Response) => {
    const dependencies: HealthResponse['dependencies'] = {};
    let status: HealthResponse['status'] = 'healthy';

    // Check Cosmos DB
    try {
      // TODO: Add actual Cosmos DB ping
      dependencies.cosmos = 'up';
    } catch (error) {
      dependencies.cosmos = 'down';
      status = 'degraded';
    }

    // Check Blob Storage
    try {
      // TODO: Add actual Blob Storage ping
      dependencies.blob = 'up';
    } catch (error) {
      dependencies.blob = 'down';
      status = 'degraded';
    }

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      version: VERSION,
      dependencies,
    };

    const statusCode = status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  })
);

/**
 * GET /health/live - Liveness probe
 */
router.get(
  '/live',
  asyncHandler(async (req: Request, res: Response) => {
    const response: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: VERSION,
    };
    res.json(response);
  })
);

export { router as healthRouter };
