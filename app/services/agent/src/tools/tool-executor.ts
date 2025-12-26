/**
 * Tool Executor
 *
 * Executes tool calls from the agent and returns results.
 * Each tool call is traced and logged for audit purposes.
 */

import {
  ToolCall,
  ToolResult,
  ToolName,
  GetCaseArgs,
  GetCaseResult,
  RevalidateCaseArgs,
  RevalidateCaseResult,
  CreateZohoDraftArgs,
  CreateZohoDraftResult,
  LookupCandidatesArgs,
  LookupCandidatesResult,
  CommitteeMapFieldsArgs,
  CommitteeMapFieldsResult,
  JsonPatchOperation,
} from '../types.js';
import { validateToolArgs } from './tool-definitions.js';
import { AgentTracer } from '../tracing/agent-tracer.js';
import { AgentStateManager } from '../state/agent-state-manager.js';
import { Logger } from '@order-processing/shared';

/**
 * External service dependencies for tool execution
 */
export interface ToolDependencies {
  /** Case service for case operations */
  caseService: CaseServiceInterface;
  /** Zoho service for draft creation */
  zohoService: ZohoServiceInterface;
  /** Customer matcher for lookups */
  customerMatcher: CustomerMatcherInterface;
  /** Item matcher for lookups */
  itemMatcher: ItemMatcherInterface;
  /** Committee engine for field mapping */
  committeeEngine: CommitteeEngineInterface;
}

/**
 * Case service interface
 */
export interface CaseServiceInterface {
  getCase(caseId: string, tenantId: string): Promise<any>;
  applyPatch(caseId: string, tenantId: string, patch: JsonPatchOperation[]): Promise<any>;
  revalidate(caseId: string, tenantId: string): Promise<any>;
}

/**
 * Zoho service interface
 */
export interface ZohoServiceInterface {
  createDraftSalesOrder(caseId: string, tenantId: string): Promise<{
    success: boolean;
    salesorderId?: string;
    salesorderNumber?: string;
    error?: string;
  }>;
}

/**
 * Customer matcher interface
 */
export interface CustomerMatcherInterface {
  searchCustomers(query: string, limit?: number): Promise<Array<{
    zoho_customer_id: string;
    display_name: string;
    score: number;
    match_reason: string;
  }>>;
}

/**
 * Item matcher interface
 */
export interface ItemMatcherInterface {
  searchItems(query: string, limit?: number): Promise<Array<{
    zoho_item_id: string;
    name: string;
    sku?: string;
    gtin?: string;
    score: number;
    match_reason: string;
  }>>;
}

/**
 * Committee engine interface
 */
export interface CommitteeEngineInterface {
  runFieldMapping(caseId: string): Promise<{
    consensus: 'unanimous' | 'majority' | 'split' | 'no_consensus';
    mappings: Array<{
      sourceHeader: string;
      canonicalField: string;
      confidence: number;
      votes: number;
    }>;
    disagreements?: Array<{
      sourceHeader: string;
      votes: Record<string, string>;
    }>;
  }>;
}

/**
 * Tool Executor class
 */
export class ToolExecutor {
  private readonly deps: ToolDependencies;
  private readonly stateManager: AgentStateManager;
  private readonly logger: Logger;
  private readonly tracer: AgentTracer;

  constructor(
    deps: ToolDependencies,
    stateManager: AgentStateManager,
    logger: Logger,
    tracer: AgentTracer
  ) {
    this.deps = deps;
    this.stateManager = stateManager;
    this.logger = logger.child({ component: 'ToolExecutor' });
    this.tracer = tracer;
  }

