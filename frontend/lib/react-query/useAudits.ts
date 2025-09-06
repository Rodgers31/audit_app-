/**
 * Custom React Query hooks for audit data
 */
import { useInfiniteQuery, useQuery, UseQueryOptions } from '@tanstack/react-query';
import {
  getAuditReport,
  getAuditReports,
  getAuditReportsPaginated,
  getAuditStatistics,
  getAvailableFiscalYears,
  getCountyAuditList,
  getCountyAuditReports,
  getCountyAuditsEnriched,
  getLatestCountyAudit,
} from '../api/audits';
import { AuditFilters, AuditReportResponse } from '../api/types';

// Query keys for audits
const QUERY_KEYS = {
  audits: ['audits'] as const,
  audit: (id: string) => ['audits', id] as const,
  auditsFiltered: (filters?: AuditFilters) => ['audits', 'filtered', filters] as const,
  countyAudits: (countyId: string, fiscalYear?: string) =>
    ['audits', 'county', countyId, fiscalYear] as const,
  latestCountyAudit: (countyId: string) => ['audits', 'county', countyId, 'latest'] as const,
  countyAuditsEnriched: (countyId: string) => ['audits', 'county', countyId, 'enriched'] as const,
  countyAuditsList: (
    countyId: string,
    params?: { page?: number; limit?: number; year?: string; status?: string; severity?: string }
  ) => ['audits', 'county', countyId, 'list', params] as const,
  statistics: ['audits', 'statistics'] as const,
  fiscalYears: ['audits', 'fiscal-years'] as const,
};

// Get all audit reports
export const useAuditReports = (
  filters?: AuditFilters,
  options?: Omit<UseQueryOptions<AuditReportResponse[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.auditsFiltered(filters),
    queryFn: () => getAuditReports(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Get single audit report by ID
export const useAuditReport = (
  id: string,
  options?: Omit<UseQueryOptions<AuditReportResponse>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.audit(id),
    queryFn: () => getAuditReport(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

// Get audit reports for a specific county
export const useCountyAuditReports = (
  countyId: string,
  fiscalYear?: string,
  options?: Omit<UseQueryOptions<AuditReportResponse[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.countyAudits(countyId, fiscalYear),
    queryFn: () => getCountyAuditReports(countyId, fiscalYear),
    enabled: !!countyId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

// Get latest audit report for a county
export const useLatestCountyAudit = (
  countyId: string,
  options?: Omit<UseQueryOptions<AuditReportResponse>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.latestCountyAudit(countyId),
    queryFn: () => getLatestCountyAudit(countyId),
    enabled: !!countyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Infinite query for paginated audit reports
export const useAuditReportsInfinite = (
  limit: number = 20,
  filters?: Omit<AuditFilters, 'page' | 'limit'>
) => {
  return useInfiniteQuery({
    queryKey: ['audits', 'infinite', limit, filters],
    queryFn: ({ pageParam = 1 }) => getAuditReportsPaginated(pageParam, limit, filters),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
  });
};

// Get audit statistics
export const useAuditStatistics = (
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.statistics,
    queryFn: getAuditStatistics,
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Get available fiscal years
export const useAvailableFiscalYears = (
  options?: Omit<UseQueryOptions<string[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.fiscalYears,
    queryFn: getAvailableFiscalYears,
    staleTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
};

// Get enriched county audits aggregation for a county
export const useCountyAuditsEnriched = (
  countyId: string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.countyAuditsEnriched(countyId),
    queryFn: () => getCountyAuditsEnriched(countyId),
    enabled: !!countyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// New: list audits with provenance for a county
export const useCountyAuditList = (
  countyId: string,
  params?: { page?: number; limit?: number; year?: string; status?: string; severity?: string },
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: QUERY_KEYS.countyAuditsList(countyId, params),
    queryFn: () => getCountyAuditList(countyId, params),
    enabled: !!countyId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};
