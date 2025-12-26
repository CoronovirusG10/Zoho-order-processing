/**
 * Correlation middleware for tracking requests across services
 */

import { Activity, Middleware, TurnContext } from 'botbuilder';
import { v4 as uuidv4 } from 'uuid';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const CORRELATION_ID_PROPERTY = 'correlationId';

export class CorrelationMiddleware implements Middleware {
  async onTurn(context: TurnContext, next: () => Promise<void>): Promise<void> {
    // Generate or extract correlation ID
    const correlationId = this.getOrCreateCorrelationId(context.activity);

    // Store on turn state for access by handlers
    context.turnState.set(CORRELATION_ID_PROPERTY, correlationId);

    // Add to all outgoing activities
    context.onSendActivities(async (ctx, activities, nextSend) => {
      activities.forEach(activity => {
        if (!activity.channelData) {
          activity.channelData = {};
        }
        activity.channelData.correlationId = correlationId;
      });
      return nextSend();
    });

    await next();
  }

  private getOrCreateCorrelationId(activity: Activity): string {
    // Try to extract from incoming activity
    if (activity.channelData?.correlationId) {
      return activity.channelData.correlationId;
    }

    // Try to extract from replyToId (for card submissions)
    if (activity.replyToId) {
      return activity.replyToId;
    }

    // Generate new correlation ID
    return uuidv4();
  }
}

export function getCorrelationId(context: TurnContext): string {
  return context.turnState.get(CORRELATION_ID_PROPERTY) || 'unknown';
}
