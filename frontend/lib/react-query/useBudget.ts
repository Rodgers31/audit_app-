/**
 * Custom React Query hooks for budget data
 */
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import {
  getBudgetAllocation,
  getBudgetComparison,
  getBudgetTrends,
  getBudgetUtilizationSummary,
  getNationalBudgetSummary,
  getSectorBudgetAllocation,
} from '../api/budget';
import { BudgetAllocationResponse } from '../api/types';

// Query keys for budget
const QUERY_KEYS = {
  budget: ['budget'] as const,
  allocation: (countyId: string, fiscalYear?: string) =>
    ['budget', 'allocation', countyId, fiscalYear] as const,
  comparison: (countyIds: string[], fiscalYear?: string) =>
    ['budget', 'comparison', countyIds, fiscalYear] as const,
  nationalSummary: (fiscalYear?: string) => ['budget', 'national', fiscalYear] as const,
  trends: (countyId: string, years?: number) => ['budget', 'trends', countyId, years] as const,
  sectorAllocation: (sector: string, fiscalYear?: string) =>
    ['budget', 'sector', sector, fiscalYear] as const,
  utilizationSummary: (fiscalYear?: string) => ['budget', 'utilization', fiscalYear] as const,
};

// Get budget allocation for a county
export const useBudgetAllocation = (
  countyId: string,
  fiscalYear?: string,
  options?: Omit<UseQueryOptions<BudgetAllocationResponse>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.allocation(countyId, fiscalYear),
    queryFn: () => getBudgetAllocation(countyId, fiscalYear),
    enabled: !!countyId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

// Get budget comparison between counties
export const useBudgetComparison = (
  countyIds: string[],
  fiscalYear?: string,
  options?: Omit<UseQueryOptions<BudgetAllocationResponse[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.comparison(countyIds, fiscalYear),
    queryFn: () => getBudgetComparison(countyIds, fiscalYear),
    enabled: countyIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

// Get national budget summary
export const useNationalBudgetSummary = (
  fiscalYear?: string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.nationalSummary(fiscalYear),
    queryFn: () => getNationalBudgetSummary(fiscalYear),
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Get budget trends for a county
export const useBudgetTrends = (
  countyId: string,
  years?: number,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.trends(countyId, years),
    queryFn: () => getBudgetTrends(countyId, years),
    enabled: !!countyId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Get sector-wise budget allocation
export const useSectorBudgetAllocation = (
  sector: string,
  fiscalYear?: string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.sectorAllocation(sector, fiscalYear),
    queryFn: () => getSectorBudgetAllocation(sector, fiscalYear),
    enabled: !!sector,
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Get budget utilization summary
export const useBudgetUtilizationSummary = (
  fiscalYear?: string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.utilizationSummary(fiscalYear),
    queryFn: () => getBudgetUtilizationSummary(fiscalYear),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};
