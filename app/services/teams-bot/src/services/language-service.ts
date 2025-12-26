/**
 * Language service for Farsi detection and bilingual message support
 * Provides localized messages in English and Farsi (Persian)
 */

/**
 * Supported languages
 */
export type SupportedLanguage = 'en' | 'fa';

/**
 * Message keys for localization
 */
export type MessageKey =
  | 'welcome'
  | 'welcomeTitle'
  | 'helpTitle'
  | 'helpFileTypes'
  | 'helpProcess'
  | 'fileReceived'
  | 'processingOrder'
  | 'processingStatus'
  | 'actionRequired'
  | 'issuesFound'
  | 'submitCorrections'
  | 'uploadRevised'
  | 'approveCreate'
  | 'requestChanges'
  | 'draftCreated'
  | 'draftWarning'
  | 'viewInZoho'
  | 'downloadAudit'
  | 'errorOccurred'
  | 'tryAgain'
  | 'correlationId'
  | 'caseId'
  | 'customer'
  | 'lineItems'
  | 'total'
  | 'status'
  | 'file'
  | 'formulaBlocked'
  | 'formulaBlockedDetail'
  | 'reuploadRequired'
  | 'supportedLanguages'
  | 'help'
  | 'commands'
  | 'tips'
  | 'privacy';

/**
 * Bilingual message content
 */
interface BilingualMessage {
  en: string;
  fa: string;
}

/**
 * Message catalog with English and Farsi translations
 */
const MESSAGES: Record<MessageKey, BilingualMessage> = {
  welcome: {
    en: 'Welcome to the Sales Order Processing Bot!',
    fa: 'به ربات پردازش سفارش فروش خوش آمدید!',
  },
  welcomeTitle: {
    en: 'Sales Order Processing Bot',
    fa: 'ربات پردازش سفارش فروش',
  },
  helpTitle: {
    en: 'Help',
    fa: 'راهنما',
  },
  helpFileTypes: {
    en: 'What files can I upload?',
    fa: 'چه فایل‌هایی می‌توانم آپلود کنم؟',
  },
  helpProcess: {
    en: 'What happens after I upload?',
    fa: 'بعد از آپلود چه اتفاقی می‌افتد؟',
  },
  fileReceived: {
    en: 'File received. Processing...',
    fa: 'فایل دریافت شد. در حال پردازش...',
  },
  processingOrder: {
    en: 'Processing Order...',
    fa: 'در حال پردازش سفارش...',
  },
  processingStatus: {
    en: 'Your file is being processed. This may take a moment.',
    fa: 'فایل شما در حال پردازش است. این ممکن است کمی طول بکشد.',
  },
  actionRequired: {
    en: 'Action Required',
    fa: 'اقدام لازم است',
  },
  issuesFound: {
    en: 'The spreadsheet could not be processed automatically. Please resolve the items below.',
    fa: 'صفحه گسترده به صورت خودکار پردازش نشد. لطفاً موارد زیر را برطرف کنید.',
  },
  submitCorrections: {
    en: 'Submit Corrections',
    fa: 'ارسال اصلاحات',
  },
  uploadRevised: {
    en: 'Upload Revised Spreadsheet',
    fa: 'آپلود صفحه گسترده اصلاح شده',
  },
  approveCreate: {
    en: 'Approve & Create Draft in Zoho',
    fa: 'تأیید و ایجاد پیش‌نویس در Zoho',
  },
  requestChanges: {
    en: 'Request Changes',
    fa: 'درخواست تغییرات',
  },
  draftCreated: {
    en: 'Draft Sales Order Created',
    fa: 'پیش‌نویس سفارش فروش ایجاد شد',
  },
  draftWarning: {
    en: 'Important: This is a DRAFT order. Please review in Zoho Books and confirm before sending to customer.',
    fa: 'مهم: این یک سفارش پیش‌نویس است. لطفاً قبل از ارسال به مشتری در Zoho Books بررسی و تأیید کنید.',
  },
  viewInZoho: {
    en: 'View in Zoho Books',
    fa: 'مشاهده در Zoho Books',
  },
  downloadAudit: {
    en: 'Download Audit Bundle',
    fa: 'دانلود بسته حسابرسی',
  },
  errorOccurred: {
    en: 'Sorry, something went wrong while processing your request.',
    fa: 'متأسفیم، هنگام پردازش درخواست شما مشکلی پیش آمد.',
  },
  tryAgain: {
    en: 'Please try again or contact support if the problem persists.',
    fa: 'لطفاً دوباره تلاش کنید یا در صورت ادامه مشکل با پشتیبانی تماس بگیرید.',
  },
  correlationId: {
    en: 'Correlation ID',
    fa: 'شناسه ردیابی',
  },
  caseId: {
    en: 'Case',
    fa: 'پرونده',
  },
  customer: {
    en: 'Customer',
    fa: 'مشتری',
  },
  lineItems: {
    en: 'Line items',
    fa: 'ردیف‌های سفارش',
  },
  total: {
    en: 'Total',
    fa: 'جمع کل',
  },
  status: {
    en: 'Status',
    fa: 'وضعیت',
  },
  file: {
    en: 'File',
    fa: 'فایل',
  },
  formulaBlocked: {
    en: 'File Contains Formulas - Upload Blocked',
    fa: 'فایل حاوی فرمول است - آپلود مسدود شد',
  },
  formulaBlockedDetail: {
    en: 'For security and accuracy, files with formulas cannot be processed. Please export as values-only and re-upload.',
    fa: 'به دلایل امنیتی و دقت، فایل‌های حاوی فرمول قابل پردازش نیستند. لطفاً فایل را به صورت مقادیر خالص ذخیره و دوباره آپلود کنید.',
  },
  reuploadRequired: {
    en: 'Please upload a revised file',
    fa: 'لطفاً فایل اصلاح شده را آپلود کنید',
  },
  supportedLanguages: {
    en: 'Supported languages: English and Farsi',
    fa: 'زبان‌های پشتیبانی شده: انگلیسی و فارسی',
  },
  help: {
    en: 'help',
    fa: 'راهنما',
  },
  commands: {
    en: 'Commands',
    fa: 'دستورات',
  },
  tips: {
    en: 'Tips for best results',
    fa: 'نکات برای نتایج بهتر',
  },
  privacy: {
    en: 'Privacy',
    fa: 'حریم خصوصی',
  },
};

