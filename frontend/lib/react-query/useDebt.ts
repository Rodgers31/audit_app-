/**
 * Custom React Query hooks for debt data
 */
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import {
  getCountyDebtData,
  getDebtBreakdown,
  getDebtComparison,
  getDebtRiskAssessment,
  getDebtSustainabilityIndicators,
  getDebtTimeline,
  getNationalDebtOverview,
  getTopLoans,
} from '../api/debt';
import { DebtDataResponse } from '../api/types';

// Query keys for debt
const QUERY_KEYS = {
  debt: ['debt'] as const,
  countyDebt: (countyId: string) => ['debt', 'county', countyId] as const,
  nationalOverview: ['debt', 'national'] as const,
  breakdown: (countyId?: string) => ['debt', 'breakdown', countyId] as const,
  timeline: (countyId?: string, years?: number) => ['debt', 'timeline', countyId, years] as const,
  comparison: (countyIds: string[]) => ['debt', 'comparison', countyIds] as const,
  topLoans: (limit: number) => ['debt', 'top-loans', limit] as const,
  sustainability: (countyId?: string) => ['debt', 'sustainability', countyId] as const,
  riskAssessment: ['debt', 'risk-assessment'] as const,
};

// Get debt data for a county
export const useCountyDebtData = (
  countyId: string,
  options?: Omit<UseQueryOptions<DebtDataResponse>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.countyDebt(countyId),
    queryFn: () => getCountyDebtData(countyId),
    enabled: !!countyId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

// Get national debt overview
export const useNationalDebtOverview = (
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.nationalOverview,
    queryFn: getNationalDebtOverview,
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Get debt breakdown by category
export const useDebtBreakdown = (
  countyId?: string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.breakdown(countyId),
    queryFn: () => getDebtBreakdown(countyId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

// Get debt timeline data
export const useDebtTimeline = (
  countyId?: string,
  years?: number,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.timeline(countyId, years),
    queryFn: () => getDebtTimeline(countyId, years),
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Get debt comparison between counties
export const useDebtComparison = (
  countyIds: string[],
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.comparison(countyIds),
    queryFn: () => getDebtComparison(countyIds),
    enabled: countyIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

// Get top loans/debt sources
export const useTopLoans = (
  limit: number = 10,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.topLoans(limit),
    queryFn: () => getTopLoans(limit),
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Get debt sustainability indicators
export const useDebtSustainabilityIndicators = (
  countyId?: string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.sustainability(countyId),
    queryFn: () => getDebtSustainabilityIndicators(countyId),
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Get debt risk assessment
export const useDebtRiskAssessment = (
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.riskAssessment,
    queryFn: getDebtRiskAssessment,
    staleTime: 20 * 60 * 1000, // 20 minutes
    ...options,
  });
};
