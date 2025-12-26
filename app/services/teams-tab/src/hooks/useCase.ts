/**
 * Hook for fetching single case detail
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import type { Case } from '@/types';

interface UseCaseOptions {
  caseId: string | null;
  refetchInterval?: number;
}

interface UseCaseReturn {
  caseData: Case | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCase(options: UseCaseOptions): UseCaseReturn {
  const { caseId, refetchInterval } = options;

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => apiClient.getCase(caseId!),
    enabled: !!caseId,
    refetchInterval,
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    caseData: data,
    isLoading,
    error: error instanceof Error ? error : null,
    refetch,
  };
}
