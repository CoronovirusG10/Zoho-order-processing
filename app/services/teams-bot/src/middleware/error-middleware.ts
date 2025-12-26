/**
 * Error handling middleware for graceful error responses
 */

import { Middleware, TurnContext } from 'botbuilder';
import { getCorrelationId } from './correlation-middleware.js';
import { createLogger } from './logging-middleware.js';

export class ErrorMiddleware implements Middleware {
  async onTurn(context: TurnContext, next: () => Promise<void>): Promise<void> {
    try {
      await next();
    } catch (error) {
      const correlationId = getCorrelationId(context);
      const logger = createLogger(correlationId);

      logger.error('Unhandled error in bot', error);

      // Send user-friendly error message
      await this.sendErrorMessage(context, correlationId, error);
    }
  }

  private async sendErrorMessage(
    context: TurnContext,
    correlationId: string,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const isDevelopment = process.env.NODE_ENV === 'development';

    const message = [
      '❌ Sorry, something went wrong while processing your request.',
      '',
      `**Correlation ID:** ${correlationId}`,
      '',
      'Please try again or contact support if the problem persists.',
    ];

    // Include error details in development
    if (isDevelopment) {
      message.push('', '**Error details (dev only):**', `\`\`\`${errorMessage}\`\`\``);
    }

    try {
      await context.sendActivity(message.join('\n'));
    } catch (sendError) {
      // Last resort: log that we couldn't even send the error message
      console.error(JSON.stringify({
        correlationId,
        level: 'critical',
        message: 'Failed to send error message to user',
        originalError: error instanceof Error ? error.message : String(error),
        sendError: sendError instanceof Error ? sendError.message : String(sendError),
        timestamp: new Date().toISOString(),
      }));
    }
  }
}
