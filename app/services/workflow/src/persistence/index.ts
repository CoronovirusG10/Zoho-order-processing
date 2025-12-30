/**
 * Persistence Layer Exports
 *
 * Provides Cosmos DB persistence for workflow service components.
 */

// Cosmos client
export {
  WorkflowCosmosClient,
  createWorkflowCosmosClientFromEnv,
  type WorkflowCosmosConfig,
  type WorkflowCosmosContainers,
} from './cosmos-client.js';

// Cases repository
export {
  CasesRepository,
  type Case,
  type CaseStatus,
  type CreateCaseInput,
  type CasesRepositoryConfig,
  type ICasesRepository,
} from './cases-repository.js';

// Events repository
export {
  EventsRepository,
  type AuditEvent,
  type EventType,
  type AppendEventInput,
  type EventsRepositoryConfig,
  type IEventsRepository,
} from './events-repository.js';
