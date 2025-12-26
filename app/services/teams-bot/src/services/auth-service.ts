/**
 * Authentication service for cross-tenant token validation
 * Handles multi-tenant Entra (Azure AD) authentication for Teams bot
 */

import { TurnContext } from 'botbuilder';
import { createLogger } from '../middleware/logging-middleware.js';
import { getCorrelationId } from '../middleware/correlation-middleware.js';

/**
 * Allowed tenant IDs for cross-tenant access
 * In production, these should be loaded from configuration
 */
const ALLOWED_TENANT_IDS = new Set<string>(
  (process.env.ALLOWED_TENANT_IDS || '').split(',').filter(Boolean)
);

/**
 * Whether to allow any tenant (for multi-tenant apps)
 */
const ALLOW_ANY_TENANT = process.env.ALLOW_ANY_TENANT === 'true';

/**
 * Token claims from Azure AD
 */
export interface TokenClaims {
  aud: string;           // Audience (app ID)
  iss: string;           // Issuer (Azure AD)
  iat: number;           // Issued at
  nbf: number;           // Not before
  exp: number;           // Expiration
  tid: string;           // Tenant ID
  oid: string;           // Object ID (user)
  sub: string;           // Subject
  upn?: string;          // User principal name
  name?: string;         // Display name
  preferred_username?: string;
}

/**
 * Tenant info extracted from Teams activity
 */
export interface TenantInfo {
  tenantId: string;
  isAllowed: boolean;
  userId: string;
  userName?: string;
}

/**
 * Service for handling cross-tenant authentication
 */
export class AuthService {
  /**
   * Validate tenant from Teams activity
   * Returns tenant info if valid, throws if not
   */
  async validateTenant(context: TurnContext): Promise<TenantInfo> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    const activity = context.activity;
    const channelData = activity.channelData as any;

    // Extract tenant ID from Teams channel data
    const tenantId = channelData?.tenant?.id;

    if (!tenantId) {
      logger.warn('No tenant ID in activity', {
        channelId: activity.channelId,
        activityType: activity.type,
      });
      throw new AuthError('MISSING_TENANT', 'Could not determine tenant ID from activity');
    }

    // Check if tenant is allowed
    const isAllowed = this.isTenantAllowed(tenantId);

    if (!isAllowed) {
      logger.warn('Tenant not in allowed list', {
        tenantId,
        allowAnyTenant: ALLOW_ANY_TENANT,
        allowedCount: ALLOWED_TENANT_IDS.size,
      });
      throw new AuthError(
        'TENANT_NOT_ALLOWED',
        `Tenant ${tenantId} is not authorized to use this application`
      );
    }

    // Extract user info
    const userId = activity.from?.aadObjectId || activity.from?.id || 'unknown';
    const userName = activity.from?.name;

    logger.info('Tenant validated', {
      tenantId,
      userId,
      userName,
    });

    return {
      tenantId,
      isAllowed,
      userId,
      userName,
    };
  }

  /**
   * Check if a tenant ID is allowed
   */
  private isTenantAllowed(tenantId: string): boolean {
    // If allow any tenant is enabled (multi-tenant mode)
    if (ALLOW_ANY_TENANT) {
      return true;
    }

    // Check against allowed list
    return ALLOWED_TENANT_IDS.has(tenantId);
  }

  /**
   * Extract service URL for proactive messaging
   * The service URL is needed to send messages to a conversation
   */
  getServiceUrl(context: TurnContext): string {
    return context.activity.serviceUrl;
  }

  /**
   * Build conversation reference for proactive messaging
   * This reference can be stored and used later to send messages
   */
  buildConversationReference(context: TurnContext): ConversationReference {
    const activity = context.activity;
    const channelData = activity.channelData as any;

    return {
      activityId: activity.id,
      channelId: activity.channelId,
      serviceUrl: activity.serviceUrl,
      conversationId: activity.conversation?.id || '',
      conversationType: activity.conversation?.conversationType,
      tenantId: channelData?.tenant?.id,
      userId: activity.from?.aadObjectId || activity.from?.id,
      userName: activity.from?.name,
      botId: activity.recipient?.id,
      botName: activity.recipient?.name,
      locale: activity.locale,
    };
  }
}

/**
 * Conversation reference for proactive messaging
 */
export interface ConversationReference {
  activityId?: string;
  channelId: string;
  serviceUrl: string;
  conversationId: string;
  conversationType?: string;
  tenantId?: string;
  userId?: string;
  userName?: string;
  botId?: string;
  botName?: string;
  locale?: string;
}

/**
 * Authentication error with code
 */
export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

/**
 * Token validation error
 */
export class TokenValidationError extends Error {
  code: string;
  claims?: Partial<TokenClaims>;

  constructor(code: string, message: string, claims?: Partial<TokenClaims>) {
    super(message);
    this.code = code;
    this.claims = claims;
    this.name = 'TokenValidationError';
  }
}
