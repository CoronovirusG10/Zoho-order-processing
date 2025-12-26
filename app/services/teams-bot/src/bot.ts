/**
 * Main bot class extending TeamsActivityHandler
 */

import {
  TeamsActivityHandler,
  TurnContext,
  CardFactory,
  Attachment,
  InvokeResponse,
} from 'botbuilder';
import { FileUploadHandler } from './handlers/file-upload-handler.js';
import { CardSubmitHandler } from './handlers/card-submit-handler.js';
import { MessageHandler } from './handlers/message-handler.js';
import { getCorrelationId } from './middleware/correlation-middleware.js';
import { createLogger } from './middleware/logging-middleware.js';

export class OrderProcessingBot extends TeamsActivityHandler {
  private fileUploadHandler: FileUploadHandler;
  private cardSubmitHandler: CardSubmitHandler;
  private messageHandler: MessageHandler;

  constructor() {
    super();

    this.fileUploadHandler = new FileUploadHandler();
    this.cardSubmitHandler = new CardSubmitHandler();
    this.messageHandler = new MessageHandler();

    // Handle messages
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    // Handle members added (welcome message)
    this.onMembersAdded(async (context, next) => {
      await this.handleMembersAdded(context);
      await next();
    });

  }

  /**
   * Handle invoke activities (adaptive card actions)
   */
  protected async onInvokeActivity(context: TurnContext): Promise<InvokeResponse> {
    if (context.activity.name === 'adaptiveCard/action') {
      return await this.handleAdaptiveCardAction(context);
    }

    // Call base handler for other invoke types
    return await super.onInvokeActivity(context);
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(context: TurnContext): Promise<void> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    const activity = context.activity;

    // Check if message has attachments
    if (activity.attachments && activity.attachments.length > 0) {
      logger.info('Message with attachments received', {
        attachmentCount: activity.attachments.length,
      });

      await this.fileUploadHandler.handle(context);
      return;
    }

    // Handle text messages
    if (activity.text) {
      logger.info('Text message received');
      await this.messageHandler.handle(context);
      return;
    }

    // Unknown message type
    logger.warn('Unknown message type received');
  }

  /**
   * Handle adaptive card actions
   */
  private async handleAdaptiveCardAction(context: TurnContext): Promise<InvokeResponse> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    try {
      await this.cardSubmitHandler.handle(context);

      return {
        status: 200,
        body: {
          statusCode: 200,
          type: 'application/vnd.microsoft.card.adaptive',
          value: {
            type: 'AdaptiveCard',
            version: '1.5',
            body: [
              {
                type: 'TextBlock',
                text: 'Action received. Processing...',
                wrap: true,
              },
            ],
          },
        },
      };
    } catch (error) {
      logger.error('Failed to handle adaptive card action', error);

      return {
        status: 200,
        body: {
          statusCode: 500,
          type: 'application/vnd.microsoft.card.adaptive',
          value: {
            type: 'AdaptiveCard',
            version: '1.5',
            body: [
              {
                type: 'TextBlock',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                wrap: true,
                color: 'Attention',
              },
            ],
          },
        },
      };
    }
  }

  /**
   * Handle members added to conversation
   */
  private async handleMembersAdded(context: TurnContext): Promise<void> {
    const membersAdded = context.activity.membersAdded || [];

    for (const member of membersAdded) {
      // Greet new members (except the bot itself)
      if (member.id !== context.activity.recipient?.id) {
        const welcomeMessage = [
          '👋 Hello! I am the Sales Order Processing Bot.',
          '',
          'I can help you create draft sales orders in Zoho Books by uploading Excel spreadsheets.',
          '',
          'To get started, upload an Excel file containing your sales order.',
          '',
          'Type `help` for more information.',
        ].join('\n');

        await context.sendActivity(welcomeMessage);
      }
    }
  }

  /**
   * Post a status update to a conversation
   * This can be called by external services (parser, workflow) to update the user
   */
  async postStatusUpdate(
    conversationReference: any,
    adapter: any,
    card: any
  ): Promise<void> {
    await adapter.continueConversation(conversationReference, async (turnContext: TurnContext) => {
      const cardAttachment: Attachment = CardFactory.adaptiveCard(card);
      await turnContext.sendActivity({ attachments: [cardAttachment] });
    });
  }
}
