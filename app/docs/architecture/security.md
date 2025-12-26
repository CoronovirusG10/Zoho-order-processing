# Security Architecture

## Authentication

### Multi-Tenant Entra ID

Two app registrations in Tenant A (hosting tenant):

1. **Bot App** - For Teams bot authentication
   - Multi-tenant
   - Client credentials flow
   - Used by Bot Framework

2. **Tab/API App** - For user authentication
   - Multi-tenant
   - OAuth 2.0 authorization code + PKCE
   - Exposes API scopes
   - Defines app roles

### Token Flows

```
Teams Tab SSO:
  User ──▶ Teams ──▶ getAuthToken() ──▶ Tab App (Tenant A)
                                            │
                                            ▼
  API ◀── Bearer token with claims ◀────────┘

Bot Framework:
  Teams ──▶ Bot Framework ──▶ Bot App (verify JWT)
                                   │
                                   ▼
  Bot Runtime validates issuer, audience, tenant
```

### Cross-Tenant Considerations

- Bot must validate tokens from any tenant
- Tab SSO works with proper redirect configuration
- Admin consent required in Tenant B

## Authorization

### Role-Based Access Control

App roles defined in Tab/API app:

| Role | Access |
|------|--------|
| SalesUser | Own cases only |
| SalesManager | Team cases |
| OpsAuditor | All cases (read-only) |

### Enforcement

```typescript
// API middleware
function authorizeCase(req: Request, caseId: string): boolean {
  const { userId, roles } = req.auth;
  const case = await getCaseById(caseId);

  if (roles.includes('OpsAuditor')) {
    return true; // Read-only access
  }

  if (roles.includes('SalesManager')) {
    return case.tenantId === req.auth.tenantId;
  }

  // SalesUser - own cases only
  return case.userId === userId;
}
```

## Secrets Management

### Key Vault

All secrets stored in Azure Key Vault:

| Secret | Purpose |
|--------|---------|
| BotAppSecret | Bot Framework auth |
| ZohoClientId | Zoho OAuth |
| ZohoClientSecret | Zoho OAuth |
| ZohoRefreshToken | Zoho API access |
| GeminiApiKey | External AI provider |
| XaiApiKey | External AI provider |

### Access Pattern

```typescript
// Never hardcode or log secrets
const client = new SecretClient(vaultUrl, credential);
const secret = await client.getSecret('ZohoClientSecret');

// Use managed identity
const credential = new DefaultAzureCredential();
```

### Secret Rotation

- Zoho tokens: Automatic refresh
- API keys: Manual rotation, update in Key Vault
- Bot secret: Rotate via Azure Portal, update Key Vault

## Data Protection

### In Transit

- All connections use TLS 1.2+
- HTTPS only for all endpoints
- Private endpoints for internal services (optional)

### At Rest

- Storage: Microsoft-managed encryption
- Cosmos DB: Encrypted by default
- Key Vault: HSM-backed encryption

### Audit Data Retention

- Original files: 5+ years
- Audit events: 5+ years
- Immutable storage policy on audit container
- Lifecycle: Hot → Cool (30d) → Archive (365d)

## Input Validation

### File Uploads

```typescript
// Validate file type
if (!fileName.endsWith('.xlsx')) {
  throw new ValidationError('Only .xlsx files accepted');
}

// Validate file size
if (fileSize > 25 * 1024 * 1024) {
  throw new ValidationError('File too large (max 25MB)');
}

// Scan for formulas (block if present)
if (containsFormulas(workbook)) {
  throw new BlockedError('Formulas detected');
}
```

### API Inputs

- JSON Schema validation on all requests
- Parameterized queries (no SQL/NoSQL injection)
- Rate limiting on public endpoints

## Threat Model

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Malicious Excel | Formula blocking, no macro execution |
| Wrong customer/item | Committee + human approval |
| Duplicate orders | Fingerprint idempotency |
| Token theft | Short-lived tokens, refresh flow |
| Data exfiltration | RBAC, audit logging |
| AI hallucination | Deterministic parsing, evidence required |

### Security Logging

```typescript
// Log security events
logger.security({
  event: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  userId: req.auth.userId,
  resource: 'case',
  resourceId: caseId,
  reason: 'Role insufficient'
});
```

## Compliance

### GDPR Considerations

- User data processed for order fulfillment
- Audit data retained for legal/business purposes
- Data deletion: Case data can be anonymized after retention period

### Audit Requirements

- All actions traceable to user
- Immutable audit trail
- Retention: 5+ years
- Available for compliance review
