/**
 * Debt API service
 */
import { apiClient } from './axios';
import { COUNTIES_ENDPOINTS, DEBT_ENDPOINTS, buildUrlWithParams } from './endpoints';
import { ApiResponse, DebtDataResponse } from './types';

// Get debt data for a county
export const getCountyDebtData = async (countyId: string): Promise<DebtDataResponse> => {
  const response = await apiClient.get<ApiResponse<DebtDataResponse>>(
    COUNTIES_ENDPOINTS.DEBT(countyId)
  );
  return response.data.data;
};

// Get national debt overview
export const getNationalDebtOverview = async (): Promise<any> => {
  const response = await apiClient.get<any>(DEBT_ENDPOINTS.NATIONAL);
  return response.data;
};

// Get debt breakdown by category
export const getDebtBreakdown = async (countyId?: string): Promise<any> => {
  const endpoint = countyId
    ? DEBT_ENDPOINTS.BREAKDOWN_BY_COUNTY(countyId)
    : DEBT_ENDPOINTS.BREAKDOWN;
  const response = await apiClient.get<ApiResponse<any>>(endpoint);
  return response.data.data;
};

// Get debt timeline data
export const getDebtTimeline = async (countyId?: string, years?: number): Promise<any> => {
  const queryParams: Record<string, any> = {};
  if (years) queryParams.years = years;

  const baseEndpoint = countyId
    ? COUNTIES_ENDPOINTS.DEBT_TIMELINE(countyId)
    : DEBT_ENDPOINTS.TIMELINE;
  const url = buildUrlWithParams(baseEndpoint, queryParams);

  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};

// Get debt comparison between counties
export const getDebtComparison = async (countyIds: string[]): Promise<any> => {
  const queryParams = { county_ids: countyIds };
  const url = buildUrlWithParams(DEBT_ENDPOINTS.COMPARISON, queryParams);

  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};

// Get top loans/debt sources
export const getTopLoans = async (limit: number = 10): Promise<any> => {
  const url = buildUrlWithParams(DEBT_ENDPOINTS.TOP_LOANS, { limit });
  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};

// Get debt sustainability indicators
export const getDebtSustainabilityIndicators = async (countyId?: string): Promise<any> => {
  const endpoint = countyId
    ? COUNTIES_ENDPOINTS.DEBT_SUSTAINABILITY(countyId)
    : DEBT_ENDPOINTS.SUSTAINABILITY;
  const response = await apiClient.get<ApiResponse<any>>(endpoint);
  return response.data.data;
};

// Get debt risk assessment
export const getDebtRiskAssessment = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(DEBT_ENDPOINTS.RISK_ASSESSMENT);
  return response.data.data;
};
