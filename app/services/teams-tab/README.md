# Teams Personal Tab - Order Processing

React application for the Microsoft Teams personal tab that allows users to view and manage their sales order processing cases.

## Features

### Views

1. **My Cases (SalesUser)**
   - List cases created by current user
   - View case status, customer, creation date
   - Click to expand full details
   - Download audit bundles

2. **Team Cases (SalesManager)**
   - View all team cases
   - Filter by salesperson, status, customer, date
   - Same case management capabilities

3. **Case Detail**
   - Full order preview with line items
   - Issues list with severity indicators
   - Audit event timeline
   - Actions: Download audit bundle, Create draft sales order

### Role-Based Access

- **SalesUser**: View own cases only
- **SalesManager**: View all team cases with filtering
- **OpsAuditor**: Read-only access to all cases

## Technology Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **@microsoft/teams-js** - Teams SDK for SSO
- **@tanstack/react-query** - Data fetching and caching
- **date-fns** - Date formatting

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Update environment variables:

```env
VITE_API_BASE_URL=https://your-api.azurewebsites.net/api
VITE_TAB_APP_CLIENT_ID=your-tab-app-client-id
```

### Development

```bash
npm run dev
```

The app will be available at `https://localhost:3000`.

**Note**: Teams requires HTTPS. You'll need to set up SSL certificates for local development. See `vite.config.ts`.

### Build

```bash
npm run build
```

Output will be in the `dist/` directory.

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Project Structure

```
src/
├── components/          # React components
│   ├── CaseList.tsx    # Case list table
│   ├── CaseDetail.tsx  # Case detail view
│   ├── CaseFilters.tsx # Filter controls
│   ├── OrderPreview.tsx # Order preview
│   ├── IssuesList.tsx  # Issues display
│   ├── AuditTimeline.tsx # Audit events
│   ├── StatusBadge.tsx # Status indicator
│   └── LoadingSpinner.tsx # Loading state
├── hooks/              # Custom React hooks
│   ├── useTeamsAuth.ts # Teams authentication
│   ├── useRole.ts      # User role management
│   ├── useCases.ts     # Case list fetching
│   └── useCase.ts      # Single case fetching
├── services/           # Service layer
│   ├── api-client.ts   # Backend API client
│   └── auth-service.ts # Authentication service
├── types/              # TypeScript types
│   └── index.ts        # All type definitions
├── styles/             # Global styles
│   └── globals.css     # Tailwind + custom styles
├── App.tsx             # Main app component
└── main.tsx            # Entry point
```

## Authentication Flow

1. Teams SDK initializes and gets context
2. Request Teams auth token via `authentication.getAuthToken()`
3. Exchange Teams token for API access token
4. Use API token for all backend requests
5. Token cached and auto-refreshed

## API Integration

The tab communicates with the backend API:

- `GET /api/cases` - List cases (with filters)
- `GET /api/cases/:caseId` - Get case detail
- `GET /api/cases/:caseId/audit` - Get audit events
- `GET /api/cases/:caseId/download-sas` - Get SAS URL for audit bundle
- `POST /api/cases/:caseId/create-draft` - Create draft sales order
- `POST /api/auth/exchange-token` - Exchange Teams token
- `GET /api/auth/profile` - Get user profile with roles

## Cross-Tenant Setup

This tab operates in a cross-tenant scenario:
- **Tenant A**: Hosts Azure resources and API
- **Tenant B**: Teams users

See `CROSS_TENANT_TEAMS_DEPLOYMENT.md` for setup details.

### Key Points

1. Multi-tenant Entra app registration in Tenant A
2. Teams app manifest references Tenant A client ID
3. SSO flow handles cross-tenant authentication
4. Role assignments managed in Tenant B Enterprise Apps

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Focus indicators
- ARIA labels and roles

## i18n Support

The app is i18n-ready for English and Farsi:
- Date formatting via `date-fns`
- RTL support in Tailwind
- Language detection from Teams context
- Translatable strings (ready for i18n library)

## Theming

Automatically adapts to Teams theme:
- Default (light)
- Dark
- High contrast

Theme changes are detected and applied in real-time.

## Error Handling

- API errors displayed to users
- Network failures with retry logic
- Authentication errors with re-login
- Loading states for all async operations
- Error boundaries (TODO: implement)

## Security

- All API calls authenticated with JWT
- Tokens stored in memory only
- HTTPS required for all communication
- No sensitive data in localStorage
- Cross-origin requests controlled

## Deployment

### Azure Static Web Apps (Recommended)

1. Build the app:
   ```bash
   npm run build
   ```

2. Deploy `dist/` to Azure Static Web Apps

3. Configure custom domain and SSL

4. Set environment variables in Azure portal

### Azure App Service

1. Build the app
2. Deploy as static site
3. Configure HTTPS redirect
4. Set environment variables

## Teams App Manifest

The tab entry in `manifest.json`:

```json
{
  "staticTabs": [
    {
      "entityId": "myCases",
      "name": "My Cases",
      "contentUrl": "https://your-tab.azurewebsites.net",
      "scopes": ["personal"]
    }
  ],
  "webApplicationInfo": {
    "id": "{TAB_APP_CLIENT_ID}",
    "resource": "api://{TAB_APP_CLIENT_ID}"
  }
}
```

## Troubleshooting

### SSO Not Working

- Check Teams app manifest has correct `webApplicationInfo`
- Verify Entra app registration is multi-tenant
- Check redirect URIs include Teams domains
- Review consent status in Tenant B

### API Calls Failing

- Verify `VITE_API_BASE_URL` is correct
- Check CORS configuration on API
- Ensure API token exchange endpoint works
- Review token claims and roles

### Theme Not Applying

- Check Teams SDK initialization
- Verify theme change handler registered
- Inspect document class list

## License

Proprietary - Internal use only
