/**
 * Hook for fetching case list
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import type { CaseFilters, CaseListItem } from '@/types';

interface UseCasesOptions {
  filters?: CaseFilters;
  refetchInterval?: number;
}

interface UseCasesReturn {
  cases: CaseListItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCases(options: UseCasesOptions = {}): UseCasesReturn {
  const { filters, refetchInterval } = options;

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['cases', filters],
    queryFn: () => apiClient.listCases(filters),
    refetchInterval,
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    cases: data || [],
    isLoading,
    error: error instanceof Error ? error : null,
    refetch,
  };
}
