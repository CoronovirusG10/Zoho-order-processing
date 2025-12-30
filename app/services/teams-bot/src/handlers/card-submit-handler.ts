/**
 * Handler for adaptive card submissions
 * Enhanced with language support and inline correction extraction
 * Includes customer/item selection signal handlers for Temporal workflow
 */

import { TurnContext, CardFactory, Attachment } from 'botbuilder';
import { CaseService } from '../services/case-service.js';
import { languageService, SupportedLanguage } from '../services/language-service.js';
import { createProcessingCard } from '../cards/processing-card.js';
import { AdaptiveCardAction } from '../types/teams-types.js';
import { getCorrelationId } from '../middleware/correlation-middleware.js';
import { createLogger } from '../middleware/logging-middleware.js';

/**
 * Workflow service client for sending signals
 */
class WorkflowClient {
  private endpoint: string;

  constructor() {
    this.endpoint = process.env.WORKFLOW_ENDPOINT || 'http://localhost:3000';
  }

  /**
   * Send a signal to a running workflow
   */
  async signalWorkflow(
    workflowId: string,
    signalName: string,
    payload: unknown,
    correlationId: string
  ): Promise<void> {
    const url = `${this.endpoint}/api/workflow/${workflowId}/signal/${signalName}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to signal workflow: ${response.status} - ${errorText}`);
    }
  }

  /**
   * Check if a workflow is running
   */
  async isWorkflowRunning(workflowId: string): Promise<boolean> {
    try {
      const url = `${this.endpoint}/api/workflow/${workflowId}/status`;
      const response = await fetch(url);

      if (!response.ok) {
        return false;
      }

      const status = (await response.json()) as { runtimeStatus?: string };
      return status.runtimeStatus === 'RUNNING';
    } catch {
      return false;
    }
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string, correlationId: string): Promise<void> {
    const url = `${this.endpoint}/api/workflow/${workflowId}/cancel`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to cancel workflow: ${response.status} - ${errorText}`);
    }
  }
}

/**
 * Extended card action with inline corrections
 */
interface ExtendedCardAction extends AdaptiveCardAction {
  // Inline correction fields are dynamically named: correction_{issueCode}_{index}
  [key: string]: any;
}

export class CardSubmitHandler {
  private caseService: CaseService;
  private workflowClient: WorkflowClient;

  constructor() {
    this.caseService = new CaseService();
    this.workflowClient = new WorkflowClient();
  }

  async handle(context: TurnContext): Promise<void> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    const value = context.activity.value as ExtendedCardAction;
    const language = this.detectLanguage(context);

    if (!value || !value.action) {
      const message = language === 'fa'
        ? 'ارسال کارت نامعتبر است.'
        : 'Invalid card submission.';
      await context.sendActivity(message);
      return;
    }

    logger.info('Card action received', {
      action: value.action,
      caseId: value.caseId,
      language,
    });

    try {
      switch (value.action) {
        case 'submit_corrections':
          await this.handleSubmitCorrections(context, value, correlationId, language, logger);
          break;

        case 'request_reupload':
          await this.handleRequestReupload(context, value, correlationId, language, logger);
          break;

        case 'approve_create':
          await this.handleApproveCreate(context, value, correlationId, language, logger);
          break;

        case 'request_changes':
          await this.handleRequestChanges(context, value, correlationId, language, logger);
          break;

        case 'select_customer':
          await this.handleCustomerSelection(context, value, correlationId, language, logger);
          break;

        case 'select_item':
          await this.handleItemSelection(context, value, correlationId, language, logger);
          break;

        case 'submit_item_selections':
          await this.handleBatchItemSelection(context, value, correlationId, language, logger);
          break;

        case 'skip_item':
          await this.handleSkipItem(context, value, correlationId, language, logger);
          break;

        case 'cancel_selection':
          await this.handleCancelSelection(context, value, correlationId, language, logger);
          break;

        case 'confirm_cancel':
          await this.handleConfirmCancel(context, value, correlationId, language, logger);
          break;

        case 'dismiss':
          // User dismissed a card, no action needed
          logger.info('Card dismissed', { caseId: value.caseId });
          break;

        default:
          const unknownMsg = language === 'fa'
            ? `اقدام ناشناخته: ${value.action}`
            : `Unknown action: ${value.action}`;
          await context.sendActivity(unknownMsg);
      }
    } catch (error) {
      logger.error('Failed to handle card submission', error);

      const errorMsg = language === 'fa'
        ? `خطا در پردازش اقدام شما: ${error instanceof Error ? error.message : 'خطای ناشناخته'}`
        : `Failed to process your action: ${error instanceof Error ? error.message : 'Unknown error'}`;

      const correlationMsg = language === 'fa'
        ? `شناسه ردیابی: ${correlationId}`
        : `Correlation ID: ${correlationId}`;

      await context.sendActivity(`${errorMsg}\n\n${correlationMsg}`);
    }
  }

  /**
   * Handle submission of corrections from issues card
   * Extracts both inline corrections and general notes
   */
  private async handleSubmitCorrections(
    context: TurnContext,
    value: ExtendedCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    // Extract inline corrections from card submission
    const inlineCorrections = this.extractInlineCorrections(value);

    logger.info('Submitting corrections', {
      caseId: value.caseId,
      hasNotes: !!value.userNotes,
      inlineCorrectionCount: Object.keys(inlineCorrections).length,
    });

    // Build corrections payload
    const corrections = {
      userNotes: value.userNotes,
      inlineCorrections,
      submittedAt: new Date().toISOString(),
      language,
    };

    // Submit corrections to workflow
    await this.caseService.submitCorrections(
      value.caseId,
      corrections,
      correlationId
    );

    // Send processing card with language support
    const statusMessage = language === 'fa'
      ? 'در حال بررسی مجدد با اصلاحات شما...'
      : 'Re-validating with your corrections...';

    const processingCard = createProcessingCard(
      value.caseId,
      'order.xlsx',
      correlationId,
      statusMessage
    );

    const cardAttachment: Attachment = CardFactory.adaptiveCard(processingCard);
    await context.sendActivity({ attachments: [cardAttachment] });

    logger.info('Corrections submitted', {
      caseId: value.caseId,
      correctionCount: Object.keys(inlineCorrections).length,
    });
  }

  /**
   * Extract inline corrections from card submission
   * Looks for fields named: correction_{issueCode}_{index}
   */
  private extractInlineCorrections(value: ExtendedCardAction): Record<string, string> {
    const corrections: Record<string, string> = {};

    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('correction_') && val && typeof val === 'string' && val.trim()) {
        // Extract issue code from key: correction_{code}_{index}
        const parts = key.split('_');
        if (parts.length >= 2) {
          const issueCode = parts.slice(1, -1).join('_'); // Handle codes with underscores
          const index = parts[parts.length - 1];
          corrections[`${issueCode}_${index}`] = val.trim();
        }
      }
    }

    return corrections;
  }

  /**
   * Handle request to re-upload spreadsheet
   */
  private async handleRequestReupload(
    context: TurnContext,
    value: ExtendedCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    const reason = (value as any).reason;

    logger.info('Reupload requested', {
      caseId: value.caseId,
      reason,
    });

    const isFormulaBlocked = reason === 'formula_blocked';

    const message = language === 'fa'
      ? [
          'لطفاً یک صفحه گسترده اصلاح شده آپلود کنید.',
          '',
          '**نکات برای آپلود موفق:**',
          isFormulaBlocked
            ? '- فایل را به صورت مقادیر خالص ذخیره کنید (بدون فرمول)'
            : '- از فرمول استفاده نکنید',
          '- اطمینان حاصل کنید که تمام فیلدهای مورد نیاز موجود هستند (مشتری، کد محصول، تعداد)',
          '- از یک شیت با سرستون‌های واضح استفاده کنید',
          '',
          `پرونده اصلی: ${value.caseId}`,
          `شناسه ردیابی: ${correlationId}`,
        ].join('\n')
      : [
          'Please upload a revised spreadsheet.',
          '',
          '**Tips for a successful upload:**',
          isFormulaBlocked
            ? '- Export as values-only (no formulas) - this was the issue'
            : '- Export as values-only (no formulas)',
          '- Ensure all required fields are present (Customer, SKU/GTIN, Quantity)',
          '- Use a single sheet with clear headers',
          '',
          `Original case: ${value.caseId}`,
          `Correlation ID: ${correlationId}`,
        ].join('\n');

    await context.sendActivity(message);
  }

  /**
   * Handle approval to create draft in Zoho
   */
  private async handleApproveCreate(
    context: TurnContext,
    value: AdaptiveCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    logger.info('Order approved for creation', { caseId: value.caseId });

    // Send immediate acknowledgment
    const ackMessage = language === 'fa'
      ? 'در حال ایجاد پیش‌نویس سفارش فروش در Zoho Books...'
      : 'Creating draft sales order in Zoho Books...';

    await context.sendActivity(ackMessage);

    // Trigger creation workflow
    await this.caseService.approveAndCreate(value.caseId, correlationId);

    logger.info('Creation workflow triggered', { caseId: value.caseId });
  }

  /**
   * Handle request for changes
   */
  private async handleRequestChanges(
    context: TurnContext,
    value: AdaptiveCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    logger.info('Changes requested', { caseId: value.caseId });

    const reason = value.userNotes || (language === 'fa' ? 'کاربر درخواست تغییرات داد' : 'User requested changes');

    await this.caseService.requestChanges(value.caseId, reason, correlationId);

    const message = language === 'fa'
      ? [
          'درخواست تغییرات شما ثبت شد.',
          '',
          'لطفاً جزئیات تغییرات مورد نیاز را ارائه دهید و سپس یک صفحه گسترده اصلاح شده آپلود کنید.',
          '',
          `پرونده: ${value.caseId}`,
          `شناسه ردیابی: ${correlationId}`,
        ].join('\n')
      : [
          'Your change request has been recorded.',
          '',
          'Please provide details about the changes needed, then upload a revised spreadsheet.',
          '',
          `Case: ${value.caseId}`,
          `Correlation ID: ${correlationId}`,
        ].join('\n');

    await context.sendActivity(message);
  }

  /**
   * Detect language from activity context
   */
  private detectLanguage(context: TurnContext): SupportedLanguage {
    const activity = context.activity;

    // First try locale from activity
    const localeLanguage = languageService.detectFromLocale(activity.locale);
    if (localeLanguage === 'fa') {
      return 'fa';
    }

    // Check for Farsi in any text content
    const value = activity.value as any;
    if (value?.userNotes && languageService.containsFarsi(value.userNotes)) {
      return 'fa';
    }

    return 'en';
  }

  // ============================================================================
  // Selection Signal Handlers
  // ============================================================================

  /**
   * Handle customer selection from disambiguation card
   * Sends SelectionsSubmitted signal to Temporal workflow
   */
  private async handleCustomerSelection(
    context: TurnContext,
    value: ExtendedCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    const { caseId, tenantId, workflowId, selectedCustomerId } = value as any;

    if (!selectedCustomerId) {
      const message = language === 'fa'
        ? 'لطفا یک مشتری انتخاب کنید.'
        : 'Please select a customer.';
      await context.sendActivity(message);
      return;
    }

    logger.info('Customer selection received', {
      caseId,
      workflowId,
      hasSelection: !!selectedCustomerId,
    });

    try {
      // Parse the selected customer from JSON string
      const selected = JSON.parse(selectedCustomerId);

      // Check if workflow is still running
      const isRunning = await this.workflowClient.isWorkflowRunning(workflowId);
      if (!isRunning) {
        const message = language === 'fa'
          ? 'این پرونده دیگر فعال نیست. لطفا یک سفارش جدید ایجاد کنید.'
          : 'This case is no longer active. Please create a new order.';
        await context.sendActivity(message);
        return;
      }

      // Send SelectionsSubmitted signal to workflow
      const signalPayload = {
        caseId,
        selections: {
          customer: {
            zohoCustomerId: selected.id,
          },
        },
        submittedBy: context.activity.from.aadObjectId || context.activity.from.id,
        submittedAt: new Date().toISOString(),
      };

      await this.workflowClient.signalWorkflow(
        workflowId,
        'selectionsSubmitted',
        signalPayload,
        correlationId
      );

      // Send confirmation
      const confirmMessage = language === 'fa'
        ? `مشتری انتخاب شد: **${selected.name}**. پردازش ادامه دارد...`
        : `Customer selected: **${selected.name}**. Processing will continue...`;

      await context.sendActivity(confirmMessage);

      logger.info('Customer selection signal sent', {
        caseId,
        workflowId,
        customerId: selected.id,
        customerName: selected.name,
      });
    } catch (error) {
      logger.error('Failed to send customer selection signal', error);

      const errorMessage = language === 'fa'
        ? 'خطا در ثبت انتخاب مشتری. لطفا دوباره تلاش کنید.'
        : 'Failed to register customer selection. Please try again.';
      await context.sendActivity(errorMessage);
    }
  }

  /**
   * Handle single item selection from disambiguation card
   * Sends SelectionsSubmitted signal to Temporal workflow
   */
  private async handleItemSelection(
    context: TurnContext,
    value: ExtendedCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    const { caseId, tenantId, workflowId, lineRow, selectedItemId } = value as any;

    if (!selectedItemId) {
      const message = language === 'fa'
        ? 'لطفا یک کالا انتخاب کنید.'
        : 'Please select an item.';
      await context.sendActivity(message);
      return;
    }

    logger.info('Item selection received', {
      caseId,
      workflowId,
      lineRow,
      hasSelection: !!selectedItemId,
    });

    try {
      // Parse the selected item from JSON string
      const selected = JSON.parse(selectedItemId);

      // Check if workflow is still running
      const isRunning = await this.workflowClient.isWorkflowRunning(workflowId);
      if (!isRunning) {
        const message = language === 'fa'
          ? 'این پرونده دیگر فعال نیست. لطفا یک سفارش جدید ایجاد کنید.'
          : 'This case is no longer active. Please create a new order.';
        await context.sendActivity(message);
        return;
      }

      // Send SelectionsSubmitted signal to workflow
      const signalPayload = {
        caseId,
        selections: {
          items: {
            [lineRow]: {
              zohoItemId: selected.id,
            },
          },
        },
        submittedBy: context.activity.from.aadObjectId || context.activity.from.id,
        submittedAt: new Date().toISOString(),
      };

      await this.workflowClient.signalWorkflow(
        workflowId,
        'selectionsSubmitted',
        signalPayload,
        correlationId
      );

      // Send confirmation
      const confirmMessage = language === 'fa'
        ? `کالا برای ردیف ${lineRow} انتخاب شد: **${selected.name}**. پردازش ادامه دارد...`
        : `Item selected for row ${lineRow}: **${selected.name}**. Processing will continue...`;

      await context.sendActivity(confirmMessage);

      logger.info('Item selection signal sent', {
        caseId,
        workflowId,
        lineRow,
        itemId: selected.id,
        itemName: selected.name,
      });
    } catch (error) {
      logger.error('Failed to send item selection signal', error);

      const errorMessage = language === 'fa'
        ? 'خطا در ثبت انتخاب کالا. لطفا دوباره تلاش کنید.'
        : 'Failed to register item selection. Please try again.';
      await context.sendActivity(errorMessage);
    }
  }

  /**
   * Handle batch item selections from multi-item disambiguation card
   * Sends SelectionsSubmitted signal with all item selections
   */
  private async handleBatchItemSelection(
    context: TurnContext,
    value: ExtendedCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    const { caseId, tenantId, workflowId, lineRows } = value as any;

    logger.info('Batch item selection received', {
      caseId,
      workflowId,
      lineRows,
    });

    try {
      // Check if workflow is still running
      const isRunning = await this.workflowClient.isWorkflowRunning(workflowId);
      if (!isRunning) {
        const message = language === 'fa'
          ? 'این پرونده دیگر فعال نیست. لطفا یک سفارش جدید ایجاد کنید.'
          : 'This case is no longer active. Please create a new order.';
        await context.sendActivity(message);
        return;
      }

      // Extract all item selections from the card data
      const itemSelections: Record<number, { zohoItemId: string }> = {};
      const selectedItems: string[] = [];
      const skippedLines: number[] = [];

      for (const lineRow of lineRows) {
        const fieldName = `selectedItem_${lineRow}`;
        const selectedValue = (value as any)[fieldName];

        if (selectedValue) {
          const selected = JSON.parse(selectedValue);

          if (selected.skip) {
            skippedLines.push(lineRow);
          } else {
            itemSelections[lineRow] = {
              zohoItemId: selected.id,
            };
            selectedItems.push(`Row ${lineRow}: ${selected.name}`);
          }
        }
      }

      // Send SelectionsSubmitted signal to workflow
      const signalPayload = {
        caseId,
        selections: {
          items: itemSelections,
        },
        submittedBy: context.activity.from.aadObjectId || context.activity.from.id,
        submittedAt: new Date().toISOString(),
      };

      await this.workflowClient.signalWorkflow(
        workflowId,
        'selectionsSubmitted',
        signalPayload,
        correlationId
      );

      // Build confirmation message
      const selectedCount = Object.keys(itemSelections).length;
      const skippedCount = skippedLines.length;

      let confirmMessage: string;
      if (language === 'fa') {
        confirmMessage = `${selectedCount} کالا انتخاب شد`;
        if (skippedCount > 0) {
          confirmMessage += ` و ${skippedCount} ردیف رد شد`;
        }
        confirmMessage += '. پردازش ادامه دارد...';
      } else {
        confirmMessage = `${selectedCount} item(s) selected`;
        if (skippedCount > 0) {
          confirmMessage += ` and ${skippedCount} line(s) skipped`;
        }
        confirmMessage += '. Processing will continue...';
      }

      await context.sendActivity(confirmMessage);

      logger.info('Batch item selection signal sent', {
        caseId,
        workflowId,
        selectedCount,
        skippedCount,
      });
    } catch (error) {
      logger.error('Failed to send batch item selection signal', error);

      const errorMessage = language === 'fa'
        ? 'خطا در ثبت انتخاب کالاها. لطفا دوباره تلاش کنید.'
        : 'Failed to register item selections. Please try again.';
      await context.sendActivity(errorMessage);
    }
  }

  /**
   * Handle skip item action (user chooses to skip a line)
   */
  private async handleSkipItem(
    context: TurnContext,
    value: ExtendedCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    const { caseId, tenantId, workflowId, lineRow } = value as any;

    logger.info('Skip item received', {
      caseId,
      workflowId,
      lineRow,
    });

    try {
      // Check if workflow is still running
      const isRunning = await this.workflowClient.isWorkflowRunning(workflowId);
      if (!isRunning) {
        const message = language === 'fa'
          ? 'این پرونده دیگر فعال نیست.'
          : 'This case is no longer active.';
        await context.sendActivity(message);
        return;
      }

      // Send signal with empty items selection for this line (indicating skip)
      const signalPayload = {
        caseId,
        selections: {
          items: {},  // Empty items indicates skip
        },
        submittedBy: context.activity.from.aadObjectId || context.activity.from.id,
        submittedAt: new Date().toISOString(),
      };

      await this.workflowClient.signalWorkflow(
        workflowId,
        'selectionsSubmitted',
        signalPayload,
        correlationId
      );

      const confirmMessage = language === 'fa'
        ? `ردیف ${lineRow} رد شد. پردازش ادامه دارد...`
        : `Row ${lineRow} skipped. Processing will continue...`;

      await context.sendActivity(confirmMessage);

      logger.info('Skip item signal sent', {
        caseId,
        workflowId,
        lineRow,
      });
    } catch (error) {
      logger.error('Failed to send skip item signal', error);

      const errorMessage = language === 'fa'
        ? 'خطا در رد کردن ردیف. لطفا دوباره تلاش کنید.'
        : 'Failed to skip line. Please try again.';
      await context.sendActivity(errorMessage);
    }
  }

  /**
   * Handle selection cancellation
   */
  private async handleCancelSelection(
    context: TurnContext,
    value: ExtendedCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    const { caseId, workflowId, selectionType } = value as any;

    logger.info('Selection cancelled', {
      caseId,
      workflowId,
      selectionType,
    });

    const selectionTypeStr = selectionType === 'customer'
      ? (language === 'fa' ? 'مشتری' : 'customer')
      : (language === 'fa' ? 'کالا' : 'item');

    const message = language === 'fa'
      ? `انتخاب ${selectionTypeStr} لغو شد. پرونده همچنان در انتظار انتخاب است.`
      : `${selectionType.charAt(0).toUpperCase() + selectionType.slice(1)} selection cancelled. Case is still awaiting selection.`;

    await context.sendActivity(message);
  }

  /**
   * Handle order cancellation confirmation
   * Cancels the Temporal workflow and updates case status
   */
  private async handleConfirmCancel(
    context: TurnContext,
    value: ExtendedCardAction,
    correlationId: string,
    language: SupportedLanguage,
    logger: any
  ): Promise<void> {
    const { caseId, tenantId, workflowId } = value as any;

    logger.info('Cancel confirmation received', {
      caseId,
      workflowId,
      tenantId,
    });

    try {
      // Cancel the Temporal workflow if workflow ID is provided
      if (workflowId) {
        try {
          await this.workflowClient.cancelWorkflow(workflowId, correlationId);
          logger.info('Workflow cancellation signal sent', { workflowId });
        } catch (workflowError) {
          // Log but don't fail if workflow cancellation fails (might already be stopped)
          logger.warn('Failed to cancel workflow (may already be stopped)', {
            workflowId,
            error: workflowError instanceof Error ? workflowError.message : String(workflowError),
          });
        }
      }

      // Update case status to cancelled
      if (tenantId) {
        await this.caseService.updateCaseStatus(
          caseId,
          tenantId,
          'cancelled',
          {
            error: 'User requested cancellation',
          }
        );
        logger.info('Case status updated to cancelled', { caseId });
      }

      // Send confirmation message
      const confirmMessage = language === 'fa'
        ? `سفارش ${caseId} لغو شد.`
        : `Order ${caseId} has been cancelled.`;

      await context.sendActivity(confirmMessage);

      logger.info('Order cancellation completed', { caseId });
    } catch (error) {
      logger.error('Failed to cancel order', {
        caseId,
        error: error instanceof Error ? error.message : String(error),
      });

      const errorMessage = language === 'fa'
        ? `خطا در لغو سفارش: ${error instanceof Error ? error.message : 'خطای ناشناخته'}`
        : `Failed to cancel order: ${error instanceof Error ? error.message : 'Unknown error'}`;

      await context.sendActivity(errorMessage);
    }
  }
}
