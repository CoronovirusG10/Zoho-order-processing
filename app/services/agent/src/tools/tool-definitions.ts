/**
 * Tool Definitions for Azure AI Foundry Agent
 *
 * OpenAPI-style tool definitions that enable the agent to:
 * - Get case data
 * - Revalidate after corrections
 * - Create Zoho drafts
 * - Look up customer/item candidates
 * - Request committee field mapping
 */

/**
 * Tool definition type (OpenAPI style for Azure AI Foundry)
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, PropertyDefinition>;
      required: string[];
    };
  };
}

/**
 * Property definition for tool parameters
 */
interface PropertyDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  items?: PropertyDefinition;
  properties?: Record<string, PropertyDefinition>;
  required?: string[];
}

/**
 * Get case tool definition
 */
const getCaseTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_case',
    description: `Retrieves the current case data including the canonical order, customer information, line items, and any validation issues. Use this to understand the current state of the order before making corrections.`,
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: 'The unique identifier for the case to retrieve',
        },
      },
      required: ['caseId'],
    },
  },
};

/**
 * Revalidate case tool definition
 */
const revalidateCaseTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'revalidate_case',
    description: `Applies corrections to the case data using JSON Patch operations and re-validates.
Use this after the user confirms a correction. The patch operations must follow RFC 6902 format.
IMPORTANT: Never invent values - only use values provided by the user or from lookup_candidates results.`,
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: 'The case ID to apply corrections to',
        },
        patch: {
          type: 'array',
          description: 'Array of JSON Patch operations (RFC 6902)',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                description: 'The operation type',
                enum: ['add', 'remove', 'replace', 'move', 'copy', 'test'],
              },
              path: {
                type: 'string',
                description: 'JSON Pointer path to the target location (e.g., /customer/zoho_customer_id)',
              },
              value: {
                type: 'string',
                description: 'The value for add/replace/test operations',
              },
              from: {
                type: 'string',
                description: 'Source path for move/copy operations',
              },
            },
            required: ['op', 'path'],
          },
        },
      },
      required: ['caseId', 'patch'],
    },
  },
};

/**
 * Create Zoho draft tool definition
 */
const createZohoDraftTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_zoho_draft',
    description: `Creates a draft sales order in Zoho Books from the validated case data.
IMPORTANT: Only call this when ALL validation issues are resolved and the user has confirmed they want to proceed.
This action is idempotent - calling it multiple times for the same case will return the existing draft.`,
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: 'The case ID to create a draft sales order for',
        },
      },
      required: ['caseId'],
    },
  },
};

/**
 * Lookup candidates tool definition
 */
const lookupCandidatesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'lookup_candidates',
    description: `Searches for matching customers or items in Zoho Books based on a query.
Use this to find candidates when:
- Customer matching is ambiguous and needs user selection
- Item matching failed or is ambiguous
- User wants to search for a different customer/item

Results include match scores and reasons. Present these to the user for selection.
NEVER auto-select - always let the user choose from candidates.`,
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: 'The case ID for context',
        },
        kind: {
          type: 'string',
          description: 'The type of lookup to perform',
          enum: ['customer', 'item'],
        },
        query: {
          type: 'string',
          description: 'Search query (customer name, SKU, GTIN, or product name)',
        },
        lineIndex: {
          type: 'number',
          description: 'For item lookups, the 0-based line item index this relates to',
        },
      },
      required: ['caseId', 'kind', 'query'],
    },
  },
};

/**
 * Committee map fields tool definition
 */
const committeeMapFieldsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'committee_map_fields',
    description: `Invokes the AI committee to review and reach consensus on field mappings.
Use this when:
- Initial schema inference had low confidence
- Column mappings seem incorrect
- User reports that extracted values are in wrong fields

The committee uses multiple AI models to vote on the correct mappings.
If there's disagreement, present options to the user for final decision.`,
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: 'The case ID to run committee mapping for',
        },
      },
      required: ['caseId'],
    },
  },
};

/**
 * Get all tool definitions for the agent
 */
export function getToolDefinitions(): ToolDefinition[] {
  return [
    getCaseTool,
    revalidateCaseTool,
    createZohoDraftTool,
    lookupCandidatesTool,
    committeeMapFieldsTool,
  ];
}

/**
 * Get a specific tool definition by name
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  const tools = getToolDefinitions();
  return tools.find((t) => t.function.name === name);
}

/**
 * Validate tool arguments against definition
 */
export function validateToolArgs(
  toolName: string,
  args: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const tool = getToolDefinition(toolName);
  if (!tool) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }

  const errors: string[] = [];
  const { required, properties } = tool.function.parameters;

  // Check required parameters
  for (const req of required) {
    if (args[req] === undefined || args[req] === null) {
      errors.push(`Missing required parameter: ${req}`);
    }
  }

  // Check parameter types
  for (const [key, value] of Object.entries(args)) {
    const propDef = properties[key];
    if (!propDef) {
      // Allow unknown properties (extension)
      continue;
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (propDef.type !== actualType && value !== null && value !== undefined) {
      errors.push(
        `Invalid type for ${key}: expected ${propDef.type}, got ${actualType}`
      );
    }

    // Check enum values
    if (propDef.enum && !propDef.enum.includes(value as string)) {
      errors.push(
        `Invalid value for ${key}: must be one of ${propDef.enum.join(', ')}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
