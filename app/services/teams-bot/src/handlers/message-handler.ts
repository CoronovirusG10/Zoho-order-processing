/**
 * Handler for text messages
 * Enhanced with bilingual support (English and Farsi)
 */

import { TurnContext } from 'botbuilder';
import { getCorrelationId } from '../middleware/correlation-middleware.js';
import { createLogger } from '../middleware/logging-middleware.js';
import { languageService, SupportedLanguage } from '../services/language-service.js';

export class MessageHandler {
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
    // In a real implementation, this would query Cosmos DB for user's recent cases
    const message = language === 'fa'
      ? [
          '**پرونده‌های اخیر شما**',
          '',
          'این قابلیت به زودی فعال می‌شود. شما قادر خواهید بود:',
          '- تمام سفارش‌های ارسالی خود را مشاهده کنید',
          '- وضعیت پردازش آنها را بررسی کنید',
          '- بسته‌های حسابرسی را دانلود کنید',
          '',
          'در حال حاضر، لطفاً از تب "پرونده‌های من" در Teams استفاده کنید.',
        ].join('\n')
      : [
          '**Your Recent Cases**',
          '',
          'This feature is coming soon. You will be able to:',
          '- View all your submitted orders',
          '- Check their processing status',
          '- Download audit bundles',
          '',
          'For now, please use the "My Cases" tab in Teams.',
        ].join('\n');

    await context.sendActivity(message);
  }
}
