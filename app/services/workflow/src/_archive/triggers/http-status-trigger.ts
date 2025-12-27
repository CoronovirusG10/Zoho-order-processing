/**
 * HTTP Trigger - Get Status
 *
 * Retrieves the current status of an orchestration instance.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { DurableOrchestrationClient } from '../utils/durable-client';

export async function getStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const instanceId = request.params.instanceId;

    if (!instanceId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing instanceId',
        },
      };
    }

    const client = df.getClient(context);

    // Get orchestration status
    const status = await DurableOrchestrationClient.getStatus(client, instanceId, false, false, true);

    if (!status) {
      return {
        status: 404,
        jsonBody: {
          error: `Orchestration ${instanceId} not found`,
        },
      };
    }

    return {
      status: 200,
      jsonBody: {
        instanceId: status.instanceId,
        runtimeStatus: status.runtimeStatus,
        input: status.input,
        output: status.output,
        createdTime: status.createdTime,
        lastUpdatedTime: status.lastUpdatedTime,
        customStatus: status.customStatus,
      },
    };
  } catch (error) {
    context.error('Error getting status:', error);
    return {
      status: 500,
      jsonBody: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

export async function terminateWorkflow(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const instanceId = request.params.instanceId;

    if (!instanceId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing instanceId',
        },
      };
    }

    const body = await request.json() as { reason?: string };
    const reason = body.reason || 'Terminated by user';

    const client = df.getClient(context);

    // Terminate orchestration
    await DurableOrchestrationClient.terminate(client, instanceId, reason);

    context.log(`Orchestration ${instanceId} terminated: ${reason}`);

    return {
      status: 200,
      jsonBody: {
        instanceId,
        status: 'terminated',
        reason,
      },
    };
  } catch (error) {
    context.error('Error terminating workflow:', error);
    return {
      status: 500,
      jsonBody: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('GetWorkflowStatus', {
  methods: ['GET'],
  route: 'workflow/{instanceId}/status',
  authLevel: 'function',
  handler: getStatus,
});

app.http('TerminateWorkflow', {
  methods: ['POST'],
  route: 'workflow/{instanceId}/terminate',
  authLevel: 'function',
  handler: terminateWorkflow,
});
