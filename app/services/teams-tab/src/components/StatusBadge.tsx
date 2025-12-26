/**
 * Status badge component
 */

import type { CaseStatus } from '@/types';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: CaseStatus;
}

const statusConfig: Record<
  CaseStatus,
  { label: string; color: string; icon: string }
> = {
  processing: {
    label: 'Processing',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: '⏳',
  },
  'needs-input': {
    label: 'Needs Input',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: '⚠️',
  },
  ready: {
    label: 'Ready',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: '✓',
  },
  'draft-created': {
    label: 'Draft Created',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    icon: '📄',
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: '✗',
  },
  blocked: {
    label: 'Blocked',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    icon: '🚫',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        config.color
      )}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  );
}
