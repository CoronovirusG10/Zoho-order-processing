/**
 * Event Logger Service
 *
 * Append-only JSONL event logging for audit trail:
 * - All case events: created, parsed, validated, corrected, created_draft
 * - All API calls: request/response pointers
 * - All model outputs: artifact pointers
 *
 * Events are stored in:
 * - logs-archive/{date}/events.jsonl (daily)
 * - logs-archive/{date}/{hour}/events.jsonl (hourly for high volume)
 */

import { BlobLayoutManager } from './blob-layout.js';
import { RedactionService } from './redaction.js';
import {
  AuditEvent,
  AuditEventType,
  BlobContainer,
} from './types.js';
import { ActorType } from '@order-processing/types';

/**
 * Sequence number tracker per case
 */
interface SequenceTracker {
  caseId: string;
  lastSequence: number;
  lastUpdated: Date;
}

/**
 * Event logger configuration
 */
export interface EventLoggerConfig {
  /** Use hourly log files instead of daily */
  useHourlyLogs: boolean;
  /** Buffer events before writing (for batching) */
  bufferSize: number;
  /** Flush interval in milliseconds */
  flushIntervalMs: number;
  /** Redaction policy name to apply */
  redactionPolicy: string;
}

/**
 * Default event logger configuration
 */
const DEFAULT_CONFIG: EventLoggerConfig = {
  useHourlyLogs: false,
  bufferSize: 10,
  flushIntervalMs: 5000,
  redactionPolicy: 'default',
};

/**
 * Event Logger Service
 *
 * Provides append-only JSONL logging for all case events, API calls, and model outputs.
 */
