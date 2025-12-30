/**
 * Handler for text messages
 * Enhanced with bilingual support (English and Farsi)
 */

import { TurnContext, CardFactory } from 'botbuilder';
import { getCorrelationId } from '../middleware/correlation-middleware.js';
import { createLogger } from '../middleware/logging-middleware.js';
import { languageService, SupportedLanguage } from '../services/language-service.js';
import { CaseService, CaseSummary, CaseDocument } from '../services/case-service.js';
import { TeamsChannelData } from '../types/teams-types.js';
import { createCancelConfirmationCard } from '../cards/cancel-confirmation-card.js';

export class MessageHandler {
  private caseService: CaseService;

  constructor() {
    this.caseService = new CaseService();
  }
  async handle(context: TurnContext): Promise<void> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    const text = context.activity.text?.trim().toLowerCase() || '';
    const language = this.detectLanguage(context);

    logger.info('Message received', {
      text: text.substring(0, 50),
      language,
    });

    // Simple command handling - support both languages
    if (text === 'help' || text === 'راهنما' || text === 'کمک') {
      await this.sendHelpMessage(context, language);
      return;
    }

    if (text === 'status' || text === 'وضعیت') {
      await this.sendStatusMessage(context, language);
      return;
    }

    // Cancel command - support "cancel", "cancel [case-id]", "/cancel", "/cancel [case-id]"
    if (text === 'cancel' || text === 'لغو' || text.startsWith('cancel ') || text.startsWith('/cancel') || text.startsWith('لغو ')) {
      const args = text.replace(/^(\/cancel|cancel|لغو)\s*/, '').trim();
      await this.handleCancelCommand(context, language, args || undefined);
      return;
    }

