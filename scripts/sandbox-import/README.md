# Sandbox Data Import Script

Imports data from `sandbox_data_export.zip` into Zoho Books sandbox environment.

## Prerequisites

1. Extract the sandbox data:
   ```bash
   unzip sandbox_data_export.zip -d sandbox_data_extracted
   ```

2. Set environment variables:
   ```bash
   export ZOHO_CLIENT_ID="your-client-id"
   export ZOHO_CLIENT_SECRET="your-client-secret"
   export ZOHO_REFRESH_TOKEN="your-refresh-token"
   export ZOHO_ORGANIZATION_ID="your-org-id"
   export ZOHO_REGION="eu"  # or com, in, au, jp
   ```

## Usage

### Dry Run (Validation Only)
```bash
npm run import:dry-run
```

### Import All Data
```bash
npm run import
```

### Import Specific Entity
```bash
npm run import:customers
npm run import:products
npm run import:salesorders
npm run import:invoices
```

### Test with Limited Records
```bash
npx ts-node import-sandbox-data.ts --dry-run --limit 10
```

## Data Notes

### Record Counts
- Customers: 524 records
- Products: 477 records
- Sales Orders: 313 records (last 30 days)
- Invoices: 251 records (last 30 days)

### Important Limitations

1. **Sales Orders and Invoices have no line items** in the export data. The script creates placeholder line items with notes indicating the original totals.

2. **Rate Limiting**: The script enforces 650ms delay between API calls to stay under Zoho's 100 requests/minute limit.

3. **Customer ID Mapping**: Sales orders and invoices require customers to be imported first to maintain referential integrity.

## Import Order

The script imports data in this order to maintain referential integrity:
1. Customers (required first)
2. Products (independent)
3. Sales Orders (depends on customers)
4. Invoices (depends on customers)

## Logs

Import logs are written to `docs/claude-logs/daily/YYYY-MM-DD.md`

## Error Handling

- Transient errors (5xx, timeouts) are retried up to 3 times with exponential backoff
- Rate limit responses (429) trigger automatic wait based on Retry-After header
- Failed records are logged but don't stop the import process
