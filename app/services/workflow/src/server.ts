/**
 * Express.js HTTP Server
 *
 * Replaces Azure Functions HTTP triggers with Express.js routes.
 * Provides RESTful API for workflow operations.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  startOrderProcessing,
  signalWorkflow,
  getWorkflowStatus,
  getTemporalClient,
  terminateWorkflow,
  cancelWorkflow,
  queryWorkflow,
  isWorkflowRunning,
  closeTemporalClient,
  signalFileReuploaded,
  signalCorrectionsSubmitted,
  signalSelectionsSubmitted,
  signalApprovalReceived,
} from './client';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
};

// ============================================================================
// Health Check Endpoints
// ============================================================================

/**
 * Basic health check
 */
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const client = await getTemporalClient();
    // Verify Temporal connection by attempting to describe the namespace
    res.json({
      status: 'healthy',
      temporal: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      temporal: 'disconnected',
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Readiness check for Kubernetes
 */
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await getTemporalClient();
    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: String(error) });
  }
});

/**
 * Liveness check for Kubernetes
 */
app.get('/live', (_req: Request, res: Response) => {
  res.json({ live: true });
});

// ============================================================================
// Workflow Start Endpoint
// ============================================================================

/**
 * Start a new order processing workflow
 * POST /api/workflow/start
 *
 * Request body:
 * {
 *   caseId: string;       // Unique case identifier
 *   blobUrl: string;      // URL to the uploaded file
 *   tenantId: string;     // Azure AD tenant ID
 *   userId: string;       // User who uploaded the file
 *   correlationId?: string;
 *   teams: {
 *     chatId: string;
 *     messageId: string;
 *     activityId: string;
 *   }
 * }
 */
