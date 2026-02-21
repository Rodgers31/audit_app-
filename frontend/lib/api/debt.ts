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

// Get county debt timeline data
export const getCountyDebtTimeline = async (countyId?: string, years?: number): Promise<any> => {
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

// Get individual national government loans
export interface NationalLoan {
  lender: string;
  lender_type: string;
  principal: string;
  outstanding: string;
  interest_rate: string;
  issue_date: string;
  maturity_date: string;
  status: string;
  annual_service_cost: number;
  outstanding_numeric: number;
  principal_numeric: number;
}

export interface NationalLoansResponse {
  loans: NationalLoan[];
  total_loans: number;
  total_outstanding: number;
  total_annual_service_cost: number;
  source: string;
  source_url: string;
}

export const getNationalLoans = async (): Promise<NationalLoansResponse> => {
  const response = await apiClient.get<NationalLoansResponse>(DEBT_ENDPOINTS.LOANS);
  return response.data;
};

// Get historical debt timeline (year-by-year external/domestic breakdown)
export interface DebtTimelineEntry {
  year: number;
  external: number;
  domestic: number;
  total: number;
  gdp: number;
  gdp_ratio: number;
}

export interface DebtTimelineResponse {
  status: string;
  data_source: string;
  last_updated: string;
  source: string;
  years: number;
  timeline: DebtTimelineEntry[];
}

export const getDebtTimeline = async (): Promise<DebtTimelineResponse> => {
  const response = await apiClient.get<DebtTimelineResponse>(DEBT_ENDPOINTS.TIMELINE);
  return response.data;
};

// Pending bills types and API
export interface PendingBillEntry {
  entity_name: string;
  entity_type: string;
  lender: string;
  total_pending: number;
  eligible_pending: number | null;
  ineligible_pending: number | null;
  fiscal_year: string;
  category: string;
  notes: string | null;
}

export interface PendingBillsSummary {
  total_pending: number;
  national_total: number;
  county_total: number;
  record_count: number;
  as_at_date?: string;
}

export interface PendingBillsResponse {
  status: string;
  data_source: string;
  last_updated?: string;
  pending_bills: PendingBillEntry[];
  summary: PendingBillsSummary;
  source: string;
  source_url: string;
  currency: string;
  explanation: string;
  how_to_populate?: {
    option_1: string;
    option_2: string;
    option_3: string;
    data_sources: string[];
  };
}

export const getPendingBills = async (): Promise<PendingBillsResponse> => {
  const response = await apiClient.get<PendingBillsResponse>(DEBT_ENDPOINTS.PENDING_BILLS);
  return response.data;
};
