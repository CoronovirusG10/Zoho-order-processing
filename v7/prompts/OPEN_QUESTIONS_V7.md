# Open Questions (V7)

These are the remaining unknowns that materially affect build and should be confirmed before production rollout.

## Teams cross-tenant behaviours
1. Confirm that personal chat file `downloadUrl` works cross-tenant without Graph permissions for your specific tenant policies.
   - Test: install app in Tenant B, upload xlsx, bot downloads bytes.
2. Confirm Teams admin policies required in Tenant B:
   - custom app upload / organisational app catalogue
   - external access configuration
   - app permission policies

## Zoho Books specifics
3. Confirm Zoho Sandbox organisation_id and whether you have a separate production org.
4. Confirm the Sales Order custom field:
   - API name / field id
   - “unique” constraint enabled
   - allowed in create sales order payload
5. Confirm how Zoho behaves when a unique custom field value is duplicated on create:
   - error vs overwrite vs ignore

## Excel variability
6. Collect 30–50 representative spreadsheets:
   - English and Farsi headers
   - multi-sheet exports
   - messy merged cells
   - totals rows and currency variations
7. Decide policy for multiple orders accidentally included in one workbook:
   - block vs attempt split

## Committee governance
8. Decide approved provider list (Azure-only vs external allowed per environment).
9. Decide weight update cadence and who signs off changes (controls).

## Access control
10. Define what “manager” means:
    - Entra app role assignment?
    - per-tenant group mapping?
    - are there multiple manager tiers?

## Audit retention
11. Confirm retention minimum (you mentioned ≥5 years) and immutability policy requirements (WORM).