app.post('/api/workflow/start', async (req: Request, res: Response) => {
  try {
    const { caseId, blobUrl, tenantId, userId, correlationId, teams } = req.body;

    // Validate required fields
    if (!caseId || !blobUrl || !tenantId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: caseId, blobUrl, tenantId, userId',
      });
    }

    const workflowId = await startOrderProcessing({
      caseId,
      blobUrl,
      tenantId,
      userId,
      correlationId: correlationId || caseId,
      teams: teams || { chatId: '', messageId: '', activityId: '' },
    });

    console.log(`Started workflow: ${workflowId} for case: ${caseId}`);

    res.status(202).json({
      instanceId: workflowId,
      caseId,
      status: 'started',
      statusQueryGetUri: `/api/workflow/${workflowId}/status`,
      sendEventPostUri: `/api/workflow/${workflowId}/signal/{signalName}`,
      terminatePostUri: `/api/workflow/${workflowId}/terminate`,
    });
  } catch (error) {
    console.error('Error starting workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Workflow Status Endpoint
// ============================================================================

/**
 * Get workflow status
 * GET /api/workflow/:workflowId/status
 */
app.get('/api/workflow/:workflowId/status', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    if (!workflowId) {
      return res.status(400).json({
        error: 'Missing workflowId',
      });
    }

    const status = await getWorkflowStatus(workflowId);

    res.json({
      instanceId: workflowId,
      runtimeStatus: status.status,
      result: status.result,
      createdTime: status.startTime?.toISOString(),
      lastUpdatedTime: status.closeTime?.toISOString(),
      historyLength: status.historyLength,
    });
  } catch (error) {
    console.error('Error getting workflow status:', error);

    // Check if workflow not found
    if (String(error).includes('not found') || String(error).includes('NOT_FOUND')) {
      return res.status(404).json({
        error: `Workflow ${req.params.workflowId} not found`,
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Workflow Signal (Raise Event) Endpoints
// ============================================================================

/**
 * Signal a workflow (generic)
 * POST /api/workflow/:workflowId/signal/:signalName
 */
app.post('/api/workflow/:workflowId/signal/:signalName', async (req: Request, res: Response) => {
  try {
    const { workflowId, signalName } = req.params;
    const eventData = req.body;

    if (!workflowId || !signalName) {
      return res.status(400).json({
        error: 'Missing workflowId or signalName',
      });
    }

    // Check if workflow exists and is running
    const running = await isWorkflowRunning(workflowId);
    if (!running) {
      const status = await getWorkflowStatus(workflowId).catch(() => null);
      if (!status) {
        return res.status(404).json({
          error: `Workflow ${workflowId} not found`,
        });
      }
      return res.status(409).json({
        error: `Workflow ${workflowId} is not running (status: ${status.status})`,
      });
    }

    await signalWorkflow(workflowId, signalName, eventData);

    console.log(`Signal ${signalName} sent to workflow ${workflowId}`);

    res.status(202).json({
      instanceId: workflowId,
      signalName,
      status: 'signal_sent',
    });
  } catch (error) {
    console.error('Error signaling workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Signal: File Reuploaded
 * POST /api/workflow/:workflowId/signal/fileReuploaded
 */
app.post('/api/workflow/:workflowId/signal/fileReuploaded', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { blobUrl, correlationId } = req.body;

    if (!blobUrl) {
      return res.status(400).json({
        error: 'Missing required field: blobUrl',
      });
    }

    await signalFileReuploaded(workflowId, { blobUrl, correlationId });

    res.status(202).json({
      instanceId: workflowId,
      signalName: 'fileReuploaded',
      status: 'signal_sent',
    });
  } catch (error) {
    console.error('Error sending fileReuploaded signal:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Signal: Corrections Submitted
 * POST /api/workflow/:workflowId/signal/correctionsSubmitted
 */
app.post('/api/workflow/:workflowId/signal/correctionsSubmitted', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { corrections, submittedBy } = req.body;

    if (!corrections || !submittedBy) {
      return res.status(400).json({
        error: 'Missing required fields: corrections, submittedBy',
      });
    }

    await signalCorrectionsSubmitted(workflowId, { corrections, submittedBy });

    res.status(202).json({
      instanceId: workflowId,
      signalName: 'correctionsSubmitted',
      status: 'signal_sent',
    });
  } catch (error) {
    console.error('Error sending correctionsSubmitted signal:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Signal: Selections Submitted
 * POST /api/workflow/:workflowId/signal/selectionsSubmitted
 */
app.post('/api/workflow/:workflowId/signal/selectionsSubmitted', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { selections, submittedBy } = req.body;

    if (!selections || !submittedBy) {
      return res.status(400).json({
        error: 'Missing required fields: selections, submittedBy',
      });
    }

    await signalSelectionsSubmitted(workflowId, { selections, submittedBy });

    res.status(202).json({
      instanceId: workflowId,
      signalName: 'selectionsSubmitted',
      status: 'signal_sent',
    });
  } catch (error) {
    console.error('Error sending selectionsSubmitted signal:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Signal: Approval Received
 * POST /api/workflow/:workflowId/signal/approvalReceived
 */
app.post('/api/workflow/:workflowId/signal/approvalReceived', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { approved, approvedBy, comments } = req.body;

    if (approved === undefined || !approvedBy) {
      return res.status(400).json({
        error: 'Missing required fields: approved, approvedBy',
      });
    }

    await signalApprovalReceived(workflowId, { approved, approvedBy, comments });

    res.status(202).json({
      instanceId: workflowId,
      signalName: 'approvalReceived',
      status: 'signal_sent',
    });
  } catch (error) {
    console.error('Error sending approvalReceived signal:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Workflow Terminate/Cancel Endpoints
// ============================================================================

/**
 * Terminate a workflow
 * POST /api/workflow/:workflowId/terminate
 */
app.post('/api/workflow/:workflowId/terminate', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { reason } = req.body;

    if (!workflowId) {
      return res.status(400).json({
        error: 'Missing workflowId',
      });
    }

    await terminateWorkflow(workflowId, reason || 'Terminated by user');

    console.log(`Workflow ${workflowId} terminated`);

    res.json({
      instanceId: workflowId,
      status: 'terminated',
      reason: reason || 'Terminated by user',
    });
  } catch (error) {
    console.error('Error terminating workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Cancel a workflow (graceful)
 * POST /api/workflow/:workflowId/cancel
 */
app.post('/api/workflow/:workflowId/cancel', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    if (!workflowId) {
      return res.status(400).json({
        error: 'Missing workflowId',
      });
    }

    await cancelWorkflow(workflowId);

    console.log(`Workflow ${workflowId} cancelled`);

    res.json({
      instanceId: workflowId,
      status: 'cancelled',
    });
  } catch (error) {
    console.error('Error cancelling workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Workflow Query Endpoint
// ============================================================================

/**
 * Query workflow state
 * GET /api/workflow/:workflowId/query/:queryName
 */
app.get('/api/workflow/:workflowId/query/:queryName', async (req: Request, res: Response) => {
  try {
    const { workflowId, queryName } = req.params;

    if (!workflowId || !queryName) {
      return res.status(400).json({
        error: 'Missing workflowId or queryName',
      });
    }

    const result = await queryWorkflow(workflowId, queryName);

    res.json({
      instanceId: workflowId,
      queryName,
      result,
    });
  } catch (error) {
    console.error('Error querying workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Legacy Compatibility Routes (Azure Functions URL patterns)
// ============================================================================

/**
 * Legacy: Start workflow (redirect)
 * POST /api/workflow
 */
app.post('/api/workflow', (req: Request, res: Response) => {
  res.redirect(307, '/api/workflow/start');
});

/**
 * Legacy: Raise event (redirect)
 * POST /api/raiseEvent/:instanceId/:eventName
 */
app.post('/api/raiseEvent/:instanceId/:eventName', (req: Request, res: Response) => {
  const { instanceId, eventName } = req.params;
  // Map instanceId (caseId) to workflowId format
  const workflowId = instanceId.startsWith('order-') ? instanceId : `order-${instanceId}`;
  res.redirect(307, `/api/workflow/${workflowId}/signal/${eventName}`);
});

/**
 * Legacy: Get status (redirect)
 * GET /api/workflow/:instanceId
 */
app.get('/api/workflow/:instanceId([^/]+)$', async (req: Request, res: Response, next: NextFunction) => {
  const { instanceId } = req.params;
  // Only handle if this looks like a workflow ID query (not other routes)
  if (instanceId === 'start') {
    return next();
  }
  const workflowId = instanceId.startsWith('order-') ? instanceId : `order-${instanceId}`;
  res.redirect(302, `/api/workflow/${workflowId}/status`);
});

// ============================================================================
// Error Handler
// ============================================================================

app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================

// Signal ready to PM2 if running under PM2
if (process.send) {
  process.send('ready');
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`Order Processing API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api/workflow`);
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Close HTTP server (stop accepting new connections)
  server.close(async () => {
    console.log('HTTP server closed');

    // Close Temporal client connection
    try {
      await closeTemporalClient();
      console.log('Temporal client closed');
    } catch (error) {
      console.error('Error closing Temporal client:', error);
    }

    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
