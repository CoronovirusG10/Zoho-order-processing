import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to ensure every request has a correlation ID
 */
export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract from header or generate new
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    uuidv4();

  // Attach to request
  (req as any).correlationId = correlationId;

  // Add to response headers
  res.setHeader('x-correlation-id', correlationId);

  next();
}
