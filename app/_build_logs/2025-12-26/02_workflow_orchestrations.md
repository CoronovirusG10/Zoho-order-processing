# Workflow Orchestrations - Durable Functions v3 Migration

**Date**: 2025-12-26
**Status**: COMPLETED
**Verification**: `npx tsc --noEmit` passed successfully

## Summary

Successfully migrated the workflow service orchestration, entity, and client files to durable-functions v3 API patterns.

## Files Modified

### 1. `/app/services/workflow/src/orchestrations/order-processing.ts`

**Changes Made:**

1. **Fixed `context.log.info()` to `context.log()`** (Line 40)
   - The v3 API uses `context.log()` directly instead of `context.log.info()`
   - Updated the log helper function to use the correct method
   - Also ensured data is serialized as JSON string for proper logging

2. **Fixed WorkflowResult type casting issues** (Lines 264-267, 304-307, 338-342, 362-366)
   - Removed incomplete `finalState` objects that didn't match the `WorkflowState` interface
   - Changed from `as WorkflowResult` casting to explicit typed variable declarations
   - The `finalState` property is optional so it can be omitted

**Before:**
```typescript
context.log.info(`[${caseId}] ${step}: ${message}`, data);
// ...
return {
  status: 'cancelled',
  finalState: { caseId, status: 'cancelled' },
} as WorkflowResult;
```

**After:**
```typescript
context.log(`[${caseId}] ${step}: ${message}`, data ? JSON.stringify(data) : '');
// ...
const result: WorkflowResult = {
  status: 'cancelled',
};
return result;
```

---

### 2. `/app/services/workflow/src/entities/case-entity.ts`

**Changes Made:**

1. **Replaced `dispatchEntity()` with manual operation dispatch** (Lines 203-359)
   - The v3 API does not have a `dispatchEntity()` method
   - Implemented manual dispatch using `context.df.operationName` switch/case pattern
   - Properly typed the entity context as `df.EntityContext<CaseState | null>`

2. **Fixed state initialization type handling** (Line 206)
   - Used nullish coalescing (`?? null`) to handle undefined state properly

3. **Fixed operation input type casting** (Various lines)
   - Used `as unknown as` pattern for proper type narrowing from generic entity input type
   - Applied to: `updateStatus`, `storeFileMetadata`, `addError`, `addAuditEvent`

4. **Updated exports** (Line 362)
   - Changed from `export default caseEntity` to `export type { CaseState }`
   - The entity is now registered directly with `df.app.entity()`

**Before:**
```typescript
const caseEntity = (context: df.EntityContext<CaseEntity>) => {
  const entity = new CaseEntity();
  if (context.df.getState()) {
    Object.assign(entity, context.df.getState());
  }
  context.df.dispatchEntity(entity);
  context.df.setState(entity);
};
df.app.entity('CaseEntity', caseEntity);
```

**After:**
```typescript
df.app.entity('CaseEntity', (context: df.EntityContext<CaseState | null>) => {
  let state: CaseState | null = context.df.getState(() => null) ?? null;
  const operationName = context.df.operationName;
  const operationInput = context.df.getInput();

  switch (operationName) {
    case 'init': { /* ... */ }
    case 'updateStatus': { /* ... */ }
    // ... other operations
  }

  context.df.setState(state);
});
```

---

### 3. `/app/services/workflow/src/utils/durable-client.ts`

**Changes Made:**

1. **Updated client type references** (Lines 26, 45, 58, 76, 87, 98, 109, 136)
   - Changed `df.DurableOrchestrationClient` to `df.DurableClient`
   - Updated all method signatures to use the new type

2. **Updated status return types** (Lines 63, 113, 140)
   - Changed `df.OrchestrationStatus` to `df.DurableOrchestrationStatus`
   - This is the correct exported type from durable-functions v3

3. **Updated `startNew()` method signature** (Lines 32-36)
   - Changed from positional parameters to options object pattern
   - v3 API: `client.startNew(orchestratorName, { instanceId, input })`

4. **Updated `getStatus()` method signature** (Lines 64-69)
   - Changed from boolean parameters to options object pattern
   - v3 API: `client.getStatus(instanceId, { showHistory, showHistoryOutput, showInput })`

5. **Updated `getStatusBy()` filter pattern** (Lines 114-128)
   - Replaced `new df.OrchestrationStatusQueryCondition()` with plain object filter
   - v3 API uses `df.OrchestrationFilter` interface for filtering

6. **Updated `waitForCompletion()` implementation** (Lines 141-157)
   - The v3 `waitForCompletionOrCreateCheckStatusResponse()` returns `HttpResponse`
   - Implemented polling-based approach for status checking
   - Returns `DurableOrchestrationStatus` when orchestration completes

**Before:**
```typescript
static async startNew(
  client: df.DurableOrchestrationClient,
  orchestratorName: string,
  options: StartOrchestrationOptions
): Promise<string> {
  await client.startNew(orchestratorName, instanceId, options.input);
}

static async getStatusBy(...): Promise<df.DurableOrchestrationStatus[]> {
  const condition = new df.OrchestrationStatusQueryCondition();
  // ...
}
```

**After:**
```typescript
static async startNew(
  client: df.DurableClient,
  orchestratorName: string,
  options: StartOrchestrationOptions
): Promise<string> {
  await client.startNew(orchestratorName, { instanceId, input: options.input });
}

static async getStatusBy(...): Promise<df.DurableOrchestrationStatus[]> {
  const filter: df.OrchestrationFilter = {};
  // ...
}
```

---

## API Migration Reference

| v2 API | v3 API |
|--------|--------|
| `df.DurableOrchestrationClient` | `df.DurableClient` |
| `df.OrchestrationStatusQueryCondition` | `df.OrchestrationFilter` (plain object) |
| `context.log.info()` | `context.log()` |
| `context.df.dispatchEntity()` | Manual switch on `context.df.operationName` |
| `client.startNew(name, id, input)` | `client.startNew(name, { instanceId, input })` |
| `client.getStatus(id, h, ho, i)` | `client.getStatus(id, { showHistory, showHistoryOutput, showInput })` |

## Verification

```bash
cd /data/order-processing/app/services/workflow && npx tsc --noEmit
# Exit code: 0 (success)
```

## Reference Documentation

- [Durable Functions Node.js Model Upgrade Guide](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-node-model-upgrade)
