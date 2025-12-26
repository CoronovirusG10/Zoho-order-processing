/**
 * Case detail component
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { apiClient } from '@/services/api-client';
import { StatusBadge } from './StatusBadge';
import { OrderPreview } from './OrderPreview';
import { IssuesList } from './IssuesList';
import { AuditTimeline } from './AuditTimeline';
import { LoadingSpinner } from './LoadingSpinner';
import { TeamsDeepLink } from './TeamsDeepLink';
import { useCase } from '@/hooks/useCase';

interface CaseDetailProps {
  caseId: string;
  onBack: () => void;
}

export function CaseDetail({ caseId, onBack }: CaseDetailProps) {
  const { caseData, isLoading, error, refetch } = useCase({ caseId });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  const handleDownload = async () => {
    if (!caseData) return;

    setIsDownloading(true);
    try {
      const { sasUrl } = await apiClient.getDownloadSasUrl(caseId);

      // Open download in new tab
      window.open(sasUrl, '_blank');
    } catch (err) {
      console.error('Failed to download audit bundle:', err);
      alert('Failed to download audit bundle. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!caseData) return;

    if (!confirm('Are you sure you want to create a draft sales order in Zoho?')) {
      return;
    }

    setIsCreatingDraft(true);
    try {
      await apiClient.createDraft(caseId);
      await refetch();
      alert('Draft sales order created successfully!');
    } catch (err) {
      console.error('Failed to create draft:', err);
      alert(`Failed to create draft: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">
            Failed to load case: {error.message}
          </p>
        </div>
        <button
          onClick={onBack}
          className="mt-4 text-sm text-teams-purple hover:underline"
        >
          ← Back to cases
        </button>
      </div>
    );
  }

  if (!caseData) {
    return null;
  }

  const canCreateDraft = caseData.status === 'ready' && !caseData.zohoSalesOrderId;
  const hasBlockingIssues = caseData.issues.some((i) => i.severity === 'block');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <button
            onClick={onBack}
            className="mb-2 text-sm text-teams-purple hover:underline"
          >
            ← Back to cases
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Case Details
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {caseData.source.file.originalFileName}
          </p>
        </div>

        <StatusBadge status={caseData.status} />
      </div>

      {/* Metadata */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-teams-dark-surface">
          <p className="text-xs text-gray-500 dark:text-gray-400">Case ID</p>
          <p className="mt-1 font-mono text-sm text-gray-900 dark:text-white">
            {caseData.caseId}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-teams-dark-surface">
          <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
          <p className="mt-1 text-sm text-gray-900 dark:text-white">
            {format(new Date(caseData.createdAt), 'MMM d, yyyy HH:mm')}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-teams-dark-surface">
          <p className="text-xs text-gray-500 dark:text-gray-400">Created By</p>
          <p className="mt-1 text-sm text-gray-900 dark:text-white">
            {caseData.createdBy.displayName}
          </p>
        </div>
      </div>

      {/* Source Chat Deep Link */}
      {caseData.source.teams.chatId && caseData.source.teams.messageId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-100">
                Source Chat
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                This case was created from a file uploaded in Teams
              </p>
            </div>
            <TeamsDeepLink source={caseData.source} />
          </div>
        </div>
      )}

      {/* Zoho Link */}
      {caseData.zohoDeepLink && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
          <p className="mb-2 text-sm font-medium text-purple-900 dark:text-purple-100">
            Draft Sales Order Created
          </p>
          <a
            href={caseData.zohoDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-teams-purple hover:underline"
          >
            View in Zoho Books →
          </a>
          {caseData.zohoSalesOrderNumber && (
            <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
              Order #{caseData.zohoSalesOrderNumber}
            </p>
          )}
        </div>
      )}

      {/* Issues */}
      <IssuesList issues={caseData.issues} />

      {/* Order Preview */}
      <OrderPreview caseData={caseData} />

      {/* Audit Timeline */}
      <AuditTimeline caseId={caseId} />

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          {isDownloading ? 'Downloading...' : 'Download Audit Bundle'}
        </button>

        {canCreateDraft && (
          <button
            onClick={handleCreateDraft}
            disabled={isCreatingDraft || hasBlockingIssues}
            className="rounded-md bg-teams-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            title={hasBlockingIssues ? 'Resolve blocking issues first' : ''}
          >
            {isCreatingDraft ? 'Creating...' : 'Create Draft Sales Order'}
          </button>
        )}
      </div>

      {hasBlockingIssues && canCreateDraft && (
        <p className="text-sm text-red-600 dark:text-red-400">
          ⚠️ Cannot create draft: Resolve blocking issues first.
        </p>
      )}
    </div>
  );
}
