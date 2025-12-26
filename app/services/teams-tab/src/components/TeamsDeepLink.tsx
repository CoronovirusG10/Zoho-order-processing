/**
 * Teams deep link component for navigating to source chat messages
 * Uses Teams JS SDK to create proper deep links that work cross-tenant
 */

import { useCallback } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';
import type { CaseSource } from '@/types';

interface TeamsDeepLinkProps {
  source: CaseSource;
  className?: string;
}

/**
 * Creates a deep link to the original Teams chat message where the file was uploaded
 */
export function TeamsDeepLink({ source, className }: TeamsDeepLinkProps) {
  const { teams } = source;

  const handleNavigateToChat = useCallback(async () => {
    if (!teams.chatId || !teams.messageId) {
      console.warn('Missing chatId or messageId for deep link');
      return;
    }

    try {
      // Construct the deep link URL for 1:1 chat message
      // Format: https://teams.microsoft.com/l/message/<chatId>/<messageId>?tenantId=<tenantId>
      const deepLinkUrl = buildTeamsChatDeepLink(
        teams.chatId,
        teams.messageId,
        teams.tenantId
      );

      // Use Teams SDK to open the link in Teams
      await microsoftTeams.app.openLink(deepLinkUrl);
    } catch (error) {
      console.error('Failed to navigate to Teams message:', error);
      // Fallback: try to open in a new tab
      const deepLinkUrl = buildTeamsChatDeepLink(
        teams.chatId,
        teams.messageId,
        teams.tenantId
      );
      window.open(deepLinkUrl, '_blank');
    }
  }, [teams]);

  // Don't render if no message reference exists
  if (!teams.chatId || !teams.messageId) {
    return null;
  }

  return (
    <button
      onClick={handleNavigateToChat}
      className={`inline-flex items-center gap-2 rounded-md bg-teams-purple px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-teams-purple focus:ring-offset-2 dark:focus:ring-offset-teams-dark-bg ${className || ''}`}
      aria-label="View original message in Teams chat"
      type="button"
    >
      <TeamsIcon />
      <span>View in Chat</span>
    </button>
  );
}

/**
 * Compact version showing just an icon link
 */
export function TeamsDeepLinkIcon({ source }: TeamsDeepLinkProps) {
  const { teams } = source;

  const handleNavigateToChat = useCallback(async () => {
    if (!teams.chatId || !teams.messageId) return;

    try {
      const deepLinkUrl = buildTeamsChatDeepLink(
        teams.chatId,
        teams.messageId,
        teams.tenantId
      );
      await microsoftTeams.app.openLink(deepLinkUrl);
    } catch (error) {
      console.error('Failed to navigate to Teams message:', error);
      const deepLinkUrl = buildTeamsChatDeepLink(
        teams.chatId,
        teams.messageId,
        teams.tenantId
      );
      window.open(deepLinkUrl, '_blank');
    }
  }, [teams]);

  if (!teams.chatId || !teams.messageId) {
    return null;
  }

  return (
    <button
      onClick={handleNavigateToChat}
      className="inline-flex items-center justify-center rounded p-1 text-teams-purple hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teams-purple dark:hover:bg-gray-700"
      aria-label="View original message in Teams chat"
      title="View original message in Teams"
      type="button"
    >
      <TeamsIcon />
    </button>
  );
}

/**
 * Build a Teams deep link URL for a chat message
 */
function buildTeamsChatDeepLink(
  chatId: string,
  messageId: string,
  tenantId: string
): string {
  // Encode the chat ID which may contain special characters
  const encodedChatId = encodeURIComponent(chatId);
  const encodedMessageId = encodeURIComponent(messageId);

  // Teams deep link format for chat messages
  // Reference: https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-link-workflow
  return `https://teams.microsoft.com/l/message/${encodedChatId}/${encodedMessageId}?tenantId=${tenantId}&context=%7B%22contextType%22%3A%22chat%22%7D`;
}

/**
 * Teams logo icon component (simplified SVG)
 */
function TeamsIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.625 5.625h-3.75v-1.5a1.125 1.125 0 0 0-1.125-1.125h-7.5a1.125 1.125 0 0 0-1.125 1.125v1.5h-3.75A1.125 1.125 0 0 0 2.25 6.75v10.5a1.125 1.125 0 0 0 1.125 1.125h17.25a1.125 1.125 0 0 0 1.125-1.125V6.75a1.125 1.125 0 0 0-1.125-1.125zm-12.75 0v-1.5h8.25v1.5h-8.25zM20.25 17.25H3.75V7.125h16.5v10.125z" />
      <circle cx="8.25" cy="11.25" r="1.5" />
      <circle cx="15.75" cy="11.25" r="1.5" />
      <path d="M8.25 13.5c-1.5 0-2.25.75-2.25 1.5h4.5c0-.75-.75-1.5-2.25-1.5zm7.5 0c-1.5 0-2.25.75-2.25 1.5h4.5c0-.75-.75-1.5-2.25-1.5z" />
    </svg>
  );
}
