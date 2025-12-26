import { Router, Request, Response } from 'express';
import {
  FileUploadedEvent,
  CorrectionsSubmittedEvent,
  ApprovalEvent,
} from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { botWebhookLimiter } from '../middleware/rate-limit.js';
import { asyncHandler, ValidationError } from '../middleware/error-handler.js';
import { serviceFactory } from '../services/service-factory.js';

const router = Router();

// Get services from factory
const caseService = serviceFactory.caseService;
const auditService = serviceFactory.auditService;

// Apply rate limiting and auth
router.use(botWebhookLimiter);
router.use(authMiddleware()); // Bot should use service principal token

/**
 * POST /api/bot/file-uploaded - Handle file upload from bot
 */
router.post(
  '/file-uploaded',
  asyncHandler(async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId;
    const event = req.body as FileUploadedEvent;

    // Validate required fields
    if (
      !event.caseId ||
      !event.blobUrl ||
      !event.tenantId ||
      !event.userId ||
      !event.fileName ||
      !event.fileSha256
    ) {
      throw new ValidationError('Missing required fields in file upload event');
    }

    // Create case record
    const caseRecord = await caseService.createCase({
      tenantId: event.tenantId,
      userId: event.userId,
      blobUrl: event.blobUrl,
      fileName: event.fileName,
      fileSha256: event.fileSha256,
      correlationId,
      teamsActivityId: event.activityId,
    });

    // Log audit event
    await auditService.logEvent({
      caseId: event.caseId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
      eventType: 'file_uploaded',
      userId: event.userId,
      data: {
        fileName: event.fileName,
        fileSha256: event.fileSha256,
        blobUrl: event.blobUrl,
      },
      correlationId,
    });

    // TODO: Trigger workflow to start processing
    // This would typically send a message to Service Bus or Event Grid

    res.status(201).json({
      caseId: caseRecord.caseId,
      status: caseRecord.status,
      correlationId,
    });
  })
);

/**
 * POST /api/bot/corrections-submitted - Handle user corrections
 */
router.post(
  '/corrections-submitted',
  asyncHandler(async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId;
    const event = req.body as CorrectionsSubmittedEvent;

    // Validate required fields
    if (
      !event.caseId ||
      !event.corrections ||
      !event.userId ||
      !event.tenantId
    ) {
      throw new ValidationError('Missing required fields in corrections event');
    }

    // Apply corrections
    await caseService.applyCorrections(
      event.caseId,
      event.tenantId,
      event.corrections
    );

    // Log audit event
    await auditService.logEvent({
      caseId: event.caseId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
      eventType: 'corrections_submitted',
      userId: event.userId,
      data: {
        corrections: event.corrections,
      },
      correlationId,
    });

    // TODO: Send external event to workflow to re-validate with corrections

    res.json({
      caseId: event.caseId,
      status: 'processing',
      correlationId,
    });
  })
);

/**
 * POST /api/bot/approval - Handle approval decision
 */
router.post(
  '/approval',
  asyncHandler(async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId;
    const event = req.body as ApprovalEvent;

    // Validate required fields
    if (
      event.caseId === undefined ||
      event.approved === undefined ||
      !event.userId ||
      !event.tenantId
    ) {
      throw new ValidationError('Missing required fields in approval event');
    }

    // Update case status based on approval
    const newStatus = event.approved ? 'approved' : 'needs_input';
    await caseService.updateStatus(event.caseId, event.tenantId, newStatus as any);

    // Log audit event
    await auditService.logEvent({
      caseId: event.caseId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
      eventType: event.approved ? 'approved' : 'rejected',
      userId: event.userId,
      data: {
        approved: event.approved,
      },
      correlationId,
    });

    // TODO: If approved, trigger Zoho draft creation workflow

    res.json({
      caseId: event.caseId,
      status: newStatus,
      correlationId,
    });
  })
);

export { router as botEventsRouter };
