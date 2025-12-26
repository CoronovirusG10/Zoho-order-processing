/**
 * Case list component with keyboard navigation
 */

import { useCallback, useRef, KeyboardEvent } from 'react';
import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';
import type { CaseListItem } from '@/types';

interface CaseListProps {
  cases: CaseListItem[];
  onCaseClick: (caseId: string) => void;
  showSalesperson?: boolean;
}

export function CaseList({
  cases,
  onCaseClick,
  showSalesperson = false,
}: CaseListProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  /**
   * Handle keyboard navigation in the table
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>, caseId: string, index: number) => {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          onCaseClick(caseId);
          break;
        case 'ArrowDown':
          event.preventDefault();
          focusRow(index + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusRow(index - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusRow(0);
          break;
        case 'End':
          event.preventDefault();
          focusRow(cases.length - 1);
          break;
      }
    },
    [cases.length, onCaseClick]
  );

  /**
   * Focus a specific row by index
   */
  const focusRow = (index: number) => {
    if (!tableRef.current) return;
    const rows = tableRef.current.querySelectorAll('tbody tr');
    const targetIndex = Math.max(0, Math.min(index, rows.length - 1));
    const targetRow = rows[targetIndex] as HTMLElement;
    targetRow?.focus();
  };

  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-teams-dark-surface">
        <p className="text-gray-500 dark:text-gray-400">No cases found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-teams-dark-surface">
      <div className="overflow-x-auto">
        <table
          ref={tableRef}
          className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
          role="grid"
          aria-label="Cases list"
        >
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr role="row">
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Customer
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                File
              </th>
              {showSalesperson && (
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Salesperson
                </th>
              )}
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Created
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Zoho Link
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {cases.map((caseItem, index) => (
              <tr
                key={caseItem.caseId}
                onClick={() => onCaseClick(caseItem.caseId)}
                onKeyDown={(e) => handleKeyDown(e, caseItem.caseId, index)}
                className="cursor-pointer transition-colors hover:bg-gray-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teams-purple dark:hover:bg-gray-800 dark:focus:bg-gray-700"
                tabIndex={0}
                role="row"
                aria-rowindex={index + 2}
              >
                <td className="whitespace-nowrap px-6 py-4">
                  <StatusBadge status={caseItem.status} />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {caseItem.customerName || (
                      <span className="italic text-gray-400">Unknown</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs truncate text-sm text-gray-500 dark:text-gray-400">
                    {caseItem.fileName}
                  </div>
                </td>
                {showSalesperson && (
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {caseItem.createdBy.displayName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {caseItem.createdBy.email}
                    </div>
                  </td>
                )}
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {format(new Date(caseItem.createdAt), 'MMM d, yyyy HH:mm')}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {caseItem.zohoDeepLink ? (
                    <a
                      href={caseItem.zohoDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-teams-purple hover:underline"
                    >
                      View in Zoho
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
