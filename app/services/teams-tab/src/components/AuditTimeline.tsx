/**
 * Audit timeline component
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '@/services/api-client';
import { LoadingSpinner } from './LoadingSpinner';
import type { AuditEvent } from '@/types';

interface AuditTimelineProps {
  caseId: string;
}

const eventTypeConfig: Record<
  AuditEvent['eventType'],
  { label: string; icon: string; color: string }
> = {
  case_created: {
    label: 'Case Created',
    icon: '📝',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  parsing_started: {
    label: 'Parsing Started',
    icon: '⚙️',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
  parsing_completed: {
    label: 'Parsing Completed',
    icon: '✓',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  validation_completed: {
    label: 'Validation Completed',
    icon: '✓',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  user_correction: {
    label: 'User Correction',
    icon: '✏️',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  committee_vote: {
    label: 'Committee Vote',
    icon: '🗳️',
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  },
  draft_created: {
    label: 'Draft Created',
    icon: '📄',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  error: {
    label: 'Error',
    icon: '❌',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
};

export function AuditTimeline({ caseId }: AuditTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ['auditEvents', caseId],
    queryFn: () => apiClient.getAuditEvents(caseId),
    enabled: isExpanded,
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-teams-dark-surface">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Audit Timeline
        </h3>
        <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          {isLoading ? (
            <LoadingSpinner />
          ) : events && events.length > 0 ? (
            <div className="relative space-y-4">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

              {events.map((event) => (
                <AuditEventCard key={event.eventId} event={event} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No audit events found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AuditEventCard({ event }: { event: AuditEvent }) {
  const config = eventTypeConfig[event.eventType];

  return (
    <div className="relative flex gap-4 pl-12">
      {/* Timeline dot */}
      <div className="absolute left-3 top-1 h-3 w-3 rounded-full border-2 border-white bg-teams-purple dark:border-teams-dark-surface" />

      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
            {config.icon} {config.label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm:ss')}
          </span>
        </div>

        <p className="mb-2 text-sm text-gray-900 dark:text-white">
          {event.message}
        </p>

        {event.actor.displayName && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            By: {event.actor.displayName} ({event.actor.type})
          </p>
        )}

        {Object.keys(event.details).length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-teams-purple hover:underline">
              Show details
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
