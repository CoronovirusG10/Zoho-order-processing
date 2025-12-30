# Claude Code Orchestration Prompt: Order Processing Activity Implementation

**Created:** 2025-12-30
**Purpose:** Execute consensus-validated implementation plan for order processing workflow activities
**Estimated Effort:** 8-10 dev-days across 14 tasks

---

## CONTEXT

You are implementing the order processing system for Pippa of London. The infrastructure is 100% deployed (VM, Temporal, Cosmos, Blob, Teams bot, Zoho service). The gap is that **all 10 Temporal workflow activities are mock implementations** and the Teams bot doesn't properly handle file uploads.

A 5-model Zen consensus (gpt-5.1, o3, DeepSeek-V3.2-Speciale, gemini-2.5-pro) validated the implementation plan with 8/10 average confidence and unanimous approval.

---

## ORCHESTRATION INSTRUCTIONS

Follow the CTO orchestrator pattern from `~/.claude/CLAUDE.md`:

1. **Delegate to Task agents** for any work touching 3+ files
2. **Use model `claude-opus-4-5`** (ultrathink) for all spawned Task agents
3. **Maximum 75 concurrent Task agents** - use parallel spawning for independent work
4. **Tasks spawning Tasks is FORBIDDEN** - causes context explosion
5. **Log all work** to `docs/claude-logs/daily/YYYY-MM-DD.md` per logging protocol
6. **Use TodoWrite** to track progress through all 14 tasks

---

## CONSENSUS-VALIDATED DECISIONS

These architectural decisions were validated by multi-model consensus. Do NOT deviate without new consensus:

| Decision | Validated Answer |
|----------|------------------|
| **Priority Order** | Move `createZohoDraft` to Phase 1A for user value |
| **Zoho Service** | Reuse existing service with thin activity wrappers - NO new wrappers |
| **Cosmos Integration** | Reuse `cosmos-client.ts` patterns, create order-processing repositories |
| **Error Handling** | Temporal retries for transient; workflow-level for business errors |
| **Audit Trail** | Keep distributed (Cosmos `events` + Blob WORM bundles) |

---

## IMPLEMENTATION PLAN

### Phase 1A: Minimal Happy Path (CRITICAL)

Execute these 7 tasks in dependency order:

#### Task 1: Fix Teams File Upload Content Type
**Priority:** BLOCKER - nothing works without this
**File:** `app/services/teams-bot/src/handlers/file-upload-handler.ts`

**Current Gap:**
- Bot checks for Excel MIME types but doesn't handle `application/vnd.microsoft.teams.file.download.info`
- This is the Teams file consent flow content type

**Implementation Requirements:**
```typescript
// In isExcelFile() or handleAttachment(), add:
if (attachment.contentType === 'application/vnd.microsoft.teams.file.download.info') {
  const downloadUrl = attachment.content?.downloadUrl;
  const fileType = attachment.content?.fileType;
  const uniqueId = attachment.content?.uniqueId;

  // Check if fileType indicates Excel
  if (fileType === 'xlsx' || fileType === 'xls') {
    // Proceed with download from downloadUrl
  }
}
```

**Test:** Upload an Excel file in Teams personal chat - bot should recognize and process it.

---

#### Task 2: Wire Cosmos DB Client + Repositories
**Priority:** Required for case persistence
**Files to create/modify:**
- Reuse pattern from: `app/services/zoho/src/persistence/cosmos-client.ts`
- Create: `app/services/workflow/src/repositories/cases-repository.ts`
- Create: `app/services/workflow/src/repositories/events-repository.ts`
- Modify: `app/services/workflow/src/worker.ts` (initialize client)

**Implementation Requirements:**
```typescript
// cases-repository.ts
export interface CasesRepository {
  createCase(data: CreateCaseInput): Promise<Case>;
  updateCaseStatus(caseId: string, status: CaseStatus, updates?: Partial<Case>): Promise<Case>;
  getCase(caseId: string): Promise<Case | null>;
  getCasesByTenant(tenantId: string, limit?: number): Promise<Case[]>;
}

// events-repository.ts
export interface EventsRepository {
  appendEvent(caseId: string, event: AuditEvent): Promise<void>;
  getEventsByCaseId(caseId: string): Promise<AuditEvent[]>;
}
```

**Cosmos Containers (already defined in Bicep):**
- `cases` - partition key: `/tenantId`
- `events` - partition key: `/caseId`

---

#### Task 3: Implement storeFile Activity
**File:** `app/services/workflow/src/activities/store-file.ts`
**Current:** Mock implementation returning fake blob URI

