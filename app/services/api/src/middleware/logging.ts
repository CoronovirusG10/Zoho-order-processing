import { Request, Response, NextFunction } from 'express';

/**
 * Middleware for request/response logging
 */
export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId;

  // Log request
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'Incoming request',
      correlationId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })
  );

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(
      JSON.stringify({
        level: res.statusCode >= 400 ? 'error' : 'info',
        message: 'Request completed',
        correlationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      })
    );
  });

  next();
}
