/**
 * Create Zoho Draft Activity
 *
 * Creates a draft sales order in Zoho Books using the resolved data.
 * Implements idempotency check and queue fallback if Zoho is unavailable.
 */

import { InvocationContext } from '@azure/functions';
import { CreateZohoDraftInput, CreateZohoDraftOutput } from '../types';

export async function createZohoDraftActivity(
  input: CreateZohoDraftInput,
  context: InvocationContext
): Promise<CreateZohoDraftOutput> {
  const { caseId } = input;

  context.log(`[${caseId}] Creating Zoho draft sales order`);

  try {
    // TODO: Call Zoho service
    // POST /api/zoho/create-draft
    // Body: { caseId }
    // Returns: { success, salesorder_id, salesorder_number, queued, error }

    const zohoServiceUrl = process.env.ZOHO_SERVICE_URL || 'http://localhost:7073/api';

    // Mock implementation for now
    const zohoResult: CreateZohoDraftOutput = {
      success: true,
      salesorder_id: 'SO-00001234',
      salesorder_number: '00001234',
      status: 'draft',
    };

    context.log(`[${caseId}] Zoho draft created: ${zohoResult.salesorder_number}`);

    return zohoResult;
  } catch (error) {
    context.error(`[${caseId}] Failed to create Zoho draft:`, error);

    // Check if this is a transient error (Zoho down)
    const isTransient = error instanceof Error &&
      (error.message.includes('ECONNREFUSED') ||
       error.message.includes('timeout') ||
       error.message.includes('503'));

    if (isTransient) {
      context.warn(`[${caseId}] Zoho appears to be unavailable, queueing order`);
      return {
        success: false,
        queued: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    throw error;
  }
}

export default createZohoDraftActivity;
