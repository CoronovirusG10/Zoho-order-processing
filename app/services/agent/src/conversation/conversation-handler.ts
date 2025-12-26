/**
 * Conversation Handler
 *
 * Manages the conversation flow between the user and the agent.
 * Handles:
 * - Reading parse output (canonical JSON + issues)
 * - Generating user-facing questions
 * - Processing correction patches
 * - Triggering draft creation when ready
 */

import { FoundryAgentClient } from '../client/foundry-agent-client.js';
import { ToolExecutor } from '../tools/tool-executor.js';
import { AgentStateManager } from '../state/agent-state-manager.js';
import { AgentTracer } from '../tracing/agent-tracer.js';
import {
  CaseContext,
  AgentThreadState,
  AgentMessage,
  UserQuestion,
  UserAnswer,
  ConversationTurn,
  ToolCall,
  ToolResult,
  JsonPatchOperation,
} from '../types.js';
import { Logger } from '@order-processing/shared';
import type { CanonicalSalesOrder, Issue } from '@order-processing/types';

/**
 * Conversation handler configuration
 */
export interface ConversationHandlerConfig {
  /** Maximum conversation turns before forcing completion */
  maxTurns: number;
  /** Timeout for user responses (milliseconds) */
  userResponseTimeoutMs: number;
  /** Auto-proceed when no blocking issues */
  autoProceedWhenReady: boolean;
}

/**
 * Conversation result
 */
export interface ConversationResult {
  /** Final status */
  status: 'completed' | 'draft_created' | 'cancelled' | 'timeout' | 'error';
  /** Zoho sales order ID if created */
  salesorderId?: string;
  /** Zoho sales order number if created */
  salesorderNumber?: string;
  /** Error message if failed */
  error?: string;
  /** Number of turns taken */
  turnCount: number;
  /** Questions asked */
  questionsAsked: number;
  /** Patches applied */
  patchesApplied: number;
}

/**
 * Conversation Handler class
 */
export class ConversationHandler {
  private readonly client: FoundryAgentClient;
  private readonly toolExecutor: ToolExecutor;
  private readonly stateManager: AgentStateManager;
  private readonly tracer: AgentTracer;
  private readonly logger: Logger;
  private readonly config: ConversationHandlerConfig;

  constructor(
    client: FoundryAgentClient,
    toolExecutor: ToolExecutor,
    stateManager: AgentStateManager,
    tracer: AgentTracer,
    logger: Logger,
    config?: Partial<ConversationHandlerConfig>
  ) {
    this.client = client;
    this.toolExecutor = toolExecutor;
    this.stateManager = stateManager;
    this.tracer = tracer;
    this.logger = logger.child({ component: 'ConversationHandler' });
    this.config = {
      maxTurns: config?.maxTurns ?? 20,
      userResponseTimeoutMs: config?.userResponseTimeoutMs ?? 3600000, // 1 hour
      autoProceedWhenReady: config?.autoProceedWhenReady ?? false,
    };
  }

