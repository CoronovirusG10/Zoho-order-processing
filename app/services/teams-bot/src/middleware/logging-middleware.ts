/**
 * Logging middleware for structured logging
 */

import { Activity, Middleware, TurnContext } from 'botbuilder';
import { getCorrelationId } from './correlation-middleware.js';

interface LogContext {
  correlationId: string;
  activityId?: string;
  activityType?: string;
  from?: {
    id?: string;
    name?: string;
    aadObjectId?: string;
  };
  conversation?: {
    id?: string;
    tenantId?: string;
  };
  hasAttachments?: boolean;
  timestamp: string;
}

export class LoggingMiddleware implements Middleware {
  private shouldLogActivityContent: boolean;

  constructor(options: { logActivityContent?: boolean } = {}) {
    this.shouldLogActivityContent = options.logActivityContent ?? false;
  }

  async onTurn(context: TurnContext, next: () => Promise<void>): Promise<void> {
    const correlationId = getCorrelationId(context);
    const logContext = this.createLogContext(context, correlationId);

    // Log incoming activity
    this.logIncoming(logContext, context.activity);

    // Track timing
    const startTime = Date.now();

    try {
      await next();

      // Log successful completion
      const duration = Date.now() - startTime;
      this.logCompletion(logContext, duration);
    } catch (error) {
      // Error will be handled by error middleware
      const duration = Date.now() - startTime;
      this.logError(logContext, error, duration);
      throw error;
    }
  }

  private createLogContext(context: TurnContext, correlationId: string): LogContext {
    const activity = context.activity;
    const channelData = activity.channelData as any;

    return {
      correlationId,
      activityId: activity.id,
      activityType: activity.type,
      from: {
        id: activity.from?.id,
        name: activity.from?.name,
        aadObjectId: activity.from?.aadObjectId,
      },
      conversation: {
        id: activity.conversation?.id,
        tenantId: channelData?.tenant?.id,
      },
      hasAttachments: (activity.attachments?.length ?? 0) > 0,
      timestamp: new Date().toISOString(),
    };
  }

  private logIncoming(logContext: LogContext, activity: Activity): void {
    const logData: any = {
      ...logContext,
      event: 'activity.incoming',
    };

    // Only log safe activity details
    if (this.shouldLogActivityContent && activity.text) {
      logData.textLength = activity.text.length;
      logData.hasText = true;
    }

    if (activity.attachments && activity.attachments.length > 0) {
      logData.attachments = activity.attachments.map(att => ({
        contentType: att.contentType,
        name: att.name,
        hasContent: !!att.content,
      }));
    }

    if (activity.value) {
      logData.hasValue = true;
      logData.valueKeys = Object.keys(activity.value);
    }

    console.log(JSON.stringify(logData));
  }

  private logCompletion(logContext: LogContext, duration: number): void {
    console.log(JSON.stringify({
      ...logContext,
      event: 'activity.completed',
      duration,
    }));
  }

  private logError(logContext: LogContext, error: unknown, duration: number): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(JSON.stringify({
      ...logContext,
      event: 'activity.error',
      duration,
      error: errorMessage,
      stack: errorStack,
    }));
  }
}

export function createLogger(correlationId: string) {
  return {
    info: (message: string, data?: any) => {
      console.log(JSON.stringify({
        correlationId,
        level: 'info',
        message,
        ...data,
        timestamp: new Date().toISOString(),
      }));
    },
    warn: (message: string, data?: any) => {
      console.warn(JSON.stringify({
        correlationId,
        level: 'warn',
        message,
        ...data,
        timestamp: new Date().toISOString(),
      }));
    },
    error: (message: string, error?: unknown, data?: any) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error(JSON.stringify({
        correlationId,
        level: 'error',
        message,
        error: errorMessage,
        stack: errorStack,
        ...data,
        timestamp: new Date().toISOString(),
      }));
    },
  };
}
