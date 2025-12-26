/**
 * Agent Tracer
 *
 * Provides distributed tracing for agent operations with:
 * - Correlation ID propagation
 * - Span creation for tool calls
 * - Event mirroring to application logs
 */

import {
  AgentSpan,
  SpanEvent,
  AgentEvent,
  AgentEventType,
} from '../types.js';
import {
  getContext,
  runWithContext,
  generateSpanId,
  type CorrelationContext,
  Logger,
} from '@order-processing/shared';

/**
 * Active span that can be modified and ended
 */
export interface ActiveSpan {
  /** Span ID */
  spanId: string;
  /** Add an event to the span */
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  /** Set span error */
  setError(error: Error): void;
  /** End the span */
  end(): void;
}

/**
 * Tracer configuration
 */
export interface AgentTracerConfig {
  /** Service name for tracing */
  serviceName: string;
  /** Enable Application Insights export */
  enableAppInsights: boolean;
  /** Application Insights connection string */
  appInsightsConnectionString?: string;
  /** Enable console logging of spans */
  enableConsoleLog: boolean;
  /** Sample rate (0-1) */
  sampleRate: number;
}

/**
 * Default tracer configuration
 */
const DEFAULT_CONFIG: AgentTracerConfig = {
  serviceName: 'order-processing-agent',
  enableAppInsights: false,
  enableConsoleLog: true,
  sampleRate: 1.0,
};

/**
 * Agent Tracer class
 */
export class AgentTracer {
  private readonly config: AgentTracerConfig;
  private readonly logger: Logger;
  private readonly activeSpans: Map<string, AgentSpan>;
  private eventSequence: number = 0;

  constructor(logger: Logger, config?: Partial<AgentTracerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger.child({ component: 'AgentTracer' });
    this.activeSpans = new Map();
  }

  /**
   * Start a new span
   */
  startSpan(
    operationName: string,
    attributes?: Record<string, unknown>
  ): ActiveSpan {
    const context = getContext();
    const spanId = generateSpanId();
    const traceId = context?.traceId || spanId;
    const parentSpanId = context?.spanId;

    const span: AgentSpan = {
      spanId,
      parentSpanId,
      traceId,
      operationName,
      startTime: new Date().toISOString(),
      status: 'running',
      attributes: {
        'service.name': this.config.serviceName,
        ...attributes,
      },
      events: [],
    };

    this.activeSpans.set(spanId, span);

    // Log span start
    if (this.config.enableConsoleLog) {
      this.logger.debug('Span started', {
        spanId,
        traceId,
        operationName,
        parentSpanId,
      });
    }

    // Return active span interface
    return {
      spanId,
      addEvent: (name: string, eventAttrs?: Record<string, unknown>) => {
        this.addSpanEvent(spanId, name, eventAttrs);
      },
      setError: (error: Error) => {
        this.setSpanError(spanId, error);
      },
      end: () => {
        this.endSpan(spanId);
      },
    };
  }

  /**
   * Start a child span within a context
   */
  startChildSpan(
    operationName: string,
    parentContext: { traceId: string; spanId: string },
    attributes?: Record<string, unknown>
  ): ActiveSpan {
    return runWithContext(
      {
        traceId: parentContext.traceId,
        spanId: parentContext.spanId,
      },
      () => this.startSpan(operationName, attributes)
    );
  }

  /**
   * Add an event to a span
   */
  private addSpanEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, unknown>
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn('Span not found for event', { spanId, eventName: name });
      return;
    }

    const event: SpanEvent = {
      name,
      timestamp: new Date().toISOString(),
      attributes,
    };

    span.events.push(event);

    // Mirror to logs
    if (this.config.enableConsoleLog) {
      this.logger.debug('Span event', {
        spanId,
        traceId: span.traceId,
        eventName: name,
        ...attributes,
      });
    }
  }

  /**
   * Set span error
   */
  private setSpanError(spanId: string, error: Error): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return;
    }

    span.status = 'error';
    span.attributes['error'] = true;
    span.attributes['error.message'] = error.message;
    span.attributes['error.name'] = error.name;

    this.addSpanEvent(spanId, 'exception', {
      'exception.message': error.message,
      'exception.type': error.name,
      'exception.stacktrace': error.stack,
    });
  }

  /**
   * End a span
   */
  private endSpan(spanId: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = new Date().toISOString();
    span.durationMs = new Date(span.endTime).getTime() - new Date(span.startTime).getTime();

    if (span.status === 'running') {
      span.status = 'success';
    }

    // Log span completion
    if (this.config.enableConsoleLog) {
      this.logger.info('Span completed', {
        spanId,
        traceId: span.traceId,
        operationName: span.operationName,
        durationMs: span.durationMs,
        status: span.status,
      });
    }

    // Export to Application Insights if enabled
    if (this.config.enableAppInsights) {
      this.exportToAppInsights(span);
    }

    // Clean up
    this.activeSpans.delete(spanId);
  }

  /**
   * Record an agent event
   */
  recordEvent(
    eventType: AgentEventType,
    caseId: string,
    data: Record<string, unknown>
  ): void {
    const context = getContext();

    const event: AgentEvent = {
      id: `evt_${Date.now()}_${++this.eventSequence}`,
      caseId,
      eventType,
      timestamp: new Date().toISOString(),
      data,
      correlationId: context?.traceId || 'unknown',
      spanId: context?.spanId,
    };

    // Log the event
    this.logger.info('Agent event', {
      eventType,
      caseId,
      eventId: event.id,
      ...data,
    });

    // In a full implementation, we'd also persist this to Cosmos
    // for audit purposes
  }

  /**
   * Create a traced function wrapper
   */
  trace<T extends (...args: any[]) => Promise<any>>(
    operationName: string,
    fn: T
  ): T {
    const tracer = this;

    return (async function (...args: Parameters<T>): Promise<ReturnType<T>> {
      const span = tracer.startSpan(operationName);
      try {
        const result = await fn(...args);
        span.end();
        return result;
      } catch (error) {
        span.setError(error as Error);
        span.end();
        throw error;
      }
    }) as T;
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): { traceId: string; spanId: string } | undefined {
    const context = getContext();
    if (!context) {
      return undefined;
    }
    return {
      traceId: context.traceId,
      spanId: context.spanId,
    };
  }

  /**
   * Export span to Application Insights
   */
  private exportToAppInsights(span: AgentSpan): void {
    // TODO: Implement Application Insights telemetry export
    // This would use @azure/monitor-opentelemetry-exporter
    // or the Application Insights SDK directly

    // For now, just log that we would export
    this.logger.debug('Would export to Application Insights', {
      spanId: span.spanId,
      operationName: span.operationName,
    });
  }

  /**
   * Flush any pending telemetry
   */
  async flush(): Promise<void> {
    // End any active spans
    for (const [spanId] of this.activeSpans) {
      this.endSpan(spanId);
    }

    // In a full implementation, flush to Application Insights
    this.logger.info('Tracer flushed');
  }
}

/**
 * Create a tracer instance
 */
export function createAgentTracer(
  logger: Logger,
  config?: Partial<AgentTracerConfig>
): AgentTracer {
  return new AgentTracer(logger, config);
}
