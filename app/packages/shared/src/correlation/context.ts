/**
 * Correlation context management using AsyncLocalStorage
 * Generates and propagates trace_id and span_id across async operations
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';

/**
 * Correlation context containing trace and span information
 */
export interface CorrelationContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  caseId?: string;
  tenantId?: string;
  userId?: string;
  teamsActivityId?: string;
  [key: string]: unknown;
}

/**
 * AsyncLocalStorage for correlation context
 */
const contextStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Generate a random hex ID
 */
function generateId(bytes: number = 8): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a trace ID (16 bytes = 32 hex chars)
 */
export function generateTraceId(): string {
  return generateId(16);
}

/**
 * Generate a span ID (8 bytes = 16 hex chars)
 */
export function generateSpanId(): string {
  return generateId(8);
}

/**
 * Get the current correlation context
 */
export function getContext(): CorrelationContext | undefined {
  return contextStorage.getStore();
}

/**
 * Get a value from the current context
 */
export function getContextValue<T>(key: keyof CorrelationContext): T | undefined {
  const context = getContext();
  return context?.[key] as T | undefined;
}

/**
 * Run a function with a new correlation context
 */
export function runWithContext<T>(
  context: Partial<CorrelationContext>,
  fn: () => T
): T {
  const currentContext = getContext();

  const newContext: CorrelationContext = {
    traceId: context.traceId || currentContext?.traceId || generateTraceId(),
    spanId: context.spanId || generateSpanId(),
    parentSpanId: currentContext?.spanId,
    ...currentContext,
    ...context,
  };

  return contextStorage.run(newContext, fn);
}

/**
 * Run a function with a new correlation context (async)
 */
export async function runWithContextAsync<T>(
  context: Partial<CorrelationContext>,
  fn: () => Promise<T>
): Promise<T> {
  const currentContext = getContext();

  const newContext: CorrelationContext = {
    traceId: context.traceId || currentContext?.traceId || generateTraceId(),
    spanId: context.spanId || generateSpanId(),
    parentSpanId: currentContext?.spanId,
    ...currentContext,
    ...context,
  };

  return contextStorage.run(newContext, fn);
}

/**
 * Update the current context with additional values
 */
export function updateContext(updates: Partial<CorrelationContext>): void {
  const current = getContext();
  if (!current) {
    throw new Error('No correlation context active');
  }
  Object.assign(current, updates);
}

/**
 * Extract correlation context from Teams activity
 */
export function extractFromTeamsActivity(activity: {
  id?: string;
  channelData?: {
    tenant?: {
      id?: string;
    };
  };
  from?: {
    aadObjectId?: string;
  };
}): Partial<CorrelationContext> {
  return {
    teamsActivityId: activity.id,
    tenantId: activity.channelData?.tenant?.id,
    userId: activity.from?.aadObjectId,
  };
}

/**
 * Create a child span context
 */
export function createChildSpan(_name?: string): CorrelationContext {
  const current = getContext();
  if (!current) {
    return {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
    };
  }

  return {
    ...current,
    spanId: generateSpanId(),
    parentSpanId: current.spanId,
  };
}
