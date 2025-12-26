import { Router, Request, Response } from 'express';
import { internalAuthMiddleware } from '../middleware/auth.js';
import { asyncHandler, ValidationError } from '../middleware/error-handler.js';
import { serviceFactory } from '../services/service-factory.js';

const router = Router();

// Get services from factory
const caseService = serviceFactory.caseService;
const auditService = serviceFactory.auditService;

// Apply internal auth to all tool routes
router.use(internalAuthMiddleware);

/**
 * POST /tools/parse-excel - Parse Excel file and extract canonical order
 */
router.post(
  '/parse-excel',
  asyncHandler(async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId;
    const { case_id, blob_url, options } = req.body;

    // Validate required fields
    if (!case_id || !blob_url) {
      throw new ValidationError('Missing case_id or blob_url');
    }

    // Log tool call
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Tool call: parse-excel',
        correlationId,
        case_id,
        blob_url,
        options,
      })
    );

    // TODO: Call actual parser service (Azure Function or Container App)
    // For now, return mock response
    const mockResponse = {
      case_id,
      canonical_order: {
        meta: {
          case_id,
          tenant_id: 'mock-tenant',
          received_at: new Date().toISOString(),
          source_filename: 'example.xlsx',
          file_sha256: '0'.repeat(64),
        },
        customer: {
          input_name: 'Sample Customer',
          resolution_status: 'unresolved',
        },
        line_items: [],
        issues: [
          {
            code: 'PARSER_NOT_IMPLEMENTED',
            severity: 'error',
            message: 'Parser service not yet implemented',
          },
        ],
        confidence: {
          overall: 0,
        },
      },
    };

    // Log audit event
    await auditService.logEvent({
      caseId: case_id,
      tenantId: 'mock-tenant',
      timestamp: new Date().toISOString(),
      eventType: 'parse_excel_requested',
      data: {
        blob_url,
        options,
      },
      correlationId,
    });

    res.json(mockResponse);
  })
);

/**
 * POST /tools/committee-review - Run multi-model committee review
 */
router.post(
  '/committee-review',
  asyncHandler(async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId;
    const { case_id, task_type, canonical_order, committee_config } = req.body;

    // Validate required fields
    if (!case_id || !task_type || !canonical_order) {
      throw new ValidationError(
        'Missing case_id, task_type, or canonical_order'
      );
    }

    // Log tool call
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Tool call: committee-review',
        correlationId,
        case_id,
        task_type,
      })
    );

    // TODO: Call actual committee service
    // For now, return mock response
    const mockResponse = {
      case_id,
      consensus: 'majority',
      issues: [
        {
          code: 'COMMITTEE_NOT_IMPLEMENTED',
          severity: 'info',
          message: 'Committee service not yet implemented',
        },
      ],
      provider_outputs: [],
    };

    // Log audit event
    await auditService.logEvent({
      caseId: case_id,
      tenantId: canonical_order.meta?.tenant_id || 'unknown',
      timestamp: new Date().toISOString(),
      eventType: 'committee_review_requested',
      data: {
        task_type,
        committee_config,
      },
      correlationId,
    });

    res.json(mockResponse);
  })
);

/**
 * POST /tools/zoho/create-draft-salesorder - Create draft sales order in Zoho
 */
router.post(
  '/zoho/create-draft-salesorder',
  asyncHandler(async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId;
    const { case_id, canonical_order, dry_run = false } = req.body;

    // Validate required fields
    if (!case_id || !canonical_order) {
      throw new ValidationError('Missing case_id or canonical_order');
    }

    // Log tool call
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Tool call: zoho-create-draft-salesorder',
        correlationId,
        case_id,
        dry_run,
      })
    );

    // TODO: Call actual Zoho integration service
    // For now, return mock response
    const mockResponse = {
      case_id,
      ok: dry_run,
      zoho_salesorder_id: dry_run ? null : 'mock-so-123',
      zoho_salesorder_number: dry_run ? null : 'SO-00123',
      warnings: [],
      errors: dry_run
        ? []
        : [
            {
              code: 'ZOHO_NOT_IMPLEMENTED',
              message: 'Zoho integration not yet implemented',
            },
          ],
    };

    // Log audit event
    await auditService.logEvent({
      caseId: case_id,
      tenantId: canonical_order.meta?.tenant_id || 'unknown',
      timestamp: new Date().toISOString(),
      eventType: dry_run
        ? 'zoho_draft_validated'
        : 'zoho_draft_create_requested',
      data: {
        dry_run,
        customer_id: canonical_order.customer?.zoho_customer_id,
        line_items_count: canonical_order.line_items?.length || 0,
      },
      correlationId,
    });

    // Update case if not dry run
    if (!dry_run && mockResponse.zoho_salesorder_id) {
      await caseService.updateZohoOrder(
        case_id,
        canonical_order.meta?.tenant_id || 'unknown',
        mockResponse.zoho_salesorder_id,
        mockResponse.zoho_salesorder_number || ''
      );
    }

    res.json(mockResponse);
  })
);

export { router as toolsRouter };
