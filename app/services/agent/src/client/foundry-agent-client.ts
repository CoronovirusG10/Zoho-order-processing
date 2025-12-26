/**
 * Azure AI Foundry Agent Client
 *
 * Client for interacting with Azure AI Foundry Agent Service.
 * This is a validator assistant that helps users correct parsed order data.
 *
 * Key principles:
 * - Never invent values, only select from candidates
 * - Validator assistant, not extractor
 * - Evidence-based corrections with JSON Patch
 */

import { DefaultAzureCredential } from '@azure/identity';
import {
  AgentConfig,
  AgentMessage,
  ToolCall,
  ToolResult,
  CaseContext,
} from '../types.js';
import { AgentTracer } from '../tracing/agent-tracer.js';
import { getToolDefinitions } from '../tools/tool-definitions.js';
import { Logger } from '@order-processing/shared';

/**
 * System prompt for the validator agent.
 * Emphasizes that the agent is a VALIDATOR, not an extractor.
 */
const SYSTEM_PROMPT = `You are a validation assistant for order processing. Your role is to help users correct and validate parsed order data before creating draft sales orders in Zoho Books.

CRITICAL RULES:
1. You are a VALIDATOR, not an EXTRACTOR. You work with already-parsed data.
2. NEVER invent or guess values. Only select from provided candidates.
3. When resolving ambiguous matches (customers, items), present candidates and let the user choose.
4. All corrections must use JSON Patch format for precise, auditable changes.
5. Every value must be traceable to evidence (cell references from the spreadsheet).

Your capabilities:
- Review parsed order data and identify issues
- Look up customer and item candidates from Zoho Books
- Apply user-selected corrections as JSON Patches
- Re-validate data after corrections
- Trigger draft sales order creation when ready

When presenting options to users:
- Show the match scores and reasons
- Explain why matches are ambiguous
- Never make selections without explicit user confirmation

Communication style:
- Be concise and professional
- Focus on actionable questions
- Group related issues together
- Provide context from the original spreadsheet cells`;

/**
 * Azure AI Foundry Agent Client
 */
export class FoundryAgentClient {
  private readonly config: AgentConfig;
  private readonly credential: DefaultAzureCredential;
  private readonly logger: Logger;
  private readonly tracer: AgentTracer;
  private assistantId: string | null = null;

  constructor(
    config: AgentConfig,
    logger: Logger,
    tracer: AgentTracer
  ) {
    this.config = config;
    this.credential = new DefaultAzureCredential();
    this.logger = logger.child({ component: 'FoundryAgentClient' });
    this.tracer = tracer;
  }

