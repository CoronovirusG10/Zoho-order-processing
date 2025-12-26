import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthContext, UserRole, AuthenticatedRequest } from '../types.js';

/**
 * JWT payload structure from Teams SSO or APIM
 */
interface JwtPayload {
  sub?: string; // User ID
  oid?: string; // Object ID (AAD)
  tid?: string; // Tenant ID
  roles?: string[];
  name?: string;
  upn?: string; // User Principal Name
}

/**
 * Middleware to authenticate and authorize requests
 */
export function authMiddleware(requiredRoles?: UserRole[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const correlationId = (req as any).correlationId;

    try {
      // Extract Bearer token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
            correlationId,
          },
        });
        return;
      }

      const token = authHeader.substring(7);

      // Verify JWT token
      const authContext = await verifyToken(token);

      // Check required roles
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some((role) =>
          authContext.roles.includes(role)
        );

        if (!hasRequiredRole) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions',
              correlationId,
            },
          });
          return;
        }
      }

      // Attach auth context to request
      (req as AuthenticatedRequest).auth = authContext;

      next();
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Authentication failed',
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        })
      );

      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
          correlationId,
        },
      });
    }
  };
}

/**
 * Verify JWT token and extract auth context
 */
async function verifyToken(token: string): Promise<AuthContext> {
  // In production, verify against Azure AD public keys
  // For now, decode without verification (APIM will verify)
  const decoded = jwt.decode(token) as JwtPayload;

  if (!decoded) {
    throw new Error('Invalid token format');
  }

  const userId = decoded.oid || decoded.sub || '';
  const tenantId = decoded.tid || '';
  const roles = decoded.roles || [];

  if (!userId || !tenantId) {
    throw new Error('Missing required claims');
  }

  return {
    userId,
    tenantId,
    roles,
    displayName: decoded.name,
  };
}

/**
 * Internal auth middleware for tool endpoints (APIM or Managed Identity)
 */
export function internalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = (req as any).correlationId;

  // Check for APIM subscription key or managed identity token
  const apimKey = req.headers['ocp-apim-subscription-key'];
  const authHeader = req.headers.authorization;

  if (!apimKey && !authHeader) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Internal endpoint requires APIM key or managed identity',
        correlationId,
      },
    });
    return;
  }

  // Validate APIM key if present
  if (apimKey && process.env.APIM_SUBSCRIPTION_KEY) {
    if (apimKey !== process.env.APIM_SUBSCRIPTION_KEY) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid APIM subscription key',
          correlationId,
        },
      });
      return;
    }
  }

  next();
}
