/**
 * National statistics API service
 */
import { apiClient } from './axios';
import { STATISTICS_ENDPOINTS, buildUrlWithParams } from './endpoints';
import { ApiResponse, NationalStatsResponse } from './types';

// Get dashboard overview statistics
export const getDashboardStats = async (): Promise<NationalStatsResponse> => {
  const response = await apiClient.get<ApiResponse<NationalStatsResponse>>(
    STATISTICS_ENDPOINTS.DASHBOARD
  );
  return response.data.data;
};

// Get national overview statistics
export const getNationalOverview = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(STATISTICS_ENDPOINTS.OVERVIEW);
  return response.data.data;
};

// Get performance rankings
export const getPerformanceRankings = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(STATISTICS_ENDPOINTS.RANKINGS);
  return response.data.data;
};

// Get sector performance analysis
export const getSectorPerformance = async (sector?: string): Promise<any> => {
  const queryParams: Record<string, any> = {};
  if (sector) queryParams.sector = sector;

  const url = buildUrlWithParams(STATISTICS_ENDPOINTS.SECTOR_PERFORMANCE, queryParams);
  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};

// Get regional analysis
export const getRegionalAnalysis = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(STATISTICS_ENDPOINTS.REGIONAL_ANALYSIS);
  return response.data.data;
};

// Get trends over time
export const getNationalTrends = async (years?: number): Promise<any> => {
  const queryParams: Record<string, any> = {};
  if (years) queryParams.years = years;

  const url = buildUrlWithParams(STATISTICS_ENDPOINTS.TRENDS, queryParams);
  const response = await apiClient.get<ApiResponse<any>>(url);
  return response.data.data;
};

// Get audit compliance statistics
export const getAuditComplianceStats = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(STATISTICS_ENDPOINTS.AUDIT_COMPLIANCE);
  return response.data.data;
};

// Get financial health indicators
export const getFinancialHealthIndicators = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(STATISTICS_ENDPOINTS.FINANCIAL_HEALTH);
  return response.data.data;
};

// Get transparency index
export const getTransparencyIndex = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(STATISTICS_ENDPOINTS.TRANSPARENCY_INDEX);
  return response.data.data;
};

// Get alerts and notifications
export const getAlertsAndNotifications = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(STATISTICS_ENDPOINTS.ALERTS);
  return response.data.data;
};
