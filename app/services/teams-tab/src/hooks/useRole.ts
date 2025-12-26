/**
 * Hook for user roles and permissions
 */

import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth-service';
import type { AppRole, UserProfile } from '@/types';

interface UseRoleReturn {
  profile: UserProfile | undefined;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  isSalesUser: boolean;
  isSalesManager: boolean;
  isOpsAuditor: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useRole(): UseRoleReturn {
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => authService.getUserProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const roles = profile?.roles || [];

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  return {
    profile,
    roles,
    hasRole,
    isSalesUser: hasRole('SalesUser'),
    isSalesManager: hasRole('SalesManager'),
    isOpsAuditor: hasRole('OpsAuditor'),
    isLoading,
    error: error instanceof Error ? error : null,
  };
}
