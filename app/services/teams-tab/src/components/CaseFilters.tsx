/**
 * Case filters component
 */

import { useState } from 'react';
import type { CaseFilters as Filters, CaseStatus } from '@/types';

interface CaseFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  showSalespersonFilter?: boolean;
}

const statusOptions: { value: CaseStatus; label: string }[] = [
  { value: 'processing', label: 'Processing' },
  { value: 'needs-input', label: 'Needs Input' },
  { value: 'ready', label: 'Ready' },
  { value: 'draft-created', label: 'Draft Created' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Blocked' },
];

export function CaseFilters({
  filters,
  onFiltersChange,
  showSalespersonFilter = false,
}: CaseFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStatusChange = (status: CaseStatus, checked: boolean) => {
    const current = filters.status || [];
    const updated = checked
      ? [...current, status]
      : current.filter((s) => s !== status);

    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters =
    filters.status?.length ||
    filters.salespersonId ||
    filters.customerName ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-teams-dark-surface">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="ml-2 rounded-full bg-teams-purple px-2 py-0.5 text-xs text-white">
              Active
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-teams-purple hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Status Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <div className="space-y-2">
              {statusOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.status?.includes(option.value) || false}
                    onChange={(e) => handleStatusChange(option.value, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-teams-purple focus:ring-teams-purple"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Customer Filter */}
          <div>
            <label
              htmlFor="customer-filter"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Customer Name
            </label>
            <input
              id="customer-filter"
              type="text"
              value={filters.customerName || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  customerName: e.target.value || undefined,
                })
              }
              placeholder="Search by customer..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teams-purple focus:outline-none focus:ring-1 focus:ring-teams-purple dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Date Range */}
          <div>
            <label
              htmlFor="date-from"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Date From
            </label>
            <input
              id="date-from"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  dateFrom: e.target.value || undefined,
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teams-purple focus:outline-none focus:ring-1 focus:ring-teams-purple dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="date-to"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Date To
            </label>
            <input
              id="date-to"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  dateTo: e.target.value || undefined,
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teams-purple focus:outline-none focus:ring-1 focus:ring-teams-purple dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Salesperson Filter (Manager only) */}
          {showSalespersonFilter && (
            <div className="md:col-span-2">
              <label
                htmlFor="salesperson-filter"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Salesperson
              </label>
              <input
                id="salesperson-filter"
                type="text"
                value={filters.salespersonId || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    salespersonId: e.target.value || undefined,
                  })
                }
                placeholder="Search by salesperson..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teams-purple focus:outline-none focus:ring-1 focus:ring-teams-purple dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
