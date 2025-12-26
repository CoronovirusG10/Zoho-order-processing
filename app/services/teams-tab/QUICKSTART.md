# Quick Start Guide - Teams Personal Tab

Get the Teams personal tab running in 5 minutes.

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Access to test API instance
- Teams developer account (for testing in Teams)

## 1. Install Dependencies

```bash
cd /data/order-processing/app/services/teams-tab
npm install
```

## 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

Required environment variables:
```env
VITE_API_BASE_URL=https://your-api.azurewebsites.net/api
VITE_TAB_APP_CLIENT_ID=your-tab-app-client-id-from-tenant-a
```

## 3. Start Development Server

```bash
npm run dev
```

The app will start at `http://localhost:3000` (or `https://localhost:3000` if SSL configured).

## 4. Test in Browser (Without Teams)

Open `http://localhost:3000` in your browser.

Note: Some features require Teams context and won't work outside Teams:
- SSO authentication
- Teams theme
- Teams user context

## 5. Test in Teams (Recommended)

### A. Set Up HTTPS for Local Development

Teams requires HTTPS. Use mkcert:

```bash
# Install mkcert
# macOS: brew install mkcert
# Windows: choco install mkcert
# Linux: See https://github.com/FiloSottile/mkcert

# Install local CA
mkcert -install

# Create certificate
mkcert localhost 127.0.0.1 ::1

# Update vite.config.ts to use certificates
```

### B. Create Teams App Manifest

Create `manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "your-unique-app-id",
  "packageName": "com.company.orderprocessing",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://company.com",
    "privacyUrl": "https://company.com/privacy",
    "termsOfUseUrl": "https://company.com/terms"
  },
  "name": {
    "short": "Order Processing",
    "full": "Sales Order Processing Cases"
  },
  "description": {
    "short": "View and manage sales order cases",
    "full": "Personal tab for viewing and managing your sales order processing cases with AI validation"
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#6264A7",
  "staticTabs": [
    {
      "entityId": "myCases",
      "name": "My Cases",
      "contentUrl": "https://localhost:3000",
      "websiteUrl": "https://localhost:3000",
      "scopes": ["personal"]
    }
  ],
  "webApplicationInfo": {
    "id": "your-tab-app-client-id-from-tenant-a",
    "resource": "api://your-tab-app-client-id-from-tenant-a"
  },
  "validDomains": [
    "localhost"
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ]
}
```

### C. Create App Icons

Create two PNG files:
- `color.png` - 192x192px color icon
- `outline.png` - 32x32px outline icon

### D. Create App Package

```bash
# Create a zip file with manifest and icons
zip teams-app.zip manifest.json color.png outline.png
```

### E. Upload to Teams

1. Open Microsoft Teams
2. Go to Apps → Manage your apps
3. Click "Upload a custom app"
4. Select `teams-app.zip`
5. Click "Add" to install

### F. Open the Tab

1. The tab should appear in your Teams apps
2. Click to open
3. Teams will initialize and authenticate

## 6. Verify It Works

### Check Console

Open browser DevTools console and verify:
- No errors
- Teams SDK initialized
- Authentication succeeded
- API calls working

### Test Features

1. View case list (should load from API)
2. Click a case to view details
3. Test filters
4. Switch Teams theme (light/dark)
5. Test role-based features (if applicable)

## 7. Common Issues

### Issue: SSL Certificate Error

**Solution:**
```bash
mkcert -install
# Restart browser
```

### Issue: Teams SDK Not Initializing

**Solution:**
- Ensure running in Teams (not standalone browser)
- Check manifest `contentUrl` is correct
- Verify `webApplicationInfo` matches Entra app

### Issue: Authentication Failing

**Solution:**
- Check `VITE_TAB_APP_CLIENT_ID` is correct
- Verify Entra app registration is multi-tenant
- Check redirect URIs include Teams domains
- Review consent in Tenant B

### Issue: API Calls Failing

**Solution:**
- Check `VITE_API_BASE_URL` is correct
- Verify API is running and accessible
- Check CORS configuration on API
- Review network tab for errors

### Issue: Port Already in Use

**Solution:**
```bash
# Kill process on port 3000
# macOS/Linux: lsof -ti:3000 | xargs kill -9
# Windows: netstat -ano | findstr :3000, then taskkill /PID <PID> /F

# Or use a different port in vite.config.ts
```

## 8. Development Workflow

### Make Changes

Edit files in `src/`:
- Components: `src/components/`
- Hooks: `src/hooks/`
- Services: `src/services/`
- Types: `src/types/`

Changes will hot-reload automatically.

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

## 9. Next Steps

### For Development
- Read README.md for full documentation
- Review TESTING.md for testing guide
- Check STRUCTURE.txt for architecture

### For Deployment
- Read DEPLOYMENT.md for Azure deployment
- Configure production environment variables
- Set up CI/CD pipeline
- Deploy to Azure Static Web Apps

### For Testing
- Create test users with different roles
- Test cross-tenant authentication
- Verify role-based access control
- Test all user workflows

## 10. Helpful Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Preview production build
npm run preview

# Clean install
rm -rf node_modules package-lock.json
npm install
```

## 11. VS Code Setup

Recommended extensions (see `.vscode/extensions.json`):
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript

Extensions will be suggested when you open the project in VS Code.

## 12. Resources

### Documentation
- `/data/order-processing/SOLUTION_DESIGN.md` - Overall solution design
- `/data/order-processing/CROSS_TENANT_TEAMS_DEPLOYMENT.md` - Cross-tenant setup
- `README.md` - Project documentation
- `DEPLOYMENT.md` - Deployment guide
- `TESTING.md` - Testing guide

### External Links
- [Teams Toolkit](https://learn.microsoft.com/microsoftteams/platform/toolkit/teams-toolkit-fundamentals)
- [React Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite](https://vitejs.dev/guide/)

## Support

For issues:
1. Check console for errors
2. Review this guide
3. Check README.md and other documentation
4. Verify environment variables
5. Test API endpoints directly

Happy coding!
