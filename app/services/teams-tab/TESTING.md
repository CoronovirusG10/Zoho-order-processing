# Testing Guide - Teams Personal Tab

Comprehensive testing guide for the Teams personal tab application.

## Testing Strategy

### 1. Local Development Testing

#### Prerequisites
- Node.js 18+
- SSL certificates for HTTPS (Teams requirement)
- Access to test API instance
- Teams developer account

#### Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with test values
```

3. Generate SSL certificates (for local HTTPS):
```bash
# Using mkcert (recommended)
mkcert -install
mkcert localhost

# Update vite.config.ts with certificate paths
```

4. Start dev server:
```bash
npm run dev
```

#### Testing in Teams

1. Create Teams app manifest with local URL:
```json
{
  "staticTabs": [
    {
      "entityId": "myCases",
      "name": "My Cases",
      "contentUrl": "https://localhost:3000",
      "scopes": ["personal"]
    }
  ]
}
```

2. Sideload app in Teams:
   - Open Teams
   - Go to Apps → Manage your apps
   - Upload custom app
   - Select your manifest zip

3. Test SSO flow:
   - Open tab
   - Should auto-authenticate
   - Check browser console for errors

### 2. Component Testing

Each component should be tested for:
- Rendering
- User interactions
- Props validation
- Accessibility
- Error states

#### Example Test Cases

**CaseList Component:**
- [ ] Renders empty state when no cases
- [ ] Displays cases in table format
- [ ] Shows correct columns based on user role
- [ ] Handles case click correctly
- [ ] Sorts cases by date
- [ ] Formats dates correctly
- [ ] Shows status badges
- [ ] Accessible via keyboard navigation

**CaseDetail Component:**
- [ ] Loads case data on mount
- [ ] Shows loading spinner while fetching
- [ ] Displays error message on failure
- [ ] Renders all case sections
- [ ] Download button works
- [ ] Create draft button enabled/disabled correctly
- [ ] Blocks draft creation with blocking issues
- [ ] Confirms before creating draft

**CaseFilters Component:**
- [ ] Expands/collapses correctly
- [ ] Updates filters on input change
- [ ] Shows active filter indicator
- [ ] Clear all button works
- [ ] Manager-only filters shown to managers
- [ ] Date range validation

### 3. Hook Testing

**useTeamsAuth:**
- [ ] Initializes Teams SDK
- [ ] Gets Teams context
- [ ] Handles theme changes
- [ ] Sets dark mode class correctly
- [ ] Handles initialization errors

**useRole:**
- [ ] Fetches user profile
- [ ] Caches profile data
- [ ] Returns correct role flags
- [ ] Handles API errors

**useCases:**
- [ ] Fetches cases with filters
- [ ] Handles empty results
- [ ] Auto-refreshes on interval
- [ ] Caches query results
- [ ] Handles API errors

**useCase:**
- [ ] Fetches single case
- [ ] Disabled when no caseId
- [ ] Handles 404 errors
- [ ] Refetches on demand

### 4. API Integration Testing

Create mock API server for testing:

```typescript
// mockApi.ts
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const handlers = [
  rest.get('/api/cases', (req, res, ctx) => {
    return res(ctx.json([
      // Mock case data
    ]));
  }),

  rest.get('/api/cases/:caseId', (req, res, ctx) => {
    return res(ctx.json({
      // Mock case detail
    }));
  }),
];

