# Workflow Activities Migration - Durable Functions v3 API

**Date:** 2025-12-26
**Task:** Migrate workflow activity files to durable-functions v3 API
**Status:** COMPLETED

## Summary

Successfully migrated 8 workflow activity files from the legacy durable-functions API pattern to the new v3 API using `@azure/functions` InvocationContext.

## Files Modified

| File | Status |
|------|--------|
| `services/workflow/src/activities/apply-corrections.ts` | Migrated |
| `services/workflow/src/activities/apply-selections.ts` | Migrated |
| `services/workflow/src/activities/create-zoho-draft.ts` | Migrated |
| `services/workflow/src/activities/notify-user.ts` | Migrated |
| `services/workflow/src/activities/resolve-customer.ts` | Migrated |
| `services/workflow/src/activities/resolve-items.ts` | Migrated |
| `services/workflow/src/activities/run-committee.ts` | Migrated |
| `services/workflow/src/activities/update-case.ts` | Migrated |

## Changes Applied to Each File

### 1. Import Statement Update
```diff
- import * as df from 'durable-functions';
+ import { InvocationContext } from '@azure/functions';
```

### 2. Function Declaration Update
```diff
- const activityName: df.ActivityHandler = async (
-   input: InputType,
-   context: df.InvocationContext
- ): Promise<OutputType> => {
+ export async function activityName(
+   input: InputType,
+   context: InvocationContext
+ ): Promise<OutputType> {
```

### 3. Registration Removal
```diff
- df.app.activity('ActivityName', { handler: activityName });
```

### 4. Export Update
```diff
- };
-
- df.app.activity('ActivityName', { handler: activityName });
-
- export default activityName;
+ }
+
+ export default activityName;
```

## Pattern Reference

The migration followed the pattern established in the already-migrated example files:
- `services/workflow/src/activities/store-file.ts`
- `services/workflow/src/activities/parse-excel.ts`

## Verification

### TypeScript Compilation
```bash
cd /data/order-processing/app/services/workflow && npx tsc --noEmit src/activities/*.ts
```
**Result:** All activity files compile without errors.

### Note on Other Errors
The full project compilation (`npx tsc --noEmit`) shows pre-existing errors in files outside the migration scope:
- `src/entities/case-entity.ts` - DurableEntityContext issue
- `src/utils/durable-client.ts` - DurableOrchestrationClient deprecation

These errors existed before the migration and are not related to the activity file changes.

## Before/After Example

### Before (apply-corrections.ts)
```typescript
import * as df from 'durable-functions';
import { ApplyCorrectionsInput, ApplyCorrectionsOutput } from '../types';

const applyCorrectionsActivity: df.ActivityHandler = async (
  input: ApplyCorrectionsInput,
  context: df.InvocationContext
): Promise<ApplyCorrectionsOutput> => {
  // ... implementation
};

df.app.activity('ApplyCorrections', { handler: applyCorrectionsActivity });

export default applyCorrectionsActivity;
```

### After (apply-corrections.ts)
```typescript
import { InvocationContext } from '@azure/functions';
import { ApplyCorrectionsInput, ApplyCorrectionsOutput } from '../types';

export async function applyCorrectionsActivity(
  input: ApplyCorrectionsInput,
  context: InvocationContext
): Promise<ApplyCorrectionsOutput> {
  // ... implementation
}

export default applyCorrectionsActivity;
```

## Next Steps

The following files still need migration to complete the v3 API transition (out of scope for this task):
- `src/entities/case-entity.ts` - requires DurableEntityContext updates
- `src/utils/durable-client.ts` - requires DurableOrchestrationClient replacement