  /**
   * Start a new conversation for a case
   */
  async startConversation(
    context: CaseContext
  ): Promise<{ threadId: string; questions: UserQuestion[] }> {
    const span = this.tracer.startSpan('conversation.start', {
      caseId: context.caseId,
      correlationId: context.correlationId,
    });

    try {
      // Create agent thread
      const threadId = await this.client.createThread(context);

      // Create thread state
      const threadState: Omit<AgentThreadState, '_partitionKey'> = {
        threadId,
        caseId: context.caseId,
        tenantId: context.tenantId,
        userId: context.userId,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        pendingIssues: context.issues.map((i) => i.code),
        messageCount: 1,
        correlationId: context.correlationId,
      };

      await this.stateManager.saveThreadState(threadState);

      // Get initial response with questions
      const messages = await this.client.sendMessage(
        threadId,
        'Please review the order and identify any issues that need my attention.',
        context.caseId
      );

      // Extract questions from assistant response
      const questions = this.extractQuestions(messages, context.issues);

      span.addEvent('conversation_started', {
        threadId,
        questionCount: questions.length,
      });

      this.logger.info('Conversation started', {
        threadId,
        caseId: context.caseId,
        questionCount: questions.length,
      });

      return { threadId, questions };
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Process user answers and continue conversation
   */
  async processUserAnswers(
    threadId: string,
    answers: UserAnswer[],
    tenantId: string
  ): Promise<{
    questions: UserQuestion[];
    isComplete: boolean;
    result?: ConversationResult;
  }> {
    const span = this.tracer.startSpan('conversation.processAnswers', {
      threadId,
      answerCount: answers.length,
    });

    try {
      // Get current thread state
      const threadState = await this.stateManager.getThreadState(threadId, tenantId);
      if (!threadState) {
        throw new Error('Thread not found');
      }

      // Format answers as user message
      const userMessage = this.formatAnswersAsMessage(answers);

      // Send to agent
      let messages = await this.client.sendMessage(
        threadId,
        userMessage,
        threadState.caseId
      );

      // Handle any tool calls
      const runStatus = await this.handleToolCalls(
        threadId,
        messages,
        threadState.caseId,
        tenantId
      );

      if (runStatus.runId) {
        // Get updated messages after tool execution
        messages = await this.client.getMessages(threadId);
      }

      // Update thread state
      await this.stateManager.updateThreadState(threadId, tenantId, {
        lastActivityAt: new Date().toISOString(),
        messageCount: threadState.messageCount + 2,
        status: 'awaiting_user',
      });

      // Check if conversation is complete
      const issues = await this.getCurrentIssues(threadState.caseId, tenantId);
      const isComplete = issues.length === 0;

      if (isComplete && this.config.autoProceedWhenReady) {
        // Trigger draft creation
        const result = await this.triggerDraftCreation(threadId, threadState.caseId, tenantId);
        return { questions: [], isComplete: true, result };
      }

      // Extract next questions
      const questions = this.extractQuestions(messages, issues);

      return { questions, isComplete };
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Apply a correction patch from user input
   */
  async applyCorrection(
    threadId: string,
    patch: JsonPatchOperation[],
    tenantId: string
  ): Promise<{
    success: boolean;
    remainingIssues: Issue[];
    questions: UserQuestion[];
  }> {
    const span = this.tracer.startSpan('conversation.applyCorrection', {
      threadId,
      patchCount: patch.length,
    });

    try {
      const threadState = await this.stateManager.getThreadState(threadId, tenantId);
      if (!threadState) {
        throw new Error('Thread not found');
      }

      // Send patch request to agent
      const patchMessage = `Please apply this correction: ${JSON.stringify(patch)}`;
      const messages = await this.client.sendMessage(
        threadId,
        patchMessage,
        threadState.caseId
      );

      // Handle tool calls (revalidate_case will be called)
      await this.handleToolCalls(
        threadId,
        messages,
        threadState.caseId,
        tenantId
      );

      // Get remaining issues
      const remainingIssues = await this.getCurrentIssues(threadState.caseId, tenantId);

      // Update pending issues in state
      await this.stateManager.updateThreadState(threadId, tenantId, {
        pendingIssues: remainingIssues.map((i) => i.code),
        lastActivityAt: new Date().toISOString(),
      });

      // Get next questions
      const questions = this.extractQuestions(
        await this.client.getMessages(threadId),
        remainingIssues
      );

      return {
        success: true,
        remainingIssues,
        questions,
      };
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Request draft creation
   */
  async requestDraftCreation(
    threadId: string,
    tenantId: string
  ): Promise<ConversationResult> {
    const threadState = await this.stateManager.getThreadState(threadId, tenantId);
    if (!threadState) {
      throw new Error('Thread not found');
    }

    return this.triggerDraftCreation(threadId, threadState.caseId, tenantId);
  }

  /**
   * Handle tool calls from agent
   */
  private async handleToolCalls(
    threadId: string,
    messages: AgentMessage[],
    caseId: string,
    tenantId: string
  ): Promise<{ runId?: string }> {
    // Check if there are pending tool calls
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.toolCalls || lastMessage.toolCalls.length === 0) {
      return {};
    }

    const span = this.tracer.startSpan('conversation.handleToolCalls', {
      threadId,
      toolCallCount: lastMessage.toolCalls.length,
    });

    try {
      // Get the current run
      const threadState = await this.stateManager.getThreadState(threadId, tenantId);
      if (!threadState) {
        throw new Error('Thread not found');
      }

      // Execute tools
      const results = await this.toolExecutor.executeAll(
        lastMessage.toolCalls,
        tenantId,
        threadState.correlationId
      );

      // For now, return without submitting (the client handles runs differently)
      // In a full implementation, we'd track the run ID and submit results

      span.addEvent('tools_executed', {
        resultCount: results.length,
        allSucceeded: results.every((r) => r.success),
      });

      return {};
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Trigger draft creation
   */
  private async triggerDraftCreation(
    threadId: string,
    caseId: string,
    tenantId: string
  ): Promise<ConversationResult> {
    const span = this.tracer.startSpan('conversation.triggerDraft', {
      threadId,
      caseId,
    });

    try {
      // Send create draft request to agent
      const messages = await this.client.sendMessage(
        threadId,
        'All issues are resolved. Please create the draft sales order in Zoho Books.',
        caseId
      );

      // Handle the create_zoho_draft tool call
      await this.handleToolCalls(threadId, messages, caseId, tenantId);

      // Get final state
      const threadState = await this.stateManager.getThreadState(threadId, tenantId);

      // Update thread as completed
      await this.stateManager.updateThreadState(threadId, tenantId, {
        status: 'completed',
        lastActivityAt: new Date().toISOString(),
      });

      // Get Zoho order details from the last message
      // In a real implementation, we'd parse the tool result
      const result: ConversationResult = {
        status: 'draft_created',
        turnCount: threadState?.messageCount ?? 0,
        questionsAsked: 0, // Would track this
        patchesApplied: 0, // Would track this
      };

      span.addEvent('draft_created', { caseId });

      return result;
    } catch (error) {
      span.setError(error as Error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        turnCount: 0,
        questionsAsked: 0,
        patchesApplied: 0,
      };
    } finally {
      span.end();
    }
  }

  /**
   * Extract questions from agent messages
   */
  private extractQuestions(
    messages: AgentMessage[],
    currentIssues: Issue[]
  ): UserQuestion[] {
    const questions: UserQuestion[] = [];

    // Find the last assistant message
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    if (assistantMessages.length === 0) {
      return questions;
    }

    const lastMessage = assistantMessages[assistantMessages.length - 1];

    // Parse questions from message content
    // In a real implementation, we'd have more sophisticated parsing
    // or the agent would return structured questions

    // For now, generate questions based on current issues
    for (const issue of currentIssues) {
      const question = this.issueToQuestion(issue);
      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  /**
   * Convert an issue to a user question
   */
  private issueToQuestion(issue: Issue): UserQuestion | null {
    const questionId = `q_${issue.code}_${Date.now()}`;

    switch (issue.code) {
      case 'AMBIGUOUS_CUSTOMER':
        return {
          id: questionId,
          text: `Multiple customer matches found. ${issue.message} Please select the correct customer.`,
          type: 'customer_selection',
          issueCode: issue.code,
          fieldPath: '/customer/zoho_customer_id',
          required: true,
        };

      case 'CUSTOMER_NOT_FOUND':
        return {
          id: questionId,
          text: `Customer "${issue.fields?.[0] || 'Unknown'}" not found in Zoho. Please search for the correct customer.`,
          type: 'customer_selection',
          issueCode: issue.code,
          fieldPath: '/customer/zoho_customer_id',
          required: true,
        };

      case 'AMBIGUOUS_ITEM':
      case 'ITEM_NOT_FOUND':
        return {
          id: questionId,
          text: issue.message,
          type: 'item_selection',
          issueCode: issue.code,
          required: true,
        };

      case 'MISSING_REQUIRED_FIELD':
        return {
          id: questionId,
          text: `Required field missing: ${issue.fields?.join(', ')}. Please provide the value.`,
          type: 'text',
          issueCode: issue.code,
          fieldPath: issue.fields?.[0] ? `/${issue.fields[0]}` : undefined,
          required: true,
        };

      case 'COMMITTEE_DISAGREEMENT':
        return {
          id: questionId,
          text: issue.message,
          type: 'selection',
          issueCode: issue.code,
          required: true,
        };

      default:
        if (issue.severity === 'blocker' || issue.severity === 'error') {
          return {
            id: questionId,
            text: issue.message,
            type: 'confirmation',
            issueCode: issue.code,
            required: issue.severity === 'blocker',
          };
        }
        return null;
    }
  }

  /**
   * Format user answers as a message for the agent
   */
  private formatAnswersAsMessage(answers: UserAnswer[]): string {
    const parts: string[] = [];

    for (const answer of answers) {
      if (typeof answer.value === 'object') {
        parts.push(`For question ${answer.questionId}: ${JSON.stringify(answer.value)}`);
      } else {
        parts.push(`For question ${answer.questionId}: ${answer.value}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Get current issues for a case
   */
  private async getCurrentIssues(caseId: string, tenantId: string): Promise<Issue[]> {
    // This would call the case service to get current issues
    // For now, return empty (would be implemented with actual case service)
    return [];
  }

  /**
   * Cancel a conversation
   */
  async cancelConversation(
    threadId: string,
    tenantId: string,
    reason?: string
  ): Promise<void> {
    const span = this.tracer.startSpan('conversation.cancel', { threadId });

    try {
      await this.stateManager.updateThreadState(threadId, tenantId, {
        status: 'completed',
        lastActivityAt: new Date().toISOString(),
      });

      await this.client.deleteThread(threadId);

      this.logger.info('Conversation cancelled', { threadId, reason });
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }
}
