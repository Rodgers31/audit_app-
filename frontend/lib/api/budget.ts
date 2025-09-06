/**
 * Budget API service
 */
import { apiClient } from './axios';
import { BUDGET_ENDPOINTS, COUNTIES_ENDPOINTS, buildUrlWithParams } from './endpoints';
import { ApiResponse, BudgetAllocationResponse } from './types';

// Get budget allocation for a county
export const getBudgetAllocation = async (
  countyId: string,
  fiscalYear?: string
): Promise<BudgetAllocationResponse> => {
  const queryParams: Record<string, any> = {};
  if (fiscalYear) queryParams.fiscal_year = fiscalYear;

  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.BUDGET(countyId), queryParams);
  const response = await apiClient.get<ApiResponse<BudgetAllocationResponse>>(url);
  return response.data.data;
};

// Get budget comparison between counties
export const getBudgetComparison = async (
  countyIds: string[],
  fiscalYear?: string
): Promise<BudgetAllocationResponse[]> => {
  const queryParams: Record<string, any> = { county_ids: countyIds };
  if (fiscalYear) queryParams.fiscal_year = fiscalYear;

  const url = buildUrlWithParams(BUDGET_ENDPOINTS.COMPARISON, queryParams);
  const response = await apiClient.get<ApiResponse<BudgetAllocationResponse[]>>(url);
  return response.data.data;
};

// Get national budget summary
export const getNationalBudgetSummary = async (fiscalYear?: string): Promise<any> => {
  const queryParams: Record<string, any> = {};
  if (fiscalYear) queryParams.fiscal_year = fiscalYear;

  const url = buildUrlWithParams(BUDGET_ENDPOINTS.NATIONAL, queryParams);
  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};

// Get budget trends for a county
export const getBudgetTrends = async (countyId: string, years?: number): Promise<any> => {
  const queryParams: Record<string, any> = {};
  if (years) queryParams.years = years;

  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.BUDGET_TRENDS(countyId), queryParams);

  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};

// Get sector-wise budget allocation
export const getSectorBudgetAllocation = async (
  sector: string,
  fiscalYear?: string
): Promise<any> => {
  const queryParams: Record<string, any> = {};
  if (fiscalYear) queryParams.fiscal_year = fiscalYear;

  const url = buildUrlWithParams(BUDGET_ENDPOINTS.SECTORS(sector), queryParams);
  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};

// Get budget utilization summary
export const getBudgetUtilizationSummary = async (fiscalYear?: string): Promise<any> => {
  const queryParams: Record<string, any> = {};
  if (fiscalYear) queryParams.fiscal_year = fiscalYear;

  const url = buildUrlWithParams(BUDGET_ENDPOINTS.UTILIZATION, queryParams);
  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};