**Implementation Requirements:**
1. Accept `downloadUrl` from Teams attachment
2. Download file bytes using Bot Framework connector auth or direct HTTP
3. Compute SHA-256 hash for idempotency
4. Upload to Blob Storage: `orders-incoming/{caseId}/original.xlsx`
5. Return `{ blobUri, sha256, sizeBytes }`

**Integration Points:**
- Use existing `FileDownloadService` from `app/services/teams-bot/src/services/file-download.ts`
- Or create new Blob client in workflow service

---

#### Task 4: Implement parseExcel Activity
**File:** `app/services/workflow/src/activities/parse-excel.ts`
**Current:** Mock implementation returning fake extraction result

**Implementation Requirements:**
1. Download Excel from Blob Storage
2. Call Evidence Pack Builder (exists at `app/services/committee/src/utils/evidence-pack-builder.ts`)
3. Extract:
   - Column headers
   - Sample values (max 5 per column)
   - Column statistics (data types, patterns like GTIN/SKU/currency)
   - Language detection (en, fa, ar, mixed)
4. Check for formulas - if present, return blocking result
5. Return evidence pack + canonical extraction

**Blocking Conditions:**
- Formulas detected → return `{ blocked: true, reason: 'formulas' }`
- Protected sheets → return `{ blocked: true, reason: 'protected' }`

---

#### Task 5: Implement updateCase Activity
**File:** `app/services/workflow/src/activities/update-case.ts`
**Current:** Mock implementation that just logs

**Implementation Requirements:**
1. Use `casesRepository` from Task 2
2. Update case status and any additional fields
3. Append event to `eventsRepository`
4. Return updated case

```typescript
export async function updateCase(input: UpdateCaseInput): Promise<Case> {
  const { caseId, status, updates, eventType } = input;

  // Update case document
  const updatedCase = await casesRepository.updateCaseStatus(caseId, status, updates);

  // Append audit event
  await eventsRepository.appendEvent(caseId, {
    type: eventType,
    timestamp: new Date().toISOString(),
    status,
    metadata: updates
  });

  return updatedCase;
}
```

---

#### Task 6: Implement createZohoDraft Activity
**File:** `app/services/workflow/src/activities/create-zoho-draft.ts`
**Current:** Mock implementation returning fake Zoho ID

**Implementation Requirements:**
1. Use existing Zoho service from `app/services/zoho/src/api/sales-orders.ts`
2. Build sales order payload from canonical extraction
3. Call `createDraftSalesOrderIdempotent()` with `reference_number` as idempotency key
4. Store request/response in Blob for audit: `orders-audit/{caseId}/zoho/`
5. Return Zoho sales order ID and draft URL

**Idempotency:** Use `caseId` as `reference_number` to prevent duplicate orders on Temporal replay.

---

#### Task 7: Implement notifyUser Activity
**File:** `app/services/workflow/src/activities/notify-user.ts`
**Current:** Mock implementation that just logs

**Implementation Requirements:**
1. Accept `conversationReference`, `cardType`, and `cardData`
2. POST to teams-bot service endpoint (or use proactive messaging directly)
3. Build appropriate adaptive card based on `cardType`:
   - `processing` → ProcessingCard
   - `issues` → IssuesCard
   - `review` → ReviewCard
   - `success` → SuccessCard
4. Send via Bot Framework proactive messaging

**Integration Points:**
- Use `ConversationStore` to retrieve conversation reference
- Use `CardFactory` to build adaptive cards
- Use `TurnContext.sendActivity()` for proactive messaging

---

### Phase 1B: Human Loop & Validation

#### Task 8: Implement runCommittee Activity
**File:** `app/services/workflow/src/activities/run-committee.ts`

**Implementation Requirements:**
1. Accept evidence pack from parseExcel
2. Call 3 AI models with bounded evidence (not full spreadsheet)
3. Aggregate responses for column mapping validation
4. Store model outputs in Blob: `orders-audit/{caseId}/committee/`
5. Return aggregated result with disagreements flagged

---

#### Task 9: Implement resolveCustomer Activity
**File:** `app/services/workflow/src/activities/resolve-customer.ts`

**Implementation Requirements:**
1. Use Zoho Customers API from `app/services/zoho/src/api/customers.ts`
2. Search by customer reference from extraction
3. Return matched customer or ambiguous matches
4. If ambiguous, workflow will signal for user selection

---

#### Task 10: Implement resolveItems Activity
**File:** `app/services/workflow/src/activities/resolve-items.ts`

