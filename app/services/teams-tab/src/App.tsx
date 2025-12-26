/**
 * Main application component
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeamsAuth } from './hooks/useTeamsAuth';
import { useRole } from './hooks/useRole';
import { useCases } from './hooks/useCases';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { CaseFilters } from './components/CaseFilters';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SkipLink, LiveRegion } from './components/SkipLink';
import type { CaseFilters as Filters } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { isInitialized, error: teamsError } = useTeamsAuth();
  const { isSalesManager, isLoading: roleLoading, error: roleError } = useRole();

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});

  const { cases, isLoading: casesLoading, error: casesError } = useCases({
    filters,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Loading state
  if (!isInitialized || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teams-light-bg dark:bg-teams-dark-bg">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Initializing...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (teamsError || roleError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teams-light-bg dark:bg-teams-dark-bg">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <h2 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
            Initialization Error
          </h2>
          <p className="text-sm text-red-800 dark:text-red-200">
            {teamsError?.message || roleError?.message || 'Failed to initialize application'}
          </p>
        </div>
      </div>
    );
  }

  // Generate screen reader announcement for case count
  const caseCountAnnouncement = casesLoading
    ? 'Loading cases...'
    : `${cases.length} ${cases.length === 1 ? 'case' : 'cases'} found`;

  // Case detail view
  if (selectedCaseId) {
    return (
      <div className="min-h-screen bg-teams-light-bg dark:bg-teams-dark-bg">
        <SkipLink targetId="case-detail-content" label="Skip to case details" />
        <main id="case-detail-content">
          <CaseDetail
            caseId={selectedCaseId}
            onBack={() => setSelectedCaseId(null)}
          />
        </main>
      </div>
    );
  }

  // Case list view
  return (
    <div className="min-h-screen bg-teams-light-bg dark:bg-teams-dark-bg">
      <SkipLink targetId="main-content" />
      <main id="main-content" className="mx-auto max-w-7xl p-6">
        {/* Screen reader announcements */}
        <LiveRegion>{caseCountAnnouncement}</LiveRegion>

        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isSalesManager ? 'Team Cases' : 'My Cases'}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isSalesManager
              ? 'View and manage all team sales order cases'
              : 'View and manage your sales order cases'}
          </p>
        </header>

        {/* Filters */}
        <section aria-label="Case filters">
          <CaseFilters
            filters={filters}
            onFiltersChange={setFilters}
            showSalespersonFilter={isSalesManager}
          />
        </section>

        {/* Error message */}
        {casesError && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            role="alert"
          >
            <p className="text-sm text-red-800 dark:text-red-200">
              Failed to load cases: {casesError.message}
            </p>
          </div>
        )}

        {/* Loading state */}
        {casesLoading && (
          <div aria-busy="true" aria-live="polite">
            <LoadingSpinner />
          </div>
        )}

        {/* Case list */}
        {!casesLoading && (
          <section aria-label="Cases">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {cases.length} {cases.length === 1 ? 'case' : 'cases'} found
              </p>
            </div>

            <CaseList
              cases={cases}
              onCaseClick={setSelectedCaseId}
              showSalesperson={isSalesManager}
            />
          </section>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
