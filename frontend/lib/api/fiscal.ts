/**
 * Fiscal API service — national budget, revenue, borrowing, debt service data
 */
import { apiClient } from './axios';
import { FISCAL_ENDPOINTS } from './endpoints';

export interface FiscalYearData {
  fiscal_year: string;
  appropriated_budget: number;
  total_revenue: number;
  tax_revenue: number;
  non_tax_revenue: number;
  total_borrowing: number;
  borrowing_pct_of_budget: number;
  debt_service_cost: number;
  debt_service_per_shilling: number;
  debt_ceiling: number;
  actual_debt: number;
  debt_ceiling_usage_pct: number;
  development_spending: number;
  recurrent_spending: number;
  county_allocation: number;
}

export interface FiscalSummaryResponse {
  status: string;
  data_source: string;
  last_updated: string;
  source: string;
  current: FiscalYearData;
  history: FiscalYearData[];
  total_fiscal_years: number;
}

export const getFiscalSummary = async (): Promise<FiscalSummaryResponse> => {
  const response = await apiClient.get<FiscalSummaryResponse>(FISCAL_ENDPOINTS.SUMMARY);
  return response.data;
};
