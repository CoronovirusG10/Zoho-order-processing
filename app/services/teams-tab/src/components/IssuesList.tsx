/**
 * Issues list component
 */

import { clsx } from 'clsx';
import type { Issue } from '@/types';

interface IssuesListProps {
  issues: Issue[];
}

const severityConfig = {
  block: {
    label: 'Blocking',
    color: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    icon: '🚫',
  },
  warn: {
    label: 'Warning',
    color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    icon: '⚠️',
  },
  info: {
    label: 'Info',
    color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    icon: 'ℹ️',
  },
};

export function IssuesList({ issues }: IssuesListProps) {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <p className="text-sm text-green-800 dark:text-green-200">
          ✓ No issues found. Ready to create draft.
        </p>
      </div>
    );
  }

  const blockingIssues = issues.filter((i) => i.severity === 'block');
  const warnings = issues.filter((i) => i.severity === 'warn');
  const infos = issues.filter((i) => i.severity === 'info');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Issues ({issues.length})
        </h3>
        {blockingIssues.length > 0 && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
            {blockingIssues.length} blocking
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Blocking Issues */}
        {blockingIssues.map((issue, index) => (
          <IssueCard key={`block-${index}`} issue={issue} />
        ))}

        {/* Warnings */}
        {warnings.map((issue, index) => (
          <IssueCard key={`warn-${index}`} issue={issue} />
        ))}

        {/* Info */}
        {infos.map((issue, index) => (
          <IssueCard key={`info-${index}`} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const config = severityConfig[issue.severity];

  return (
    <div
      className={clsx(
        'rounded-lg border p-4',
        config.color
      )}
      role="alert"
      aria-live={issue.severity === 'block' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        <span className={clsx('text-xl', config.iconColor)} aria-hidden="true">
          {config.icon}
        </span>

        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {config.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {issue.code}
            </span>
          </div>

          <p className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
            {issue.message}
          </p>

          {issue.evidence.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                Evidence:
              </p>
              <div className="space-y-1">
                {issue.evidence.map((ev, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-gray-600 dark:text-gray-400"
                  >
                    {ev.sheet}!{ev.cell}: <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">{ev.raw}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {issue.suggestedFix && (
            <div className="rounded-md bg-white/50 p-2 dark:bg-gray-800/50">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Suggested fix:
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {issue.suggestedFix}
              </p>
            </div>
          )}

          {issue.requiresUserInput && (
            <div className="mt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                → User action required
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
