/**
 * Temporal Activities Index
 *
 * Exports all workflow activities for the order processing system.
 * Activities are simple async functions that perform the actual work
 * (file operations, API calls, database operations, etc.).
 *
 * In Temporal, activities:
 * - Can be retried independently
 * - Have configurable timeouts
 * - Are the only place where side effects (I/O) should occur
 */

// Re-export all activities
export { storeFile } from './store-file';
export { parseExcel } from './parse-excel';
export { runCommittee } from './run-committee';
export {
  resolveCustomer,
  initializeResolveCustomerActivity,
  isResolveCustomerInitialized,
} from './resolve-customer';
export {
  resolveItems,
  initializeResolveItemsActivity,
  isResolveItemsInitialized,
} from './resolve-items';
export { applyCorrections } from './apply-corrections';
export { applySelections } from './apply-selections';
export { createZohoDraft } from './create-zoho-draft';
export { notifyUser } from './notify-user';
export { updateCase } from './update-case';
export { finalizeAudit } from './finalize-audit';

// Re-export all types for convenience
export type { StoreFileInput, StoreFileOutput } from './store-file';
export type { ParseExcelInput, ParseExcelOutput, ParseIssue } from './parse-excel';
export type { RunCommitteeInput, RunCommitteeOutput, CommitteeDisagreement, ColumnMapping } from './run-committee';
export type {
  ResolveCustomerInput,
  ResolveCustomerOutput,
  CustomerCandidate,
  IZohoCustomerService,
  ICustomerMatcher,
  ICasesRepository as IResolveCustomerCasesRepository,
  CaseData as ResolveCustomerCaseData,
  CachedCustomer,
  CustomerMatchResult,
} from './resolve-customer';
export type {
  ResolveItemsInput,
  ResolveItemsOutput,
  ItemCandidate,
  ResolvedItem,
  IZohoItemService,
  IItemMatcher,
  ICasesRepository as IResolveItemsCasesRepository,
  CaseData as ResolveItemsCaseData,
  CachedItem as ResolveItemsCachedItem,
  ItemMatchResult,
} from './resolve-items';
export type { ApplyCorrectionsInput, ApplyCorrectionsOutput, CorrectionData, FieldCorrection } from './apply-corrections';
export type { ApplySelectionsInput, ApplySelectionsOutput, CustomerSelection, ItemSelection, UserSelections } from './apply-selections';
export type { CreateZohoDraftInput, CreateZohoDraftOutput } from './create-zoho-draft';
export type {
  NotifyUserInput,
  NotifyUserOutput,
  NotificationType,
  IssueItem,
  OrderReview,
  ZohoCreationResult,
  SelectionCandidates,
} from './notify-user';
export type { UpdateCaseInput, UpdateCaseOutput } from './update-case';
export type { FinalizeAuditInput, FinalizeAuditOutput, AuditManifest, ArtifactReference } from './finalize-audit';
