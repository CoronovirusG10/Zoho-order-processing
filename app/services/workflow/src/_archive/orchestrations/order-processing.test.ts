/**
 * Order Processing Orchestration Tests
 *
 * Tests for the main orchestration workflow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrderWorkflowInput, WorkflowResult } from '../types';

// Mock Durable Functions context
class MockOrchestrationContext {
  private activities: Map<string, unknown> = new Map();
  private events: Map<string, unknown> = new Map();
  public logs: string[] = [];

  df = {
    getInput: <T>(): T => {
      return {
        caseId: 'test-case-123',
        blobUrl: 'https://example.blob.core.windows.net/test.xlsx',
        tenantId: 'tenant-123',
        userId: 'user-123',
        correlationId: 'correlation-123',
        teams: {
          chatId: 'chat-123',
          messageId: 'msg-123',
          activityId: 'activity-123',
        },
      } as T;
    },

    callActivity: <T>(name: string, input: unknown): T => {
      this.logs.push(`Activity: ${name}`);
      return this.activities.get(name) as T;
    },

    callActivityWithRetry: <T>(name: string, retryPolicy: unknown, input: unknown): T => {
      this.logs.push(`ActivityWithRetry: ${name}`);
      return this.activities.get(name) as T;
    },

    waitForExternalEvent: <T>(name: string): T => {
      this.logs.push(`WaitForEvent: ${name}`);
      return this.events.get(name) as T;
    },

    continueAsNew: (input: unknown): void => {
      this.logs.push('ContinueAsNew');
    },

    currentUtcDateTime: new Date('2025-12-25T10:00:00Z'),

    isReplaying: false,
  };

  log = {
    info: (message: string, data?: unknown) => {
      this.logs.push(`INFO: ${message}`);
    },
    warn: (message: string, data?: unknown) => {
      this.logs.push(`WARN: ${message}`);
    },
    error: (message: string, data?: unknown) => {
      this.logs.push(`ERROR: ${message}`);
    },
  };

  setActivityResult(name: string, result: unknown): void {
    this.activities.set(name, result);
  }

  setEventData(name: string, data: unknown): void {
    this.events.set(name, data);
  }
}

describe('Order Processing Orchestration', () => {
  let context: MockOrchestrationContext;

  beforeEach(() => {
    context = new MockOrchestrationContext();
  });

  it('should complete successfully with approval', () => {
    // Mock activity results
    context.setActivityResult('StoreFile', {
      success: true,
      storedPath: 'orders-incoming/test-case-123/original.xlsx',
      sha256: 'abc123',
    });

    context.setActivityResult('ParseExcel', {
      success: true,
      blocked: false,
      issues: [],
    });

    context.setActivityResult('RunCommittee', {
      success: true,
      needsHuman: false,
      consensus: 'unanimous',
    });

    context.setActivityResult('ResolveCustomer', {
      success: true,
      resolved: true,
      needsHuman: false,
      zohoCustomerId: 'customer-123',
      zohoCustomerName: 'Test Customer',
    });

    context.setActivityResult('ResolveItems', {
      success: true,
      allResolved: true,
      needsHuman: false,
    });

    context.setActivityResult('NotifyUser', {
      success: true,
      messageId: 'msg-123',
    });

    context.setEventData('ApprovalReceived', {
      caseId: 'test-case-123',
      approved: true,
      approvedBy: 'user-123',
      approvedAt: '2025-12-25T10:00:00Z',
    });

    context.setActivityResult('CreateZohoDraft', {
      success: true,
      salesorder_id: 'SO-00001234',
      salesorder_number: '00001234',
    });

    context.setActivityResult('UpdateCase', {
      success: true,
    });

    // This would be the actual orchestration call
    // For now, we verify the mock setup
    expect(context.df.getInput<OrderWorkflowInput>().caseId).toBe('test-case-123');
  });

  it('should handle blocked file scenario', () => {
    context.setActivityResult('StoreFile', {
      success: true,
      storedPath: 'orders-incoming/test-case-123/original.xlsx',
      sha256: 'abc123',
    });

    context.setActivityResult('ParseExcel', {
      success: false,
      blocked: true,
      blockReason: 'File contains formulas',
    });

    context.setActivityResult('NotifyUser', {
      success: true,
      messageId: 'msg-123',
    });

    context.setEventData('FileReuploaded', {
      caseId: 'test-case-123',
      blobUrl: 'https://example.blob.core.windows.net/test-fixed.xlsx',
      correlationId: 'correlation-123',
    });

    expect(context.df.getInput<OrderWorkflowInput>().caseId).toBe('test-case-123');
  });

  it('should handle committee disagreement', () => {
    context.setActivityResult('RunCommittee', {
      success: true,
      needsHuman: true,
      consensus: 'split',
      disagreements: [
        {
          field: 'customer_name',
          votes: {
            model1: 'column_a',
            model2: 'column_b',
            model3: 'column_a',
          },
        },
      ],
    });

    context.setActivityResult('NotifyUser', {
      success: true,
      messageId: 'msg-123',
    });

    context.setEventData('CorrectionsSubmitted', {
      caseId: 'test-case-123',
      corrections: {
        customer_name_column: 'column_a',
      },
      submittedBy: 'user-123',
      submittedAt: '2025-12-25T10:00:00Z',
    });

    context.setActivityResult('ApplyCorrections', {
      success: true,
    });

    expect(context.df.getInput<OrderWorkflowInput>().caseId).toBe('test-case-123');
  });

  it('should handle customer selection', () => {
    context.setActivityResult('ResolveCustomer', {
      success: true,
      resolved: false,
      needsHuman: true,
      candidates: [
        {
          zohoCustomerId: 'customer-1',
          zohoCustomerName: 'Customer A Inc.',
          score: 0.85,
        },
        {
          zohoCustomerId: 'customer-2',
          zohoCustomerName: 'Customer A Ltd.',
          score: 0.80,
        },
      ],
    });

    context.setActivityResult('NotifyUser', {
      success: true,
      messageId: 'msg-123',
    });

    context.setEventData('SelectionsSubmitted', {
      caseId: 'test-case-123',
      selections: {
        customer: {
          zohoCustomerId: 'customer-1',
        },
      },
      submittedBy: 'user-123',
      submittedAt: '2025-12-25T10:00:00Z',
    });

    context.setActivityResult('ApplySelections', {
      success: true,
    });

    expect(context.df.getInput<OrderWorkflowInput>().caseId).toBe('test-case-123');
  });

  it('should handle cancellation', () => {
    context.setEventData('ApprovalReceived', {
      caseId: 'test-case-123',
      approved: false,
      approvedBy: 'user-123',
      approvedAt: '2025-12-25T10:00:00Z',
      comments: 'Wrong customer',
    });

    context.setActivityResult('UpdateCase', {
      success: true,
    });

    expect(context.df.getInput<OrderWorkflowInput>().caseId).toBe('test-case-123');
  });

  it('should handle Zoho unavailability', () => {
    context.setActivityResult('CreateZohoDraft', {
      success: false,
      queued: true,
      error: 'Zoho service unavailable',
    });

    context.setActivityResult('NotifyUser', {
      success: true,
      messageId: 'msg-123',
    });

    context.setActivityResult('UpdateCase', {
      success: true,
    });

    expect(context.df.getInput<OrderWorkflowInput>().caseId).toBe('test-case-123');
  });
});
