/**
 * Temporal Client Utility
 *
 * Provides a singleton Temporal client and helper functions
 * for starting and managing order processing workflows.
 */

import { Client, Connection, WorkflowExecutionDescription } from '@temporalio/client';
import { orderProcessingWorkflow, OrderProcessingInput } from './workflows';

// Singleton client instance
let client: Client | null = null;
let connection: Connection | null = null;

/**
 * Get or create the Temporal client singleton
 */
export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    });

    console.log('Temporal client connected to', process.env.TEMPORAL_ADDRESS || 'localhost:7233');
  }

  return client;
}

/**
 * Close the Temporal client connection
 */
export async function closeTemporalClient(): Promise<void> {
  if (connection) {
    await connection.close();
    connection = null;
    client = null;
    console.log('Temporal client connection closed');
  }
}

/**
 * Start a new order processing workflow
 *
 * @param input - The workflow input parameters
 * @returns The workflow ID that can be used to track/signal the workflow
 */
export async function startOrderProcessing(input: OrderProcessingInput): Promise<string> {
  const temporalClient = await getTemporalClient();

  const workflowId = `order-${input.caseId}`;

  const handle = await temporalClient.workflow.start(orderProcessingWorkflow, {
    taskQueue: 'order-processing',
    workflowId,
    args: [input],
    // Workflow execution timeout (max time for entire workflow)
    workflowExecutionTimeout: '24h',
    // Run timeout (max time for a single run, excluding retries)
    workflowRunTimeout: '12h',
    // Task timeout (max time for a single workflow task)
    workflowTaskTimeout: '60s',
  });

  console.log(`Started order processing workflow: ${handle.workflowId}`);

  return handle.workflowId;
}

/**
 * Signal a running workflow
 *
 * @param workflowId - The workflow ID to signal
 * @param signalName - The name of the signal
 * @param payload - The signal payload
 */
export async function signalWorkflow(
  workflowId: string,
  signalName: string,
  payload: unknown
): Promise<void> {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.workflow.getHandle(workflowId);

  await handle.signal(signalName, payload);
  console.log(`Sent signal '${signalName}' to workflow ${workflowId}`);
}

/**
 * Signal for file reuploaded event
 */
export async function signalFileReuploaded(
  workflowId: string,
  payload: { blobUrl: string; correlationId: string }
): Promise<void> {
  await signalWorkflow(workflowId, 'fileReuploaded', payload);
}

/**
 * Signal for corrections submitted event
 */
export async function signalCorrectionsSubmitted(
  workflowId: string,
  payload: { corrections: unknown; submittedBy: string }
): Promise<void> {
  await signalWorkflow(workflowId, 'correctionsSubmitted', {
    ...payload,
    submittedAt: new Date().toISOString(),
  });
}

/**
 * Signal for selections submitted event
 */
export async function signalSelectionsSubmitted(
  workflowId: string,
  payload: {
    selections: {
      customer?: { zohoCustomerId: string };
      items?: Record<number, { zohoItemId: string }>;
    };
    submittedBy: string;
  }
): Promise<void> {
  await signalWorkflow(workflowId, 'selectionsSubmitted', {
    ...payload,
    submittedAt: new Date().toISOString(),
  });
}

/**
 * Signal for approval received event
 */
export async function signalApprovalReceived(
  workflowId: string,
  payload: { approved: boolean; approvedBy: string; comments?: string }
): Promise<void> {
  await signalWorkflow(workflowId, 'approvalReceived', {
    ...payload,
    approvedAt: new Date().toISOString(),
  });
}

/**
 * Get the status of a workflow
 *
 * @param workflowId - The workflow ID to check
 * @returns The workflow status and result if completed
 */
export async function getWorkflowStatus(workflowId: string): Promise<{
  status: string;
  result?: unknown;
  startTime?: Date;
  closeTime?: Date;
  historyLength?: number;
}> {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.workflow.getHandle(workflowId);

  const description: WorkflowExecutionDescription = await handle.describe();

  const response: {
    status: string;
    result?: unknown;
    startTime?: Date;
    closeTime?: Date;
    historyLength?: number;
  } = {
    status: description.status.name,
    startTime: description.startTime,
    closeTime: description.closeTime ?? undefined,
    historyLength: description.historyLength,
  };

  // If workflow is completed, get the result
  if (description.status.name === 'COMPLETED') {
    try {
      response.result = await handle.result();
    } catch {
      // Result might not be available
    }
  }

  return response;
}

/**
 * Query a workflow for its current state
 *
 * @param workflowId - The workflow ID to query
 * @param queryName - The name of the query
 * @param args - Optional query arguments
 */
export async function queryWorkflow<T>(
  workflowId: string,
  queryName: string,
  ...args: unknown[]
): Promise<T> {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.workflow.getHandle(workflowId);

  return handle.query<T>(queryName, ...args);
}

/**
 * Cancel a running workflow
 *
 * @param workflowId - The workflow ID to cancel
 */
export async function cancelWorkflow(workflowId: string): Promise<void> {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.workflow.getHandle(workflowId);

  await handle.cancel();
  console.log(`Cancelled workflow ${workflowId}`);
}

/**
 * Terminate a workflow immediately
 *
 * @param workflowId - The workflow ID to terminate
 * @param reason - The reason for termination
 */
export async function terminateWorkflow(workflowId: string, reason: string): Promise<void> {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.workflow.getHandle(workflowId);

  await handle.terminate(reason);
  console.log(`Terminated workflow ${workflowId}: ${reason}`);
}

/**
 * Check if a workflow exists and is running
 *
 * @param workflowId - The workflow ID to check
 */
export async function isWorkflowRunning(workflowId: string): Promise<boolean> {
  try {
    const status = await getWorkflowStatus(workflowId);
    return status.status === 'RUNNING';
  } catch {
    return false;
  }
}
