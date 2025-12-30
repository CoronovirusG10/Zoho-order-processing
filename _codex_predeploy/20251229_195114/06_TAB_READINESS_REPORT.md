# 06 - Personal Tab Readiness Report

**Run ID:** 20251229_195114
**Generated:** 2025-12-29T19:51:XX UTC
**Status:** READY (with prerequisites)

---

## Executive Summary

The Teams personal tab is **code-complete** and **build-ready**. The implementation correctly supports:
- **My Cases** view (user scope - SalesUser role)
- **Manager View** (team scope - SalesManager role with salesperson filter)
- **Audit View** (read-only - OpsAuditor role)

**Build Status:** PASS - TypeScript, lint, and Vite build all succeed.

---

## 1. Tab Project Location

| Item | Path |
|------|------|
| **Project Root** | `/data/order-processing/app/services/teams-tab/` |
| **Package** | `@order-processing/teams-tab@1.0.0` |
| **Build Output** | `./dist/` |
| **Build Tool** | Vite 6.0.5 with React plugin |
| **Framework** | React 18.3.0 + TypeScript 5.7.0 |

### Key Files
```
src/
  App.tsx              # Main app with role-based rendering
  hooks/
    useRole.ts         # Role detection (SalesUser/SalesManager/OpsAuditor)
    useCases.ts        # Case list fetching with filters
    useTeamsAuth.ts    # Teams SDK SSO initialization
  services/
    auth-service.ts    # Token exchange (Teams -> API)
    api-client.ts      # Backend API calls with auth
  components/
    CaseFilters.tsx    # Filter controls (manager sees salesperson filter)
    CaseList.tsx       # Case list display
    CaseDetail.tsx     # Full case detail view
```

---

## 2. Build Readiness

### Build Scripts
| Script | Command | Status |
|--------|---------|--------|
| `dev` | `vite` | Development server on port 3000 |
| `build` | `tsc && vite build` | **PASS** |
| `type-check` | `tsc --noEmit` | **PASS** |
| `lint` | `eslint . --ext ts,tsx` | **PASS** |
| `preview` | `vite preview` | Production preview |

### Build Output (Last Successful)
```
dist/
  index.html                   0.70 kB
  assets/
    index-D3v0-wbN.css        24.42 kB (gzip: 4.87 kB)
    query-Bc34EP3Z.js         38.91 kB (gzip: 11.98 kB) - React Query
    teams-CIKDRNS0.js         42.56 kB (gzip: 14.67 kB) - @microsoft/teams-js
    index-DT5SoonN.js         57.70 kB (gzip: 15.23 kB) - App code
    vendor-CRB3T2We.js       141.78 kB (gzip: 45.52 kB) - React/ReactDOM
```

**Total Bundle:** ~305 kB (~92 kB gzipped)

### Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@microsoft/teams-js` | ^2.31.0 | Teams SDK for SSO |
| `react` | ^18.3.0 | UI framework |
| `@tanstack/react-query` | ^5.62.0 | Data fetching/caching |
| `tailwindcss` | ^3.4.17 | Styling |
| `date-fns` | ^4.1.0 | Date formatting |

---

## 3. Runtime Routing

### Hosting Option: Azure Static Web Apps (Recommended)

**Configuration:** `public/staticwebapp.config.json`
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{css,scss,js,ts,tsx,png,gif,ico,jpg,svg}"]
  },
  "globalHeaders": {
    "X-Frame-Options": "ALLOW-FROM https://*.teams.microsoft.com"
  }
}
```

### Teams Manifest Configuration

**Manifest:** `/data/order-processing/app/teams-app/manifest.json`

**Static Tabs Defined:**
| Tab | Entity ID | Content URL | Purpose |
|-----|-----------|-------------|---------|
| My Orders | `orders` | `https://{{TAB_DOMAIN}}/tab?context=orders` | User's cases |
| Team Orders | `team-orders` | `https://{{TAB_DOMAIN}}/tab?context=team-orders` | Manager view |
| About | `about` | N/A | App info |

**Note:** Current manifest uses query params (`?context=orders`), but the app routing handles this via role-based rendering in `App.tsx`.

### Required Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API endpoint | `https://api-order-processing.azurewebsites.net/api` |
| `VITE_TAB_APP_CLIENT_ID` | Entra app client ID (Tenant A) | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

---

## 4. Access Control Model

### Role-Based Rendering (Implemented)

**File:** `src/App.tsx` (lines 99-115)

```tsx
// Header changes based on role
<h1>{isSalesManager ? 'Team Cases' : 'My Cases'}</h1>
<p>{isSalesManager
  ? 'View and manage all team sales order cases'
  : 'View and manage your sales order cases'}</p>

// Filters adapt to role
<CaseFilters
  filters={filters}
  onFiltersChange={setFilters}
  showSalespersonFilter={isSalesManager}  // Manager only
/>

// Case list shows salesperson column for managers
<CaseList
  cases={cases}
  onCaseClick={setSelectedCaseId}
  showSalesperson={isSalesManager}  // Manager only
/>
```

### Role Detection (Implemented)

**File:** `src/hooks/useRole.ts`