export class EventLoggerService {
  private layoutManager: BlobLayoutManager;
  private redactionService: RedactionService;
  private config: EventLoggerConfig;
  private sequenceTrackers: Map<string, SequenceTracker> = new Map();
  private eventBuffer: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    storageAccountUrl: string,
    config: Partial<EventLoggerConfig> = {}
  ) {
    this.layoutManager = new BlobLayoutManager(storageAccountUrl);
    this.redactionService = new RedactionService();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start flush timer if buffering enabled
    if (this.config.bufferSize > 1) {
      this.startFlushTimer();
    }
  }

  /**
   * Get next sequence number for a case
   */
  private getNextSequence(caseId: string): number {
    let tracker = this.sequenceTrackers.get(caseId);

    if (!tracker) {
      tracker = {
        caseId,
        lastSequence: 0,
        lastUpdated: new Date(),
      };
      this.sequenceTrackers.set(caseId, tracker);
    }

    tracker.lastSequence++;
    tracker.lastUpdated = new Date();

    // Clean up old trackers (older than 24 hours)
    this.cleanupOldTrackers();

    return tracker.lastSequence;
  }

  /**
   * Clean up sequence trackers older than 24 hours
   */
  private cleanupOldTrackers(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const [caseId, tracker] of this.sequenceTrackers.entries()) {
      if (tracker.lastUpdated < cutoff) {
        this.sequenceTrackers.delete(caseId);
      }
    }
  }

  /**
   * Log a case event
   */
  async logCaseEvent(
    eventType: AuditEventType,
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string; parentSpanId?: string },
    actor: { type: ActorType; userId?: string; displayName?: string; ip?: string },
    data?: Record<string, unknown>,
    pointers?: Record<string, string>
  ): Promise<void> {
    const event: AuditEvent = {
      ts: new Date().toISOString(),
      eventType,
      caseId,
      tenantId,
      sequence: this.getNextSequence(caseId),
      correlation,
      actor,
      data: data ? this.redactionService.redact(data, this.config.redactionPolicy) : undefined,
      pointers,
      redactions: {
        containsSecrets: false,
        containsPii: this.redactionService.containsPii(data || {}),
        policy: this.config.redactionPolicy,
      },
    };

    await this.appendEvent(event);
  }

  /**
   * Log case created event
   */
  async logCaseCreated(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    userId: string,
    displayName?: string,
    data?: { filename: string; fileSha256: string }
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.CaseCreated,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.User, userId, displayName },
      data
    );
  }

  /**
   * Log case parsed event
   */
  async logCaseParsed(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    data: { lineItemCount: number; hasIssues: boolean },
    canonicalBlobPath: string
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.CaseParsed,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.System },
      data,
      { canonicalOrder: canonicalBlobPath }
    );
  }

  /**
   * Log case validated event
   */
  async logCaseValidated(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    data: { isValid: boolean; issueCount: number }
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.CaseValidated,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.System },
      data
    );
  }

  /**
   * Log user correction event
   */
  async logUserCorrection(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    userId: string,
    displayName: string | undefined,
    correctionBlobPath: string,
    patchCount: number
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.UserCorrectionSubmitted,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.User, userId, displayName },
      { patchCount },
      { correctionPatch: correctionBlobPath }
    );
  }

  /**
   * Log draft created event
   */
  async logDraftCreated(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    zohoSalesOrderId: string,
    zohoSalesOrderNumber: string
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.CaseDraftCreated,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.System },
      { zohoSalesOrderId, zohoSalesOrderNumber }
    );
  }

  /**
   * Log committee model call
   */
  async logCommitteeModelCall(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    modelId: string,
    promptBlobPath: string,
    outputBlobPath: string,
    durationMs: number
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.CommitteeModelCalled,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.Agent },
      { modelId, durationMs },
      { prompt: promptBlobPath, output: outputBlobPath }
    );
  }

  /**
   * Log Zoho API request
   */
  async logZohoApiRequest(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    endpoint: string,
    method: string,
    requestBlobPath: string
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.ZohoApiRequest,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.System },
      { endpoint, method },
      { request: requestBlobPath }
    );
  }

  /**
   * Log Zoho API response
   */
  async logZohoApiResponse(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    statusCode: number,
    responseBlobPath: string,
    durationMs: number
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.ZohoApiResponse,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.System },
      { statusCode, durationMs },
      { response: responseBlobPath }
    );
  }

  /**
   * Log file blocked event
   */
  async logFileBlocked(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    userId: string,
    reason: string,
    formulaCount?: number
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.FileBlocked,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.User, userId },
      { reason, formulaCount }
    );
  }

  /**
   * Log user approval event
   */
  async logUserApproval(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    userId: string,
    displayName?: string
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.UserApproved,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.User, userId, displayName }
    );
  }

  /**
   * Log case failed event
   */
  async logCaseFailed(
    caseId: string,
    tenantId: string,
    correlation: { traceId: string; spanId: string },
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    await this.logCaseEvent(
      AuditEventType.CaseFailed,
      caseId,
      tenantId,
      correlation,
      { type: ActorType.System },
      { errorCode, errorMessage }
    );
  }

  /**
   * Append event to buffer and flush if needed
   */
  private async appendEvent(event: AuditEvent): Promise<void> {
    this.eventBuffer.push(event);

    if (this.eventBuffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush buffered events to storage
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    // Write events to append blob
    for (const event of events) {
      try {
        await this.layoutManager.appendToEventLog(
          event,
          this.config.useHourlyLogs
        );
      } catch (error) {
        // Re-add failed events to buffer
        this.eventBuffer.push(event);
        throw error;
      }
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        console.error('Failed to flush events:', error);
      }
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop the flush timer and flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Read events from a specific date
   */
  async readEventsForDate(date: Date): Promise<AuditEvent[]> {
    const blobPath = this.config.useHourlyLogs
      ? this.layoutManager.getHourlyEventLogPath(date)
      : this.layoutManager.getEventLogPath(date);

    try {
      const exists = await this.layoutManager.blobExists(blobPath);
      if (!exists) {
        return [];
      }

      // Read and parse JSONL
      const containerClient = await (this.layoutManager as any).getContainerClient(
        BlobContainer.LogsArchive
      );
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath.path);
      const downloadResponse = await blockBlobClient.download(0);

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }

      const content = Buffer.concat(chunks).toString('utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      return lines.map((line) => JSON.parse(line) as AuditEvent);
    } catch {
      return [];
    }
  }

  /**
   * Get events for a specific case from a date range
   */
  async getEventsForCase(
    caseId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditEvent[]> {
    const events: AuditEvent[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayEvents = await this.readEventsForDate(current);
      events.push(...dayEvents.filter((e) => e.caseId === caseId));
      current.setDate(current.getDate() + 1);
    }

    return events.sort((a, b) => a.sequence - b.sequence);
  }
}