export const server = setupServer(...handlers);
```

Test scenarios:
- [ ] Successful API calls
- [ ] Network errors
- [ ] Timeout errors
- [ ] 401 Unauthorized
- [ ] 403 Forbidden
- [ ] 404 Not Found
- [ ] 500 Server Error
- [ ] Slow responses

### 5. Authentication Testing

**SSO Flow:**
1. [ ] Teams token acquisition succeeds
2. [ ] Token exchange works
3. [ ] API token cached correctly
4. [ ] Token refresh on expiry
5. [ ] Cross-tenant authentication
6. [ ] Consent prompt handling

**Error Scenarios:**
- [ ] Teams SDK initialization fails
- [ ] getAuthToken() fails
- [ ] Token exchange fails
- [ ] Profile fetch fails
- [ ] Invalid token
- [ ] Expired token

### 6. Role-Based Access Testing

Create test users in Tenant B with different roles:

**SalesUser:**
- [ ] Sees only own cases
- [ ] Cannot see team filter
- [ ] Cannot view other users' cases
- [ ] Can create drafts for own cases

**SalesManager:**
- [ ] Sees all team cases
- [ ] Has salesperson filter
- [ ] Can filter by any user
- [ ] Can view any case
- [ ] Can create drafts for any case

**OpsAuditor:**
- [ ] Read-only access
- [ ] Cannot create drafts
- [ ] Can download audit bundles
- [ ] Can view all cases

### 7. Browser Testing

Test in multiple browsers:
- [ ] Chrome (latest)
- [ ] Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

Test in Teams desktop app:
- [ ] Windows client
- [ ] Mac client

Test in Teams web:
- [ ] Chrome
- [ ] Edge

### 8. Theme Testing

**Light Theme:**
- [ ] Colors contrast correctly
- [ ] Text readable
- [ ] No visual glitches

**Dark Theme:**
- [ ] Automatic switching works
- [ ] All components styled
- [ ] Text readable
- [ ] Correct dark colors

**High Contrast:**
- [ ] High contrast mode detected
- [ ] Colors meet WCAG AAA
- [ ] Focus indicators visible

### 9. Accessibility Testing

Use tools:
- axe DevTools
- WAVE
- Lighthouse
- Screen reader (NVDA/JAWS/VoiceOver)

Check:
- [ ] All interactive elements keyboard accessible
- [ ] Tab order logical
- [ ] Focus indicators visible
- [ ] ARIA labels present
- [ ] Headings hierarchical
- [ ] Color contrast WCAG AA
- [ ] Screen reader announces correctly
- [ ] No keyboard traps
- [ ] Skip links work

### 10. Performance Testing

**Metrics to Monitor:**
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Bundle size < 500KB
- [ ] API response time < 500ms
- [ ] React Query cache working

**Tools:**
- Lighthouse
- Chrome DevTools Performance
- React DevTools Profiler
- Bundle analyzer

### 11. Error Handling Testing

**Network Errors:**
- [ ] Show user-friendly message
- [ ] Provide retry option
- [ ] Don't lose user data
- [ ] Log error details

**API Errors:**
- [ ] Parse error messages
- [ ] Display to user
- [ ] Handle 4xx vs 5xx differently
- [ ] Don't expose sensitive info

**Validation Errors:**
- [ ] Show inline errors
- [ ] Prevent invalid submissions
- [ ] Clear errors on fix
- [ ] Accessible error messages

### 12. Cross-Tenant Testing

**Test Scenario:**
1. User from Tenant B opens tab
2. SSO authenticates against Tenant A app
3. Token exchange succeeds
4. API calls include correct tenant context
5. Role claims from Tenant B recognized

**Verify:**
- [ ] Cross-tenant SSO works
- [ ] Tokens contain correct tenant ID
- [ ] User identity preserved
- [ ] Roles applied correctly

### 13. Localization Testing (Future)

When i18n is implemented:
- [ ] English strings display
- [ ] Farsi strings display
- [ ] RTL layout correct
- [ ] Date formats localized
- [ ] No hardcoded strings
- [ ] Language switches correctly

### 14. Regression Testing

Before each release:
- [ ] All critical user flows work
- [ ] No console errors
- [ ] No broken links
- [ ] Previous bugs still fixed
- [ ] New features don't break old

### 15. User Acceptance Testing

**Test Users:**
- Sales person (real user from Tenant B)
- Sales manager (real user from Tenant B)
- Operations auditor

**Test Scenarios:**
1. View my cases
2. Filter cases
3. View case detail
4. Download audit bundle
5. Create draft sales order
6. Handle issues
7. Switch themes

**Success Criteria:**
- [ ] Users complete tasks without help
- [ ] No confusion about UI
- [ ] Performance acceptable
- [ ] Error messages clear
- [ ] Overall satisfaction positive

## Testing Checklist (Before Deployment)

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing complete
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met
- [ ] Browser compatibility verified
- [ ] Mobile responsive (if needed)
- [ ] SSO flow tested end-to-end
- [ ] Role-based access verified
- [ ] API integration tested
- [ ] Error handling tested
- [ ] Security review complete
- [ ] Documentation updated
- [ ] Change log updated

## Known Issues

Document any known issues or limitations:

1. **Issue:** [Description]
   - **Impact:** [User impact]
   - **Workaround:** [Temporary solution]
   - **Fix planned:** [Yes/No - Version]

## Bug Report Template

When reporting bugs:

```markdown
**Description:**
[Clear description of the issue]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Teams client: [Desktop/Web]
- Browser: [Name and version]
- OS: [Windows/Mac]
- User role: [SalesUser/SalesManager/OpsAuditor]

**Screenshots:**
[If applicable]

**Console Errors:**
```
[Paste any console errors]
```

**Additional Context:**
[Any other relevant information]
```

## Automated Testing (Future)

When adding automated tests:

1. **Unit Tests** (Jest + React Testing Library)
2. **Integration Tests** (Playwright)
3. **E2E Tests** (Playwright in Teams)
4. **Visual Regression** (Percy/Chromatic)
5. **Accessibility Tests** (axe-core)

## Continuous Testing

- Run tests on every PR
- Block merge if tests fail
- Monitor test coverage
- Review flaky tests regularly
- Keep tests fast
