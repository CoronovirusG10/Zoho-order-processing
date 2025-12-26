/**
 * Handler for file upload messages
 * Enhanced with language detection and conversation reference storage
 */

import { TurnContext, CardFactory, Attachment } from 'botbuilder';
import { FileDownloadService } from '../services/file-download.js';
import { CaseService } from '../services/case-service.js';
import { AuthService } from '../services/auth-service.js';
import { conversationStore } from '../services/conversation-store.js';
import { languageService, SupportedLanguage } from '../services/language-service.js';
import { createProcessingCard } from '../cards/processing-card.js';
import { TeamsAttachment, TeamsChannelData } from '../types/teams-types.js';
import { getCorrelationId } from '../middleware/correlation-middleware.js';
import { createLogger } from '../middleware/logging-middleware.js';

export class FileUploadHandler {
  private fileDownloadService: FileDownloadService;
  private caseService: CaseService;
  private authService: AuthService;

  constructor() {
    this.fileDownloadService = new FileDownloadService();
    this.caseService = new CaseService();
    this.authService = new AuthService();
  }

  async handle(context: TurnContext): Promise<void> {
    const correlationId = getCorrelationId(context);
    const logger = createLogger(correlationId);

    const activity = context.activity;
    const attachments = activity.attachments || [];

    // Detect language from activity locale or text
    const language = this.detectLanguage(context);

    // Filter for Excel files
    const excelAttachments = attachments.filter(att =>
      this.isExcelFile(att)
    );

    if (excelAttachments.length === 0) {
      const message = language === 'fa'
        ? 'لطفاً یک فایل اکسل (.xlsx) حاوی سفارش فروش آپلود کنید.'
        : 'Please upload an Excel file (.xlsx) containing the sales order.';
      await context.sendActivity(message);
      return;
    }

    if (excelAttachments.length > 1) {
      const message = language === 'fa'
        ? 'لطفاً هر بار فقط یک فایل اکسل آپلود کنید. چندین فایل شناسایی شد.'
        : 'Please upload only one Excel file at a time. Multiple files were detected.';
      await context.sendActivity(message);
      return;
    }

    const attachment = excelAttachments[0] as any as TeamsAttachment;

    try {
      // Validate tenant for cross-tenant access
      const tenantInfo = await this.authService.validateTenant(context);

      // Send initial acknowledgment in detected language
      const ackMessage = languageService.getMessage('fileReceived', language);
      await context.sendActivity(ackMessage);

      // Extract Teams metadata
      const channelData = activity.channelData as TeamsChannelData;
      const conversationId = activity.conversation?.id || 'unknown';

      // Create case
      const caseMetadata = await this.caseService.createCase({
        tenantId: tenantInfo.tenantId,
        userId: tenantInfo.userId,
        conversationId,
        activityId: activity.id || 'unknown',
        fileName: attachment.name || 'unknown.xlsx',
        correlationId,
      });

      logger.info('Case created', {
        caseId: caseMetadata.caseId,
        tenantId: tenantInfo.tenantId,
        userId: tenantInfo.userId,
        language,
      });

      // Store conversation reference for proactive messaging
      await conversationStore.store(context, caseMetadata.caseId);

      logger.info('Conversation reference stored', {
        caseId: caseMetadata.caseId,
        conversationId,
      });

      // Download and store file
      const uploadResult = await this.fileDownloadService.downloadAndStore(
        attachment,
        caseMetadata.caseId,
        correlationId
      );

      logger.info('File uploaded to blob', {
        caseId: caseMetadata.caseId,
        blobUri: uploadResult.blobUri,
        sha256: uploadResult.sha256,
        size: uploadResult.size,
      });

      // Update case metadata with blob info
      caseMetadata.blobUri = uploadResult.blobUri;
      caseMetadata.fileSha256 = uploadResult.sha256;

      // Send processing card with language support
      const processingCard = createProcessingCard(
        caseMetadata.caseId,
        caseMetadata.fileName,
        correlationId,
        language === 'fa' ? 'در حال تجزیه و تحلیل صفحه گسترده...' : 'Analyzing spreadsheet...'
      );

      const cardAttachment: Attachment = CardFactory.adaptiveCard(processingCard);
      await context.sendActivity({ attachments: [cardAttachment] });

      // Trigger parser workflow with language preference
      await this.caseService.triggerParser({
        ...caseMetadata,
        // Add language preference for downstream services
        language,
      } as any);

      logger.info('Parser workflow triggered', {
        caseId: caseMetadata.caseId,
        language,
      });
    } catch (error) {
      logger.error('Failed to process file upload', error);

      // Send error message in detected language
      const errorMsg = language === 'fa'
        ? `خطا در پردازش فایل: ${error instanceof Error ? error.message : 'خطای ناشناخته'}`
        : `Failed to process your file: ${error instanceof Error ? error.message : 'Unknown error'}`;

      const correlationMsg = language === 'fa'
        ? `شناسه ردیابی: ${correlationId}`
        : `Correlation ID: ${correlationId}`;

      await context.sendActivity(`${errorMsg}\n\n${correlationMsg}`);
    }
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

    // Then try to detect from any accompanying text
    if (activity.text && languageService.containsFarsi(activity.text)) {
      return 'fa';
    }

    return 'en';
  }

  private isExcelFile(attachment: any): boolean {
    const excelContentTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (excelContentTypes.includes(attachment.contentType)) {
      return true;
    }

    const fileName = attachment.name?.toLowerCase() || '';
    return fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
  }
}
