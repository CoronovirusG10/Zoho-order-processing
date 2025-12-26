/**
 * Hook for Teams authentication and context
 */

import { useState, useEffect } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';
import { authService } from '@/services/auth-service';
import type { TeamsContext } from '@/types';

interface UseTeamsAuthReturn {
  isInitialized: boolean;
  context: TeamsContext | null;
  theme: 'default' | 'dark' | 'contrast';
  error: Error | null;
}

export function useTeamsAuth(): UseTeamsAuthReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [context, setContext] = useState<TeamsContext | null>(null);
  const [theme, setTheme] = useState<'default' | 'dark' | 'contrast'>('default');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initTeams = async () => {
      try {
        // Initialize Teams SDK
        await microsoftTeams.app.initialize();

        // Get context
        const ctx = await microsoftTeams.app.getContext();

        const teamsContext: TeamsContext = {
          theme: ctx.app.theme as 'default' | 'dark' | 'contrast',
          locale: ctx.app.locale,
          userObjectId: ctx.user?.id || '',
          userPrincipalName: ctx.user?.userPrincipalName || '',
          tenantId: ctx.user?.tenant?.id || '',
        };

        setContext(teamsContext);
        setTheme(teamsContext.theme);

        // Register theme change handler
        microsoftTeams.app.registerOnThemeChangeHandler((newTheme) => {
          setTheme(newTheme as 'default' | 'dark' | 'contrast');

          // Update document class for Tailwind dark mode
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        });

        // Set initial theme class
        if (teamsContext.theme === 'dark') {
          document.documentElement.classList.add('dark');
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize Teams:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize Teams'));
      }
    };

    initTeams();

    return () => {
      authService.signOut();
    };
  }, []);

  return {
    isInitialized,
    context,
    theme,
    error,
  };
}
