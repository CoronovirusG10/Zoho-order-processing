/**
 * Workflow Orchestrator Service
 *
 * Azure Durable Functions-based workflow orchestrator for order processing.
 * Coordinates the full lifecycle from file upload to Zoho draft creation.
 */

// Import all orchestrations
import './orchestrations/order-processing';

// Import all activities
import './activities/store-file';
import './activities/parse-excel';
import './activities/run-committee';
import './activities/resolve-customer';
import './activities/resolve-items';
import './activities/create-zoho-draft';
import './activities/notify-user';
import './activities/update-case';
import './activities/apply-corrections';
import './activities/apply-selections';

// Import all triggers
import './triggers/http-trigger';
import './triggers/queue-trigger';
import './triggers/http-event-trigger';
import './triggers/http-status-trigger';

// Import entities
import './entities/case-entity';

// Export types
export * from './types';

// Export utilities
export * from './utils/durable-client';
