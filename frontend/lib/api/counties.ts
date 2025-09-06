/**
 * Counties API service
 */
import { County } from '@/types';
import { apiClient } from './axios';
import { COUNTIES_ENDPOINTS, buildUrlWithParams } from './endpoints';
import { ApiResponse, CountyFilters, CountyResponse, PaginatedResponse } from './types';

// Backend county response type
interface BackendCountyResponse {
  id: string;
  name: string;
  population: number;
  budget_2025: number;
  financial_health_score: number;
  audit_rating: string;
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

  // Generate default coordinates (you might want to have a proper mapping)
  const defaultCoordinates: [number, number] = [36.8219, -1.2921]; // Nairobi as default

  return {
    id: backendCounty.id,
    name: backendCounty.name,
    code: backendCounty.name.substring(0, 3).toUpperCase(), // Generate code from name
    coordinates: defaultCoordinates,
    budget: backendCounty.budget_2025,
    debt: backendCounty.budget_2025 * 0.3, // Estimate debt as 30% of budget
    population: backendCounty.population,
    auditStatus: auditStatusMap[backendCounty.audit_rating] || 'pending',
    lastAuditDate: new Date().toISOString().split('T')[0], // Current date as default
    gdp: backendCounty.budget_2025 * 2, // Estimate GDP as 2x budget
    moneyReceived: backendCounty.budget_2025 * 0.8, // 80% of budget as transfers
    budgetUtilization: backendCounty.financial_health_score, // Use health score as utilization
    revenueCollection: backendCounty.budget_2025 * 0.4, // 40% local revenue
    pendingBills: backendCounty.budget_2025 * 0.1, // 10% pending bills
    developmentBudget: backendCounty.budget_2025 * 0.4, // 40% development
    recurrentBudget: backendCounty.budget_2025 * 0.6, // 60% recurrent
    auditIssues: [], // Empty for now
    totalBudget: backendCounty.budget_2025,
    totalDebt: backendCounty.budget_2025 * 0.3,
    education: backendCounty.budget_2025 * 0.3, // 30% education
    health: backendCounty.budget_2025 * 0.25, // 25% health
    infrastructure: backendCounty.budget_2025 * 0.2, // 20% infrastructure
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
