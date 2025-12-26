/**
 * HTTP Trigger - Raise Event
 *
 * HTTP endpoint for raising external events to running orchestrations.
 * Alternative to queue-based event raising.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { DurableOrchestrationClient } from '../utils/durable-client';

export async function raiseEvent(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const instanceId = request.params.instanceId;
    const eventName = request.params.eventName;

    if (!instanceId || !eventName) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing instanceId or eventName',
        },
      };
    }

    const eventData = await request.json();

    const client = df.getClient(context);

    // Check if orchestration exists
    const status = await DurableOrchestrationClient.getStatus(client, instanceId);

    if (!status) {
      return {
        status: 404,
        jsonBody: {
          error: `Orchestration ${instanceId} not found`,
        },
      };
    }

    if (status.runtimeStatus !== df.OrchestrationRuntimeStatus.Running) {
      return {
        status: 409,
        jsonBody: {
          error: `Orchestration ${instanceId} is not running (status: ${status.runtimeStatus})`,
        },
      };
    }

    // Raise event
    await DurableOrchestrationClient.raiseEvent(client, instanceId, eventName, eventData);

    context.log(`Event ${eventName} raised to orchestration ${instanceId}`);

    return {
      status: 202,
      jsonBody: {
        instanceId,
        eventName,
        status: 'event_raised',
      },
    };
  } catch (error) {
    context.error('Error raising event:', error);
    return {
      status: 500,
      jsonBody: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('RaiseEvent', {
  methods: ['POST'],
  route: 'workflow/{instanceId}/raiseEvent/{eventName}',
  authLevel: 'function',
  handler: raiseEvent,
});