/**
 * Language service for detecting and handling bilingual messages
 */
export class LanguageService {
  private defaultLanguage: SupportedLanguage;

  constructor(defaultLanguage: SupportedLanguage = 'en') {
    this.defaultLanguage = defaultLanguage;
  }

  /**
   * Detect language from text
   * Uses Persian Unicode range detection
   */
  detectLanguage(text: string): SupportedLanguage {
    if (!text) {
      return this.defaultLanguage;
    }

    // Persian/Arabic Unicode ranges
    // Persian specific: \u0600-\u06FF (Arabic block, includes Persian)
    // Persian digits: \u06F0-\u06F9
    const persianPattern = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

    // Count Persian characters
    const persianMatches = text.match(new RegExp(persianPattern.source, 'g')) || [];
    const persianRatio = persianMatches.length / text.replace(/\s/g, '').length;

    // If more than 30% Persian characters, consider it Farsi
    return persianRatio > 0.3 ? 'fa' : 'en';
  }

  /**
   * Detect language from Teams activity locale
   */
  detectFromLocale(locale: string | undefined): SupportedLanguage {
    if (!locale) {
      return this.defaultLanguage;
    }

    const normalizedLocale = locale.toLowerCase();

    // Check for Persian/Farsi locale codes
    if (
      normalizedLocale.startsWith('fa') ||
      normalizedLocale.startsWith('per') ||
      normalizedLocale.startsWith('fas')
    ) {
      return 'fa';
    }

    return 'en';
  }

  /**
   * Get a localized message
   */
  getMessage(key: MessageKey, language: SupportedLanguage): string {
    const message = MESSAGES[key];
    return message ? message[language] : key;
  }

  /**
   * Get bilingual message (both languages)
   */
  getBilingualMessage(key: MessageKey): BilingualMessage {
    return MESSAGES[key] || { en: key, fa: key };
  }

  /**
   * Format a bilingual message for display
   * Shows both languages separated by newline
   */
  formatBilingual(key: MessageKey, primaryLanguage: SupportedLanguage = 'en'): string {
    const message = MESSAGES[key];
    if (!message) {
      return key;
    }

    if (primaryLanguage === 'fa') {
      return `${message.fa}\n${message.en}`;
    }

    return `${message.en}\n${message.fa}`;
  }

  /**
   * Check if text contains Farsi characters
   */
  containsFarsi(text: string): boolean {
    const persianPattern = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return persianPattern.test(text);
  }

  /**
   * Check if text is a Farsi command
   */
  isFarsiCommand(text: string): boolean {
    const farsiCommands = ['راهنما', 'کمک', 'وضعیت', 'سفارش'];
    return farsiCommands.some(cmd => text.includes(cmd));
  }

  /**
   * Get direction for text (RTL for Farsi)
   */
  getTextDirection(language: SupportedLanguage): 'ltr' | 'rtl' {
    return language === 'fa' ? 'rtl' : 'ltr';
  }
}

/**
 * Create a bilingual text block for adaptive cards
 */
export function createBilingualTextBlock(
  key: MessageKey,
  primaryLanguage: SupportedLanguage = 'en',
  options: {
    weight?: 'Default' | 'Bolder' | 'Lighter';
    size?: 'Default' | 'Small' | 'Medium' | 'Large' | 'ExtraLarge';
    wrap?: boolean;
  } = {}
): any {
  const service = new LanguageService();
  const message = service.getBilingualMessage(key);

  const primaryText = primaryLanguage === 'fa' ? message.fa : message.en;
  const secondaryText = primaryLanguage === 'fa' ? message.en : message.fa;

  return {
    type: 'Container',
    items: [
      {
        type: 'TextBlock',
        text: primaryText,
        weight: options.weight || 'Default',
        size: options.size || 'Default',
        wrap: options.wrap !== false,
      },
      {
        type: 'TextBlock',
        text: secondaryText,
        isSubtle: true,
        size: options.size === 'Large' || options.size === 'ExtraLarge' ? 'Medium' : 'Small',
        wrap: options.wrap !== false,
      },
    ],
  };
}

/**
 * Default language service instance
 */
export const languageService = new LanguageService();
