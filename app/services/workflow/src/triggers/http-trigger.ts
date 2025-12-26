/**
 * HTTP Trigger - Start Workflow
 *
 * Starts a new order processing orchestration.
 * Called by the Teams bot when a new file is uploaded.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { DurableOrchestrationClient } from '../utils/durable-client';
import { OrderWorkflowInput } from '../types';

export async function startWorkflow(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body = await request.json() as {
      caseId: string;
      blobUrl: string;
      tenantId: string;
      userId: string;
      correlationId?: string;
      teams: {
        chatId: string;
        messageId: string;
        activityId: string;
      };
    };

    // Validate required fields
    if (!body.caseId || !body.blobUrl || !body.tenantId || !body.userId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required fields: caseId, blobUrl, tenantId, userId',
        },
      };
    }

    const client = df.getClient(context);

    const input: OrderWorkflowInput = {
      caseId: body.caseId,
      blobUrl: body.blobUrl,
      tenantId: body.tenantId,
      userId: body.userId,
      correlationId: body.correlationId || body.caseId,
      teams: body.teams,
    };

    // Start orchestration with caseId as instance ID for idempotency
    const instanceId = await DurableOrchestrationClient.startNew(
      client,
      'OrderProcessingOrchestrator',
      {
        input,
        instanceId: body.caseId,
      }
    );

    context.log(`Started orchestration with ID: ${instanceId}`);

    // Create status query URLs
    const checkStatusResponse = await client.createCheckStatusResponse(request, instanceId);

    // Extract Location header using Headers.get() for v4 API compatibility
    const headers = checkStatusResponse.headers;
    let locationHeader: string | null | undefined;
    if (headers instanceof Headers) {
      locationHeader = headers.get('Location');
    } else if (headers && typeof headers === 'object') {
      locationHeader = (headers as unknown as Record<string, string>)['Location'];
    }

    return {
      status: 202,
      jsonBody: {
        instanceId,
        caseId: body.caseId,
        status: 'started',
        statusQueryGetUri: locationHeader ?? '',
        sendEventPostUri: `${request.url}/${instanceId}/raiseEvent/{eventName}`,
        terminatePostUri: `${request.url}/${instanceId}/terminate`,
      },
    };
  } catch (error) {
    context.error('Error starting workflow:', error);
    return {
      status: 500,
      jsonBody: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('StartWorkflow', {
  methods: ['POST'],
  route: 'workflow/start',
  authLevel: 'function',
  handler: startWorkflow,
});