**Implementation Requirements:**
1. Use Zoho Items API from `app/services/zoho/src/api/items.ts`
2. Match by SKU first, GTIN fallback, fuzzy name only with confirmation
3. Return matched items or ambiguous matches
4. If ambiguous, workflow will signal for user selection

---

#### Task 11: Implement applyCorrections Activity
**File:** `app/services/workflow/src/activities/apply-corrections.ts`

**Implementation Requirements:**
1. Accept corrections from user via workflow signal
2. Update canonical extraction with corrections
3. Store corrections in Blob for audit
4. Return updated extraction

---

#### Task 12: Implement applySelections Activity
**File:** `app/services/workflow/src/activities/apply-selections.ts`

**Implementation Requirements:**
1. Accept user selections (customer, items) from workflow signal
2. Update case with selected values
3. Store selections in Blob for audit
4. Return updated case

---

### Phase 1C: Completion

#### Task 13: Wire Audit Bundle Finalization
**File:** `app/services/workflow/src/activities/finalize-audit.ts` (new)

**Implementation Requirements:**
1. Gather all artifacts from Blob
2. Create audit manifest JSON
3. Write to WORM container: `orders-audit/{caseId}/audit/audit_manifest.json`
4. Optionally create ZIP bundle

---

#### Task 14: Implement Status Command
**File:** `app/services/teams-bot/src/handlers/message-handler.ts`

**Implementation Requirements:**
1. Query Cosmos `cases` container for user's recent cases
2. Return formatted status card with case list
3. Include status, created date, last update

---

## LOGGING PROTOCOL

After completing each task, update the daily log:

**Location:** `docs/claude-logs/daily/YYYY-MM-DD.md`

**Format:**
```markdown
## Session [N]: Order Processing Activity Implementation (HH:MM-HH:MM)

### Work Completed
- [time] Task 1: Fixed Teams file upload content type handling
- [time] Task 2: Created cases-repository.ts and events-repository.ts

### Files Modified
| File | Changes |
|------|---------|
| app/services/teams-bot/src/handlers/file-upload-handler.ts | Added file.download.info handling |
| app/services/workflow/src/repositories/cases-repository.ts | Created new file |

### Decisions Made
- Used existing cosmos-client.ts pattern per consensus
- Partition key strategy: tenantId for cases, caseId for events

### Pending
- Task 3: storeFile activity
```

---

## EXECUTION STRATEGY

1. **Start with Task 1** (Teams file upload) - it's a blocker
2. **Parallelize Tasks 2-4** where possible (Cosmos repos + activities)
3. **Test each activity in isolation** before integration
4. **Run Temporal workflow end-to-end** after Phase 1A complete
5. **Use Zen codereview** before committing significant changes
6. **Create atomic commits** per task with clear messages

---

## VERIFICATION CHECKPOINTS

After Phase 1A, verify:
- [ ] Excel file upload in Teams triggers workflow
- [ ] File is stored in Blob Storage
- [ ] Case is created in Cosmos DB
- [ ] Zoho draft is created (even with minimal validation)
- [ ] User receives success card in Teams

After Phase 1B, verify:
- [ ] AI committee runs and produces mappings
- [ ] Ambiguous matches trigger user selection cards
- [ ] Corrections are applied and persisted

After Phase 1C, verify:
- [ ] Audit bundle is finalized in WORM storage
- [ ] Status command returns case list

---

## QUALITY GATES

Before marking each task complete:
1. **Code compiles** - `npm run build` passes
2. **Type-safe** - no TypeScript errors
3. **Activity tested** - manual or unit test verification
4. **Logged** - daily log updated
5. **Committed** - atomic commit with task reference

---

## CONTEXT FILES

Key files for reference:
- **Workflow definition:** `app/services/workflow/src/workflows/order-processing.workflow.ts`
- **Workflow types:** `app/services/workflow/src/workflows/types.ts`
- **Evidence pack builder:** `app/services/committee/src/utils/evidence-pack-builder.ts`
- **Zoho service:** `app/services/zoho/src/api/sales-orders.ts`
- **Teams bot handler:** `app/services/teams-bot/src/handlers/file-upload-handler.ts`
- **Cosmos client pattern:** `app/services/zoho/src/persistence/cosmos-client.ts`
- **Blob layout:** `app/services/storage/src/blob-layout.ts`

---

## START COMMAND

Begin implementation:

```
Execute this plan following the CTO orchestrator pattern. Start with Task 1 (Teams file upload fix),
then proceed through the dependency chain. Use parallel Task agents for independent work.
Log all progress to docs/claude-logs/daily/. Commit after each significant task completion.
```

---

**END OF PROMPT**
