/**
 * Handler for adaptive card submissions
 * Enhanced with language support and inline correction extraction
 */

import { TurnContext, CardFactory, Attachment } from 'botbuilder';
import { CaseService } from '../services/case-service.js';
import { languageService, SupportedLanguage } from '../services/language-service.js';
import { createProcessingCard } from '../cards/processing-card.js';
import { AdaptiveCardAction } from '../types/teams-types.js';
import { getCorrelationId } from '../middleware/correlation-middleware.js';
import { createLogger } from '../middleware/logging-middleware.js';

/**
 * Extended card action with inline corrections
 */
interface ExtendedCardAction extends AdaptiveCardAction {
  // Inline correction fields are dynamically named: correction_{issueCode}_{index}
  [key: string]: any;
}

export class CardSubmitHandler {
  private caseService: CaseService;

  constructor() {
    this.caseService = new CaseService();
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
}
