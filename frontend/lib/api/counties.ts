/**
 * Counties API service
 */
import { County } from '@/types';
import { apiClient } from './axios';
import { COUNTIES_ENDPOINTS, buildUrlWithParams } from './endpoints';
import { ApiResponse, CountyFilters, CountyResponse, PaginatedResponse } from './types';

// Backend county response type — matches enriched backend endpoint
interface BackendCountyResponse {
  id: string;
  name: string;
  population: number;
  budget_2025: number;
  financial_health_score: number;
  audit_rating: string;
  // Enriched fields from DB aggregation
  coordinates?: [number, number];
  total_allocated?: number;
  total_spent?: number;
  budget_utilization?: number;
  development_budget?: number;
  recurrent_budget?: number;
  total_debt?: number;
  pending_bills?: number;
  revenue_2024?: number;
  gcp_contribution?: number;
  sector_breakdown?: Record<string, number>;
  audit_issues?: Array<{
    id: number;
    severity: string;
    finding_summary: string;
  }>;
  audit_issue_count?: number;
  data_freshness?: string;
}

// Transform backend county data to frontend County type
const transformCountyData = (backendCounty: BackendCountyResponse): County => {
  // Map audit rating to audit status
  const auditStatusMap: Record<string, County['auditStatus']> = {
    'A+': 'clean',
    A: 'clean',
    'A-': 'clean',
    'B+': 'qualified',
    B: 'qualified',
    'B-': 'qualified',
    C: 'adverse',
    D: 'disclaimer',
    F: 'disclaimer',
  };

  const coordinates: [number, number] = backendCounty.coordinates || [36.8219, -1.2921];

  // Use real backend-computed values — no fabricated multipliers
  const budget = backendCounty.total_allocated || backendCounty.budget_2025 || 0;
  const debt = backendCounty.total_debt || 0;
  const sectors = backendCounty.sector_breakdown || {};

  return {
    id: backendCounty.id,
    name: backendCounty.name,
    code: backendCounty.name.substring(0, 3).toUpperCase(),
    coordinates,
    // Backend canonical fields
    budget_2025: backendCounty.budget_2025,
    financial_health_score: backendCounty.financial_health_score,
    audit_rating: backendCounty.audit_rating,
    budget,
    debt,
    population: backendCounty.population,
    auditStatus: auditStatusMap[backendCounty.audit_rating] || 'pending',
    lastAuditDate: backendCounty.data_freshness || new Date().toISOString().split('T')[0],
    gdp: backendCounty.gcp_contribution || 0,
    moneyReceived: backendCounty.total_spent || 0,
    budgetUtilization:
      backendCounty.budget_utilization || backendCounty.financial_health_score || 0,
    revenueCollection: backendCounty.revenue_2024 || 0,
    pendingBills: backendCounty.pending_bills || 0,
    developmentBudget: backendCounty.development_budget || 0,
    recurrentBudget: backendCounty.recurrent_budget || 0,
    auditIssues: (backendCounty.audit_issues || []).map((a) => ({
      id: String(a.id),
      type: 'financial' as const,
      severity: (a.severity || 'medium') as 'low' | 'medium' | 'high' | 'critical',
      description: a.finding_summary || '',
      status: 'open' as const,
    })),
    totalBudget: budget,
    totalDebt: debt,
    education: sectors['Education'] || sectors['education'] || 0,
    health: sectors['Health'] || sectors['health'] || 0,
    infrastructure: sectors['Infrastructure'] || sectors['infrastructure'] || 0,
  };
};

// Get all counties with optional filtering
export const getCounties = async (filters?: CountyFilters): Promise<County[]> => {
  const queryParams: Record<string, any> = {};

  if (filters?.search) queryParams.search = filters.search;
  if (filters?.auditStatus?.length) queryParams.audit_status = filters.auditStatus;
  if (filters?.debtLevel) queryParams.debt_level = filters.debtLevel;
  if (filters?.budgetRange) {
    queryParams.budget_min = filters.budgetRange[0];
    queryParams.budget_max = filters.budgetRange[1];
  }
  if (filters?.page) queryParams.page = filters.page;
  if (filters?.limit) queryParams.limit = filters.limit;

  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.LIST, queryParams);
  const response = await apiClient.get<BackendCountyResponse[]>(url);

  // Transform backend data to frontend County type
  return response.data.map(transformCountyData);
};

// Get single county by ID
export const getCounty = async (id: string): Promise<County> => {
  const response = await apiClient.get<BackendCountyResponse>(COUNTIES_ENDPOINTS.GET_BY_ID(id));
  return transformCountyData(response.data);
};

// Get county by code (e.g., 'NBI' for Nairobi)
export const getCountyByCode = async (code: string): Promise<CountyResponse> => {
  const response = await apiClient.get<ApiResponse<CountyResponse>>(
    COUNTIES_ENDPOINTS.GET_BY_CODE(code)
  );
  return response.data.data;
};

// Get counties with pagination
export const getCountiesPaginated = async (
  page: number = 1,
  limit: number = 20,
  filters?: Omit<CountyFilters, 'page' | 'limit'>
): Promise<PaginatedResponse<CountyResponse>> => {
  const queryParams: Record<string, any> = {
    page,
    limit,
  };

  if (filters?.search) queryParams.search = filters.search;
  if (filters?.auditStatus?.length) queryParams.audit_status = filters.auditStatus;
  if (filters?.debtLevel) queryParams.debt_level = filters.debtLevel;
  if (filters?.budgetRange) {
    queryParams.budget_min = filters.budgetRange[0];
    queryParams.budget_max = filters.budgetRange[1];
  }

  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.PAGINATED, queryParams);

  const response = await apiClient.get<PaginatedResponse<CountyResponse>>(url);
  return response.data;
};

// Get county financial summary
export const getCountyFinancialSummary = async (id: string): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(COUNTIES_ENDPOINTS.FINANCIAL_SUMMARY(id));
  return response.data.data;
};

// Search counties by name
export const searchCounties = async (query: string): Promise<CountyResponse[]> => {
  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.SEARCH, { q: query });
  const response = await apiClient.get<ApiResponse<CountyResponse[]>>(url);
  return response.data.data;
};

// Get top performing counties
export const getTopPerformingCounties = async (limit: number = 10): Promise<CountyResponse[]> => {
  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.TOP_PERFORMING, { limit });
  const response = await apiClient.get<ApiResponse<CountyResponse[]>>(url);
  return response.data.data;
};

// Get counties with issues/flags
export const getFlaggedCounties = async (): Promise<CountyResponse[]> => {
  const response = await apiClient.get<ApiResponse<CountyResponse[]>>(COUNTIES_ENDPOINTS.FLAGGED);
  return response.data.data;
};