  /**
   * Execute a tool call and return the result
   */
  async execute(
    toolCall: ToolCall,
    tenantId: string,
    correlationId: string
  ): Promise<ToolResult> {
    const span = this.tracer.startSpan('tool.execute', {
      toolName: toolCall.name,
      toolCallId: toolCall.id,
      correlationId,
    });

    try {
      // Validate arguments
      const validation = validateToolArgs(toolCall.name, toolCall.arguments);
      if (!validation.valid) {
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            error: 'Invalid arguments',
            details: validation.errors,
          }),
          success: false,
          error: validation.errors.join('; '),
        };
      }

      // Execute the appropriate tool
      let result: unknown;
      switch (toolCall.name as ToolName) {
        case 'get_case':
          result = await this.executeGetCase(
            toolCall.arguments as unknown as GetCaseArgs,
            tenantId
          );
          break;

        case 'revalidate_case':
          result = await this.executeRevalidateCase(
            toolCall.arguments as unknown as RevalidateCaseArgs,
            tenantId
          );
          break;

        case 'create_zoho_draft':
          result = await this.executeCreateZohoDraft(
            toolCall.arguments as unknown as CreateZohoDraftArgs,
            tenantId
          );
          break;

        case 'lookup_candidates':
          result = await this.executeLookupCandidates(
            toolCall.arguments as unknown as LookupCandidatesArgs
          );
          break;

        case 'committee_map_fields':
          result = await this.executeCommitteeMapFields(
            toolCall.arguments as unknown as CommitteeMapFieldsArgs
          );
          break;

        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }

      span.addEvent('tool_completed', {
        toolName: toolCall.name,
        success: true,
      });

      return {
        toolCallId: toolCall.id,
        content: JSON.stringify(result),
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      span.setError(error as Error);
      this.logger.error('Tool execution failed', error as Error, {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
      });

      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: errorMessage }),
        success: false,
        error: errorMessage,
      };
    } finally {
      span.end();
    }
  }

  /**
   * Execute multiple tool calls
   */
  async executeAll(
    toolCalls: ToolCall[],
    tenantId: string,
    correlationId: string
  ): Promise<ToolResult[]> {
    // Execute tools sequentially to maintain consistency
    const results: ToolResult[] = [];
    for (const toolCall of toolCalls) {
      const result = await this.execute(toolCall, tenantId, correlationId);
      results.push(result);
    }
    return results;
  }

  /**
   * Get case tool implementation
   */
  private async executeGetCase(
    args: GetCaseArgs,
    tenantId: string
  ): Promise<GetCaseResult> {
    const caseData = await this.deps.caseService.getCase(args.caseId, tenantId);

    return {
      caseId: args.caseId,
      status: caseData.status,
      canonicalOrder: caseData.canonicalOrder,
      issues: caseData.issues || [],
    };
  }

  /**
   * Revalidate case tool implementation
   */
  private async executeRevalidateCase(
    args: RevalidateCaseArgs,
    tenantId: string
  ): Promise<RevalidateCaseResult> {
    this.logger.info('Applying patches to case', {
      caseId: args.caseId,
      patchCount: args.patch.length,
    });

    // Apply the JSON patch operations
    await this.deps.caseService.applyPatch(args.caseId, tenantId, args.patch);

    // Revalidate the case
    const validationResult = await this.deps.caseService.revalidate(
      args.caseId,
      tenantId
    );

    return {
      success: true,
      newIssues: validationResult.newIssues || [],
      resolvedIssues: validationResult.resolvedIssues || [],
      validationPassed: validationResult.passed,
    };
  }

  /**
   * Create Zoho draft tool implementation
   */
  private async executeCreateZohoDraft(
    args: CreateZohoDraftArgs,
    tenantId: string
  ): Promise<CreateZohoDraftResult> {
    this.logger.info('Creating Zoho draft sales order', {
      caseId: args.caseId,
    });

    const result = await this.deps.zohoService.createDraftSalesOrder(
      args.caseId,
      tenantId
    );

    return {
      success: result.success,
      salesorderId: result.salesorderId,
      salesorderNumber: result.salesorderNumber,
      error: result.error,
    };
  }

  /**
   * Lookup candidates tool implementation
   */
  private async executeLookupCandidates(
    args: LookupCandidatesArgs
  ): Promise<LookupCandidatesResult> {
    this.logger.info('Looking up candidates', {
      caseId: args.caseId,
      kind: args.kind,
      query: args.query,
    });

    if (args.kind === 'customer') {
      const candidates = await this.deps.customerMatcher.searchCustomers(
        args.query,
        10
      );

      return {
        kind: 'customer',
        candidates: candidates.map((c) => ({
          id: c.zoho_customer_id,
          name: c.display_name,
          score: c.score,
          matchReason: c.match_reason,
        })),
        totalFound: candidates.length,
      };
    } else {
      const candidates = await this.deps.itemMatcher.searchItems(
        args.query,
        10
      );

      return {
        kind: 'item',
        candidates: candidates.map((i) => ({
          id: i.zoho_item_id,
          name: i.name,
          sku: i.sku,
          gtin: i.gtin,
          score: i.score,
          matchReason: i.match_reason,
        })),
        totalFound: candidates.length,
      };
    }
  }

  /**
   * Committee map fields tool implementation
   */
  private async executeCommitteeMapFields(
    args: CommitteeMapFieldsArgs
  ): Promise<CommitteeMapFieldsResult> {
    this.logger.info('Running committee field mapping', {
      caseId: args.caseId,
    });

    const result = await this.deps.committeeEngine.runFieldMapping(args.caseId);

    return {
      success: true,
      consensus: result.consensus,
      mappings: result.mappings,
      disagreements: result.disagreements?.map((d) => ({
        sourceHeader: d.sourceHeader,
        votes: d.votes,
        needsUserDecision: true,
      })),
    };
  }
}
