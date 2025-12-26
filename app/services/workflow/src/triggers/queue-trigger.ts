/**
 * Queue Trigger - External Events
 *
 * Listens for external events from the Teams bot and raises them to running orchestrations.
 * Events: FileReuploaded, CorrectionsSubmitted, SelectionsSubmitted, ApprovalReceived
 */

import { app, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { DurableOrchestrationClient } from '../utils/durable-client';

interface ExternalEventMessage {
  caseId: string;
  eventType: 'FileReuploaded' | 'CorrectionsSubmitted' | 'SelectionsSubmitted' | 'ApprovalReceived';
  eventData: unknown;
}

export async function handleExternalEvent(
  queueItem: unknown,
  context: InvocationContext
): Promise<void> {
  try {
    const message = queueItem as ExternalEventMessage;

    context.log(`Handling external event: ${message.eventType} for case ${message.caseId}`);

    const client = df.getClient(context);

    // Use caseId as instance ID
    const instanceId = message.caseId;

    // Check if orchestration is running
    const status = await DurableOrchestrationClient.getStatus(client, instanceId);

    if (!status) {
      context.warn(`No orchestration found for case ${message.caseId}`);
      return;
    }

    if (status.runtimeStatus !== df.OrchestrationRuntimeStatus.Running) {
      context.warn(
        `Orchestration ${instanceId} is not running (status: ${status.runtimeStatus})`
      );
      return;
    }

    // Raise event to orchestration
    await DurableOrchestrationClient.raiseEvent(
      client,
      instanceId,
      message.eventType,
      message.eventData
    );

    context.log(`Event ${message.eventType} raised to orchestration ${instanceId}`);
  } catch (error) {
    context.error('Error handling external event:', error);
    throw error;
  }
}

app.storageQueue('ExternalEventQueue', {
  queueName: 'workflow-events',
  connection: 'AzureWebJobsStorage',
  handler: handleExternalEvent,
});
