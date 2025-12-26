import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  CaseStatus,
  UserRole,
} from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { publicApiLimiter } from '../middleware/rate-limit.js';
import { asyncHandler, ValidationError } from '../middleware/error-handler.js';
import { serviceFactory } from '../services/service-factory.js';

const router = Router();

// Get services from factory
const caseService = serviceFactory.caseService;
const auditService = serviceFactory.auditService;
const blobService = serviceFactory.blobService;

// Apply rate limiting and auth to all routes
router.use(publicApiLimiter);
router.use(authMiddleware());

/**
 * GET /api/cases - List cases
 * Query params: status, customer, dateFrom, dateTo, userId (for managers), limit, offset
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      status,
      customer,
      dateFrom,
      dateTo,
      userId,
      limit = '50',
      offset = '0',
    } = req.query;

    // Parse status filter
    let statusFilter: CaseStatus[] | undefined;
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      statusFilter = statusArray.map((s) => s as CaseStatus);
    }

    const filters = {
      status: statusFilter,
      customer: customer as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      userId: userId as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const result = await caseService.listCases(filters, req.auth);

    res.json(result);
  })
);

/**
 * GET /api/cases/:caseId - Get case details
 */
router.get(
  '/:caseId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.params;

    const caseRecord = await caseService.getCase(caseId, req.auth);

    res.json(caseRecord);
  })
);

/**
 * GET /api/cases/:caseId/audit - Get audit trail for case
 */
router.get(
  '/:caseId/audit',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.params;

    // Verify access to case first
    await caseService.getCase(caseId, req.auth);

    // Get audit events
    const events = await auditService.getEvents(caseId);

    res.json({ events });
  })
);

/**
 * GET /api/cases/:caseId/download-sas - Get SAS URL for file download
 */
router.get(
  '/:caseId/download-sas',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.params;

    // Verify access to case
    const caseRecord = await caseService.getCase(caseId, req.auth);

    // Generate SAS URL for the original file
    // Extract container and blob path from blobUrl
    const blobUrl = new URL(caseRecord.blobUrl);
    const pathParts = blobUrl.pathname.split('/');
    const containerName = pathParts[1];
    const blobName = pathParts.slice(2).join('/');

    const sasResponse = await blobService.generateDownloadSasUrl(
      containerName,
      blobName,
      60 // 1 hour expiry
    );

    res.json(sasResponse);
  })
);

export { router as casesRouter };