    // Default response
    await this.sendWelcomeMessage(context, language);
  }

  /**
   * Detect language from activity
   */
  private detectLanguage(context: TurnContext): SupportedLanguage {
    const activity = context.activity;
    const text = activity.text || '';

    // Check if text contains Farsi
    if (languageService.containsFarsi(text)) {
      return 'fa';
    }

    // Check locale
    return languageService.detectFromLocale(activity.locale);
  }

  private async sendWelcomeMessage(context: TurnContext, language: SupportedLanguage): Promise<void> {
    const message = language === 'fa'
      ? [
          'به ربات پردازش سفارش فروش خوش آمدید!',
          '',
          '**برای شروع:**',
          '1. یک فایل اکسل (.xlsx) حاوی سفارش فروش خود آپلود کنید',
          '2. من آن را پردازش کرده و مشتری و اقلام را استخراج می‌کنم',
          '3. نتایج را بررسی کنید و برای ایجاد پیش‌نویس در Zoho Books تأیید کنید',
          '',
          '**دستورات:**',
          '- `راهنما` یا `help` را تایپ کنید برای اطلاعات بیشتر',
          '- `وضعیت` یا `status` را تایپ کنید برای بررسی پرونده‌های اخیر',
          '',
          '**زبان‌های پشتیبانی شده:**',
          '- فارسی و انگلیسی (English)',
          '',
          '---',
          '',
          'Welcome to the Sales Order Processing Bot!',
          'Upload an Excel file to get started.',
        ].join('\n')
      : [
          'Welcome to the Sales Order Processing Bot!',
          '',
          '**To get started:**',
          '1. Upload an Excel file (.xlsx) containing your sales order',
          '2. I will process it and extract the customer and line items',
          '3. Review the results and approve to create a draft in Zoho Books',
          '',
          '**Commands:**',
          '- Type `help` for more information',
          '- Type `status` to check your recent cases',
          '',
          '**Supported languages:**',
          '- English and Farsi (فارسی)',
          '',
          '---',
          '',
          'به ربات پردازش سفارش فروش خوش آمدید!',
          'برای شروع یک فایل اکسل آپلود کنید.',
        ].join('\n');

    await context.sendActivity(message);
  }

  private async sendHelpMessage(context: TurnContext, language: SupportedLanguage): Promise<void> {
    const message = language === 'fa'
      ? [
          '**راهنمای پردازش سفارش فروش**',
          '',
          '**چه فایل‌هایی می‌توانم آپلود کنم؟**',
          '- فایل‌های اکسل (.xlsx) حاوی داده‌های سفارش فروش',
          '- هر بار یک فایل',
          '- باید شامل: نام مشتری، کد محصول/بارکد، تعداد',
          '',
          '**بعد از آپلود چه اتفاقی می‌افتد؟**',
          '1. صفحه گسترده تجزیه و تحلیل می‌شود',
          '2. مشتری و اقلام با Zoho Books تطبیق داده می‌شوند',
          '3. اگر مشکلی وجود داشته باشد، از شما خواسته می‌شود اصلاحات ارائه دهید',
          '4. پس از آماده شدن، می‌توانید برای ایجاد پیش‌نویس سفارش تأیید کنید',
          '',
          '**دستورات:**',
          '- `help` یا `راهنما` - نمایش این راهنما',
          '- `status` یا `وضعیت` - نمایش سفارشات اخیر',
          '- `cancel` یا `لغو` - لغو سفارش در حال پردازش',
          '',
          '**نکات برای نتایج بهتر:**',
          '- از سرستون‌های واضح استفاده کنید (مثلاً "مشتری"، "کد محصول"، "تعداد")',
          '- به صورت مقادیر خالص ذخیره کنید (بدون فرمول)',
          '- از یک شیت با داده‌های جدولی استفاده کنید',
          '- اطمینان حاصل کنید کدهای محصول با Zoho Books مطابقت دارند',
          '',
          '**حریم خصوصی:**',
          '- تمام فایل‌ها به صورت امن در Azure Blob Storage ذخیره می‌شوند',
          '- سوابق کامل حسابرسی برای 5+ سال نگهداری می‌شود',
          '- هیچ داده‌ای خارج از سازمان شما به اشتراک گذاشته نمی‌شود',
        ].join('\n')
      : [
          '**Sales Order Processing Help**',
          '',
          '**What files can I upload?**',
          '- Excel files (.xlsx) containing sales order data',
          '- One file at a time',
          '- Should include: Customer name, SKU/GTIN, Quantity',
          '',
          '**What happens after I upload?**',
          '1. The spreadsheet is analyzed',
          '2. Customer and items are matched against Zoho Books',
          '3. If there are issues, you will be asked to provide corrections',
          '4. Once ready, you can approve to create a draft sales order',
          '',
          '**Commands:**',
          '- `help` - Show this help message',
          '- `status` - View your recent orders',
          '- `cancel` - Cancel an in-progress order',
          '',
          '**Tips for best results:**',
          '- Use clear column headers (e.g., "Customer", "SKU", "Quantity")',
          '- Export as values-only (no formulas)',
          '- Use a single sheet with tabular data',
          '- Ensure SKUs match those in Zoho Books',
          '',
          '**Privacy:**',
          '- All files are stored securely in Azure Blob Storage',
          '- Full audit trail is maintained for 5+ years',
          '- No data is shared outside your organization',
        ].join('\n');

    await context.sendActivity(message);
  }

  private async sendStatusMessage(context: TurnContext, language: SupportedLanguage): Promise<void> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    // Extract user ID and tenant ID from activity
    const userId = context.activity.from?.aadObjectId || context.activity.from?.id || 'unknown';
    const channelData = context.activity.channelData as TeamsChannelData | undefined;
    const tenantId = channelData?.tenant?.id || 'default';

    logger.info('Fetching status for user', { userId, tenantId });

    try {
      // Query recent cases from Cosmos DB
      const cases = await this.caseService.getRecentCasesForUser(userId, tenantId, 10);

      if (cases.length === 0) {
        // No cases found - send simple message
        const message = language === 'fa'
          ? [
              '**پرونده‌های اخیر شما**',
              '',
              'هیچ پرونده‌ای یافت نشد.',
              '',
              'برای شروع، یک فایل اکسل (.xlsx) آپلود کنید.',
            ].join('\n')
          : [
              '**Your Recent Cases**',
              '',
              'No cases found.',
              '',
              'To get started, upload an Excel file (.xlsx).',
            ].join('\n');

        await context.sendActivity(message);
        return;
      }

      // Build adaptive card with case list
      const card = this.buildStatusCard(cases, language);
      await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
    } catch (error) {
      logger.error('Failed to fetch case status', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Send fallback message
      const message = language === 'fa'
        ? 'متأسفانه در دریافت وضعیت پرونده‌ها مشکلی پیش آمد. لطفاً دوباره تلاش کنید.'
        : 'Sorry, there was an error fetching your case status. Please try again.';

      await context.sendActivity(message);
    }
  }

  /**
   * Build an adaptive card showing case status list
   */
  private buildStatusCard(cases: CaseSummary[], language: SupportedLanguage): object {
    const title = language === 'fa' ? 'پرونده‌های اخیر شما' : 'Your Recent Cases';
    const subtitle = language === 'fa'
      ? `${cases.length} پرونده یافت شد`
      : `${cases.length} case${cases.length === 1 ? '' : 's'} found`;

    const caseItems = cases.map((c, index) => this.buildCaseFactSet(c, language, index));

    return {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: title,
          weight: 'bolder',
          size: 'large',
        },
        {
          type: 'TextBlock',
          text: subtitle,
          isSubtle: true,
          spacing: 'none',
        },
        {
          type: 'Container',
          separator: true,
          spacing: 'medium',
          items: caseItems,
        },
      ],
    };
  }

  /**
   * Build a fact set for a single case
   */
  private buildCaseFactSet(c: CaseSummary, language: SupportedLanguage, index: number): object {
    const labels = language === 'fa'
      ? {
          file: 'فایل',
          status: 'وضعیت',
          date: 'تاریخ',
          order: 'شماره سفارش',
          customer: 'مشتری',
        }
      : {
          file: 'File',
          status: 'Status',
          date: 'Date',
          order: 'Order #',
          customer: 'Customer',
        };

    const facts: Array<{ title: string; value: string }> = [
      { title: labels.file, value: c.fileName },
      { title: labels.status, value: c.statusDisplay },
      { title: labels.date, value: this.formatDate(c.createdAt, language) },
    ];

    if (c.zohoOrderNumber) {
      facts.push({ title: labels.order, value: c.zohoOrderNumber });
    }

    if (c.customerName) {
      facts.push({ title: labels.customer, value: c.customerName });
    }

    return {
      type: 'Container',
      separator: index > 0,
      spacing: 'medium',
      items: [
        {
          type: 'FactSet',
          facts,
        },
      ],
    };
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date, language: SupportedLanguage): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };

    const locale = language === 'fa' ? 'fa-IR' : 'en-US';
    return date.toLocaleDateString(locale, options);
  }

  /**
   * Handle cancel command
   * Allows users to cancel in-progress workflows
   */
  private async handleCancelCommand(
    context: TurnContext,
    language: SupportedLanguage,
    caseIdArg?: string
  ): Promise<void> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    const userId = context.activity.from?.aadObjectId || context.activity.from?.id || 'unknown';
    const channelData = context.activity.channelData as TeamsChannelData | undefined;
    const tenantId = channelData?.tenant?.id || 'default';

    logger.info('Cancel command received', { userId, tenantId, caseIdArg });

    try {
      let caseId = caseIdArg?.trim();

      // If no case ID provided, find the most recent pending case
      if (!caseId) {
        caseId = await this.caseService.getMostRecentPendingCase(userId, tenantId) || undefined;
      }

      if (!caseId) {
        const message = language === 'fa'
          ? 'هیچ سفارش در حال پردازشی یافت نشد.'
          : 'No pending orders found to cancel.';
        await context.sendActivity(message);
        return;
      }

      // Get case details
      const caseData = await this.caseService.getCase(caseId, tenantId);
      if (!caseData) {
        const message = language === 'fa'
          ? `سفارش ${caseId} یافت نشد.`
          : `Order ${caseId} not found.`;
        await context.sendActivity(message);
        return;
      }

      // Verify ownership
      if (caseData.userId !== userId) {
        const message = language === 'fa'
          ? 'شما فقط می‌توانید سفارشات خود را لغو کنید.'
          : 'You can only cancel your own orders.';
        await context.sendActivity(message);
        return;
      }

      // Check if cancellable
      if (!this.caseService.isCancellableStatus(caseData.status)) {
        const statusDisplay = this.getStatusDisplay(caseData.status, language);
        const message = language === 'fa'
          ? `سفارش ${caseId} در وضعیت ${statusDisplay} است و قابل لغو نیست.`
          : `Order ${caseId} is already ${statusDisplay} and cannot be cancelled.`;
        await context.sendActivity(message);
        return;
      }

      // Send confirmation card
      const confirmCard = createCancelConfirmationCard(caseId, caseData, language);
      await context.sendActivity({
        attachments: [CardFactory.adaptiveCard(confirmCard)],
      });

      logger.info('Cancel confirmation card sent', { caseId });
    } catch (error) {
      logger.error('Failed to process cancel command', {
        error: error instanceof Error ? error.message : String(error),
      });

      const message = language === 'fa'
        ? 'خطا در پردازش درخواست لغو. لطفاً دوباره تلاش کنید.'
        : 'Failed to process cancel request. Please try again.';
      await context.sendActivity(message);
    }
  }

  /**
   * Get localized status display
   */
  private getStatusDisplay(status: string, language: SupportedLanguage): string {
    const statusMapEn: Record<string, string> = {
      storing_file: 'Uploading',
      parsing: 'Analyzing',
      running_committee: 'AI Review',
      awaiting_corrections: 'Needs Corrections',
      resolving_customer: 'Matching Customer',
      awaiting_customer_selection: 'Select Customer',
      resolving_items: 'Matching Items',
      awaiting_item_selection: 'Select Items',
      awaiting_approval: 'Ready for Approval',
      creating_zoho_draft: 'Creating Order',
      queued_for_zoho: 'Queued',
      completed: 'Completed',
      cancelled: 'Cancelled',
      failed: 'Failed',
    };

    const statusMapFa: Record<string, string> = {
      storing_file: 'در حال آپلود',
      parsing: 'در حال تجزیه',
      running_committee: 'بررسی هوش مصنوعی',
      awaiting_corrections: 'نیاز به اصلاح',
      resolving_customer: 'تطبیق مشتری',
      awaiting_customer_selection: 'انتخاب مشتری',
      resolving_items: 'تطبیق اقلام',
      awaiting_item_selection: 'انتخاب اقلام',
      awaiting_approval: 'آماده تأیید',
      creating_zoho_draft: 'ایجاد سفارش',
      queued_for_zoho: 'در صف',
      completed: 'تکمیل شده',
      cancelled: 'لغو شده',
      failed: 'ناموفق',
    };

    const map = language === 'fa' ? statusMapFa : statusMapEn;
    return map[status] || status;
  }
}
