# Archived Azure Functions Code

**Archived:** 2025-12-27
**Reason:** Migration to Temporal.io (VM-Only architecture)

This directory contains the legacy Azure Durable Functions code that was replaced by Temporal.io workflows.

## Contents

| Directory/File | Original Purpose |
|----------------|------------------|
| `orchestrations/` | Azure Durable Functions orchestrators |
| `triggers/` | Azure Functions HTTP and queue triggers |
| `entities/` | Azure Durable Entities |
| `durable-client.ts` | Azure Durable Functions client wrapper |
| `host.json` | Azure Functions host configuration |

## Replacement

The functionality has been replaced by:

- `../workflows/order-processing.workflow.ts` - Temporal workflow
- `../activities/*.ts` - Temporal activities
- `../worker.ts` - Temporal worker
- `../server.ts` - Express API server
- `../client.ts` - Temporal client

## Do Not Delete

This code is retained for:
1. Reference during debugging
2. Historical comparison
3. Rollback documentation

## Safe to Delete After

Once production has been stable on Temporal for 30+ days, this archive can be safely deleted.