  /**
   * Initialize the agent assistant (create or retrieve existing)
   */
  async initialize(): Promise<void> {
    const span = this.tracer.startSpan('agent.initialize');

    try {
      // Get or create assistant with our tools
      const assistantName = 'order-validation-assistant';

      const response = await this.makeRequest('POST', '/assistants', {
        name: assistantName,
        instructions: SYSTEM_PROMPT,
        model: this.config.deploymentName,
        tools: getToolDefinitions(),
      });

      this.assistantId = response.id;
      span.addEvent('assistant_initialized', { assistantId: this.assistantId });

      this.logger.info('Agent assistant initialized', {
        assistantId: this.assistantId,
      });
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create a new conversation thread
   */
  async createThread(caseContext: CaseContext): Promise<string> {
    const span = this.tracer.startSpan('agent.createThread', {
      caseId: caseContext.caseId,
    });

    try {
      // Create thread with initial context message
      const response = await this.makeRequest('POST', '/threads', {
        messages: [
          {
            role: 'user',
            content: this.buildContextMessage(caseContext),
          },
        ],
        metadata: {
          caseId: caseContext.caseId,
          tenantId: caseContext.tenantId,
          correlationId: caseContext.correlationId,
        },
      });

      const threadId = response.id;
      span.addEvent('thread_created', { threadId });

      this.logger.info('Agent thread created', {
        threadId,
        caseId: caseContext.caseId,
      });

      return threadId;
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Send a user message and get assistant response
   */
  async sendMessage(
    threadId: string,
    content: string,
    caseId: string
  ): Promise<AgentMessage[]> {
    const span = this.tracer.startSpan('agent.sendMessage', {
      threadId,
      caseId,
    });

    try {
      // Add user message to thread
      await this.makeRequest('POST', `/threads/${threadId}/messages`, {
        role: 'user',
        content,
      });

      // Run the assistant
      const run = await this.makeRequest('POST', `/threads/${threadId}/runs`, {
        assistant_id: this.assistantId,
        max_completion_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      // Wait for completion and handle tool calls
      const messages = await this.waitForCompletion(threadId, run.id, caseId);

      span.addEvent('message_processed', {
        messageCount: messages.length,
      });

      return messages;
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Submit tool results and continue
   */
  async submitToolResults(
    threadId: string,
    runId: string,
    results: ToolResult[],
    caseId: string
  ): Promise<AgentMessage[]> {
    const span = this.tracer.startSpan('agent.submitToolResults', {
      threadId,
      runId,
      caseId,
    });

    try {
      await this.makeRequest(
        'POST',
        `/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
        {
          tool_outputs: results.map((r) => ({
            tool_call_id: r.toolCallId,
            output: r.content,
          })),
        }
      );

      // Continue waiting for completion
      const messages = await this.waitForCompletion(threadId, runId, caseId);

      span.addEvent('tool_results_submitted', {
        resultCount: results.length,
      });

      return messages;
    } catch (error) {
      span.setError(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get thread messages
   */
  async getMessages(threadId: string): Promise<AgentMessage[]> {
    const response = await this.makeRequest(
      'GET',
      `/threads/${threadId}/messages`
    );

    return response.data.map(this.mapMessage);
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    await this.makeRequest('DELETE', `/threads/${threadId}`);
    this.logger.info('Agent thread deleted', { threadId });
  }

  /**
   * Wait for run completion, handling tool calls
   */
  private async waitForCompletion(
    threadId: string,
    runId: string,
    caseId: string
  ): Promise<AgentMessage[]> {
    const maxAttempts = 60; // 60 attempts * 1s = 60s max wait
    let attempts = 0;

    while (attempts < maxAttempts) {
      const run = await this.makeRequest(
        'GET',
        `/threads/${threadId}/runs/${runId}`
      );

      switch (run.status) {
        case 'completed':
          return await this.getMessages(threadId);

        case 'requires_action':
          // Return pending tool calls for external handling
          const toolCalls = this.extractToolCalls(run);
          this.logger.info('Run requires tool execution', {
            runId,
            toolCallCount: toolCalls.length,
          });
          // Return current messages with tool call info
          const messages = await this.getMessages(threadId);
          return messages;

        case 'failed':
        case 'cancelled':
        case 'expired':
          throw new Error(`Run ${run.status}: ${run.last_error?.message || 'Unknown error'}`);

        case 'in_progress':
        case 'queued':
          // Still running, wait and retry
          await this.sleep(1000);
          attempts++;
          break;

        default:
          this.logger.warn('Unknown run status', { status: run.status });
          await this.sleep(1000);
          attempts++;
      }
    }

    throw new Error('Run timed out waiting for completion');
  }

  /**
   * Extract tool calls from a run that requires action
   */
  private extractToolCalls(run: any): ToolCall[] {
    const requiredAction = run.required_action;
    if (!requiredAction || requiredAction.type !== 'submit_tool_outputs') {
      return [];
    }

    return requiredAction.submit_tool_outputs.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  /**
   * Build context message with case information
   */
  private buildContextMessage(context: CaseContext): string {
    const { canonicalOrder, issues, fileName } = context;

    let message = `I need help validating an order from file: ${fileName}\n\n`;

    // Add customer info
    message += `Customer: ${canonicalOrder.customer.input_name || 'Not detected'}\n`;
    message += `Status: ${canonicalOrder.customer.resolution_status}\n\n`;

    // Add line items summary
    message += `Line items: ${canonicalOrder.line_items.length}\n`;
    const unresolvedItems = canonicalOrder.line_items.filter(
      (item) => item.match?.status !== 'resolved'
    );
    if (unresolvedItems.length > 0) {
      message += `Unresolved items: ${unresolvedItems.length}\n`;
    }
    message += '\n';

    // Add issues
    if (issues.length > 0) {
      message += `Issues requiring attention (${issues.length}):\n`;
      for (const issue of issues) {
        message += `- [${issue.severity}] ${issue.code}: ${issue.message}\n`;
      }
    } else {
      message += 'No blocking issues detected.\n';
    }

    return message;
  }

  /**
   * Map API message to our format
   */
  private mapMessage(msg: any): AgentMessage {
    return {
      id: msg.id,
      role: msg.role,
      content: Array.isArray(msg.content)
        ? msg.content.map((c: any) => c.text?.value || '').join('')
        : msg.content,
      timestamp: new Date(msg.created_at * 1000).toISOString(),
    };
  }

  /**
   * Make authenticated request to Azure AI Foundry
   */
  private async makeRequest(
    method: string,
    path: string,
    body?: unknown
  ): Promise<any> {
    const token = await this.credential.getToken(
      'https://cognitiveservices.azure.com/.default'
    );

    const url = `${this.config.endpoint}/openai${path}?api-version=${this.config.apiVersion}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${error}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current run status for a thread
   */
  async getRunStatus(threadId: string, runId: string): Promise<{
    status: string;
    toolCalls?: ToolCall[];
  }> {
    const run = await this.makeRequest(
      'GET',
      `/threads/${threadId}/runs/${runId}`
    );

    return {
      status: run.status,
      toolCalls: run.status === 'requires_action'
        ? this.extractToolCalls(run)
        : undefined,
    };
  }
}

/**
 * Create agent client with default configuration
 */
export function createAgentClient(
  endpoint: string,
  logger: Logger,
  tracer: AgentTracer
): FoundryAgentClient {
  const config: AgentConfig = {
    endpoint,
    deploymentName: process.env.AGENT_MODEL_DEPLOYMENT || 'gpt-4o',
    apiVersion: '2024-05-01-preview',
    maxTokens: 4096,
    temperature: 0.1, // Low temperature for consistent validation
    timeoutMs: 60000,
  };

  return new FoundryAgentClient(config, logger, tracer);
}
