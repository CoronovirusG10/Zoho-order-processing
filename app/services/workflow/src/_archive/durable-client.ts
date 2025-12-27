/**
 * Durable Functions client utilities
 *
 * Updated for durable-functions v3 API patterns.
 * Uses DurableClient type and options-based method signatures.
 */

import * as df from 'durable-functions';
import { v4 as uuidv4 } from 'uuid';

export interface StartOrchestrationOptions {
  input: unknown;
  instanceId?: string;
}

/**
 * Wrapper class for DurableClient operations
 * Provides v3-compatible API with options-based method signatures
 */
export class DurableOrchestrationClient {
  /**
   * Start a new orchestration instance
   * v3 API: Uses options object instead of positional parameters
   */
  static async startNew(
    client: df.DurableClient,
    orchestratorName: string,
    options: StartOrchestrationOptions
  ): Promise<string> {
    const instanceId = options.instanceId || uuidv4();

    // v3 API: startNew(orchestratorName, options)
    await client.startNew(orchestratorName, {
      instanceId,
      input: options.input,
    });

    return instanceId;
  }

  /**
   * Raise an external event to a running orchestration
   */
  static async raiseEvent(
    client: df.DurableClient,
    instanceId: string,
    eventName: string,
    eventData: unknown
  ): Promise<void> {
    await client.raiseEvent(instanceId, eventName, eventData);
  }

  /**
   * Get orchestration status
   * v3 API: Uses options object instead of boolean parameters
   */
  static async getStatus(
    client: df.DurableClient,
    instanceId: string,
    showHistory = false,
    showHistoryOutput = false,
    showInput = true
  ): Promise<df.DurableOrchestrationStatus | undefined> {
    // v3 API: getStatus(instanceId, options?)
    return await client.getStatus(instanceId, {
      showHistory,
      showHistoryOutput,
      showInput,
    });
  }

  /**
   * Terminate a running orchestration
   */
  static async terminate(
    client: df.DurableClient,
    instanceId: string,
    reason: string
  ): Promise<void> {
    await client.terminate(instanceId, reason);
  }

  /**
   * Rewind a failed orchestration
   */
  static async rewind(
    client: df.DurableClient,
    instanceId: string,
    reason: string
  ): Promise<void> {
    await client.rewind(instanceId, reason);
  }

  /**
   * Purge orchestration history
   */
  static async purgeInstanceHistory(
    client: df.DurableClient,
    instanceId: string
  ): Promise<df.PurgeHistoryResult> {
    return await client.purgeInstanceHistory(instanceId);
  }

  /**
   * Query orchestrations by filter criteria
   * v3 API: Uses OrchestrationFilter instead of OrchestrationStatusQueryCondition
   */
  static async getStatusBy(
    client: df.DurableClient,
    createdTimeFrom?: Date,
    createdTimeTo?: Date,
    runtimeStatus?: df.OrchestrationRuntimeStatus[]
  ): Promise<df.DurableOrchestrationStatus[]> {
    // v3 API: Uses plain object filter instead of class-based condition
    const filter: df.OrchestrationFilter = {};

    if (createdTimeFrom) {
      filter.createdTimeFrom = createdTimeFrom;
    }
    if (createdTimeTo) {
      filter.createdTimeTo = createdTimeTo;
    }
    if (runtimeStatus) {
      filter.runtimeStatus = runtimeStatus;
    }

    const result = await client.getStatusBy(filter);
    return result;
  }

  /**
   * Wait for orchestration to complete
   * v3 API: Uses waitForCompletionOrCreateCheckStatusResponse with options
   */
  static async waitForCompletion(
    client: df.DurableClient,
    instanceId: string,
    timeoutInMilliseconds = 30000,
    retryIntervalInMilliseconds = 1000
  ): Promise<df.DurableOrchestrationStatus | undefined> {
    // v3 API: waitForCompletionOrCreateCheckStatusResponse with options object
    // Note: This returns HttpResponse, so we need to poll status instead
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutInMilliseconds) {
      const status = await client.getStatus(instanceId);
      if (
        status &&
        status.runtimeStatus !== df.OrchestrationRuntimeStatus.Running &&
        status.runtimeStatus !== df.OrchestrationRuntimeStatus.Pending
      ) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, retryIntervalInMilliseconds));
    }
    // Return final status even if not complete
    return await client.getStatus(instanceId);
  }
}

/**
 * Retry policy helpers
 */
export class RetryPolicies {
  /**
   * Standard retry policy for activities (3 attempts, exponential backoff)
   */
  static standard(): df.RetryOptions {
    return new df.RetryOptions(5000, 3);
  }

  /**
   * Aggressive retry policy (5 attempts, exponential backoff)
   */
  static aggressive(): df.RetryOptions {
    const options = new df.RetryOptions(5000, 5);
    options.backoffCoefficient = 2;
    options.maxRetryIntervalInMilliseconds = 60000; // 1 minute max
    return options;
  }

  /**
   * Long-running retry policy (10 attempts, slower backoff)
   */
  static longRunning(): df.RetryOptions {
    const options = new df.RetryOptions(10000, 10);
    options.backoffCoefficient = 1.5;
    options.maxRetryIntervalInMilliseconds = 300000; // 5 minutes max
    return options;
  }

  /**
   * Custom retry policy
   */
  static custom(
    firstRetryIntervalInMilliseconds: number,
    maxNumberOfAttempts: number,
    backoffCoefficient = 2,
    maxRetryIntervalInMilliseconds = 60000
  ): df.RetryOptions {
    const options = new df.RetryOptions(
      firstRetryIntervalInMilliseconds,
      maxNumberOfAttempts
    );
    options.backoffCoefficient = backoffCoefficient;
    options.maxRetryIntervalInMilliseconds = maxRetryIntervalInMilliseconds;
    return options;
  }
}

/**
 * Correlation ID helpers
 */
export interface CorrelationContext {
  caseId: string;
  traceId: string;
  spanId?: string;
  teamsActivityId?: string;
}

export function createCorrelationContext(
  caseId: string,
  teamsActivityId?: string
): CorrelationContext {
  return {
    caseId,
    traceId: uuidv4(),
    spanId: uuidv4(),
    teamsActivityId,
  };
}

export function propagateCorrelation(
  context: CorrelationContext,
  newSpanId = true
): CorrelationContext {
  return {
    ...context,
    spanId: newSpanId ? uuidv4() : context.spanId,
  };
}