| Role | Property | Capabilities |
|------|----------|--------------|
| `SalesUser` | `isSalesUser` | View own cases only |
| `SalesManager` | `isSalesManager` | View all team cases, salesperson filter |
| `OpsAuditor` | `isOpsAuditor` | View all cases (read-only), download audit bundles |

### API-Level Scoping

The `/api/cases` endpoint is expected to enforce user scoping server-side:
- **SalesUser:** Returns only cases where `createdBy.aadId` matches user
- **SalesManager:** Returns all team cases
- **OpsAuditor:** Returns all cases (read-only)

**Note:** This is handled by the backend API, not the tab.

---

## 5. Authentication Flow

```
Teams (Tenant B)
    |
    v
Teams SDK getAuthToken()
    |
    v
Teams SSO Token (audience: TAB_APP_CLIENT_ID)
    |
    v
POST /api/auth/exchange-token
    |
    v
API Access Token (Tenant A app)
    |
    v
GET /api/auth/profile -> { roles: ['SalesUser' | 'SalesManager' | 'OpsAuditor'] }
    |
    v
Role-based UI rendering
```

---

## 6. Deployment Readiness Checklist

### Code/Build (Complete)
- [x] TypeScript compiles without errors
- [x] ESLint passes with 0 warnings
- [x] Vite build succeeds
- [x] Role-based rendering implemented
- [x] Salesperson filter shows for managers only
- [x] Teams SDK integration for SSO
- [x] React Query for data fetching

### Infrastructure (Pending)
- [ ] Azure Static Web App provisioned
- [ ] Custom domain configured (optional)
- [ ] Environment variables set (`VITE_API_BASE_URL`, `VITE_TAB_APP_CLIENT_ID`)
- [ ] CORS configured on API for tab domain

### Entra Configuration (Pending - Done in Prompt 03)
- [ ] Tab app registration in Tenant A (multi-tenant)
- [ ] API permissions configured
- [ ] Token exchange endpoint working
- [ ] Redirect URIs set for Teams

### Teams Manifest (Pending)
- [ ] Replace `{{TAB_DOMAIN}}` placeholder with actual domain
- [ ] Replace `{{TAB_APP_CLIENT_ID}}` with app client ID
- [ ] Replace `{{BOT_APP_CLIENT_ID}}` with bot client ID
- [ ] Add tab domain to `validDomains`
- [ ] Upload manifest package to Tenant B

---

## 7. Recommendations

### Immediate Actions
1. **Deploy Static Web App:** Use Azure CLI commands from `DEPLOYMENT.md`
2. **Set Environment Variables:** Configure via Azure Portal or CLI
3. **Configure CORS:** Add tab domain to API allowed origins
4. **Update Manifest:** Replace placeholders, create ZIP package

### Routing Refinement (Optional)
The manifest defines separate tabs for "My Orders" and "Team Orders" with query params:
- Current: App renders based on role, ignoring query params
- Option A: Keep current (auto-adapts to user role)
- Option B: Parse `context` query param for explicit tab switching

Current implementation is simpler and works correctly.

---

## 8. Commands Log

See: `/data/order-processing/_codex_predeploy/20251229_195114/06_TAB_READINESS_COMMANDS.log`

Summary:
```
npm run type-check  # PASS - 0 errors
npm run lint        # PASS - 0 warnings
npm run build       # PASS - 3.09s build time
```

---

## Paste-Back Report

```
=== 06_TAB_READINESS ===
Run ID: 20251229_195114
Status: READY (with prerequisites)

TAB PROJECT
  Location: /data/order-processing/app/services/teams-tab/
  Package: @order-processing/teams-tab@1.0.0
  Framework: React 18.3 + Vite 6.0 + TypeScript 5.7

BUILD STATUS
  type-check: PASS
  lint: PASS
  build: PASS (3.09s, ~305kB total, ~92kB gzip)

ACCESS CONTROL MODEL
  SalesUser:    My Cases view (user-scoped)
  SalesManager: Team Cases view (salesperson filter visible)
  OpsAuditor:   All cases (read-only, audit download)

  Implementation: Role-based rendering in App.tsx
  - showSalespersonFilter={isSalesManager}
  - showSalesperson={isSalesManager}
  - Header text adapts to role

MANIFEST TABS (app/teams-app/manifest.json)
  - My Orders:   entityId=orders
  - Team Orders: entityId=team-orders
  - About:       entityId=about

HOSTING CONFIG
  - staticwebapp.config.json with SPA fallback
  - X-Frame-Options: ALLOW-FROM https://*.teams.microsoft.com

ENV VARS NEEDED
  - VITE_API_BASE_URL
  - VITE_TAB_APP_CLIENT_ID

PENDING INFRASTRUCTURE
  [ ] Azure Static Web App deployment
  [ ] Environment variables in Azure
  [ ] CORS on API for tab domain
  [ ] Manifest placeholder replacement
  [ ] Teams app package upload

OUTPUT
  Report: _codex_predeploy/20251229_195114/06_TAB_READINESS_REPORT.md
  Log:    _codex_predeploy/20251229_195114/06_TAB_READINESS_COMMANDS.log
```

---

*Report generated by Codex prompt 06_TAB_READINESS*
