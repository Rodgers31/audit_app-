/**
 * Audits API service
 */
import { apiClient } from './axios';
import { AUDITS_ENDPOINTS, COUNTIES_ENDPOINTS, buildUrlWithParams } from './endpoints';
import {
  ApiResponse,
  AuditFilters,
  AuditReportResponse,
  CountyAuditsEnriched,
  PaginatedResponse,
} from './types';

// Get all audit reports with optional filtering
export const getAuditReports = async (filters?: AuditFilters): Promise<AuditReportResponse[]> => {
  const queryParams: Record<string, any> = {};

  if (filters?.countyId) queryParams.county_id = filters.countyId;
  if (filters?.fiscalYear) queryParams.fiscal_year = filters.fiscalYear;
  if (filters?.auditStatus?.length) queryParams.audit_status = filters.auditStatus;
  if (filters?.concernLevel?.length) queryParams.concern_level = filters.concernLevel;
  if (filters?.page) queryParams.page = filters.page;
  if (filters?.limit) queryParams.limit = filters.limit;

  const url = buildUrlWithParams(AUDITS_ENDPOINTS.LIST, queryParams);
  const response = await apiClient.get<ApiResponse<AuditReportResponse[]>>(url);
  return response.data.data;
};

// Get single audit report by ID
export const getAuditReport = async (id: string): Promise<AuditReportResponse> => {
  const response = await apiClient.get<ApiResponse<AuditReportResponse>>(
    AUDITS_ENDPOINTS.GET_BY_ID(id)
  );
  return response.data.data;
};

// Get audit reports for a specific county
export const getCountyAuditReports = async (
  countyId: string,
  fiscalYear?: string
): Promise<AuditReportResponse[]> => {
  const queryParams: Record<string, any> = {};
  if (fiscalYear) queryParams.fiscal_year = fiscalYear;

  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.AUDITS(countyId), queryParams);
  const response = await apiClient.get<ApiResponse<AuditReportResponse[]>>(url);
  return response.data.data;
};

// Get latest audit report for a county
export const getLatestCountyAudit = async (countyId: string): Promise<AuditReportResponse> => {
  const response = await apiClient.get<ApiResponse<AuditReportResponse>>(
    COUNTIES_ENDPOINTS.LATEST_AUDIT(countyId)
  );
  return response.data.data;
};

// Get enriched county audits aggregation for modal/report
export const getCountyAuditsEnriched = async (countyId: string): Promise<CountyAuditsEnriched> => {
  const response = await apiClient.get<CountyAuditsEnriched>(COUNTIES_ENDPOINTS.AUDITS(countyId));
  return response.data;
};

// List county audit findings with filters/pagination and provenance
export interface CountyAuditListItem {
  id: string | number;
  description?: string;
  severity?: string;
  status?: string;
  category?: string;
  amountLabel?: string;
  fiscal_year?: string;
  source: { title?: string; url?: string; page?: number | string; table_index?: number };
}

export interface CountyAuditListResponse {
  total: number;
  page: number;
  limit: number;
  items: CountyAuditListItem[];
}

export const getCountyAuditList = async (
  countyId: string,
  params?: { page?: number; limit?: number; year?: string; status?: string; severity?: string }
): Promise<CountyAuditListResponse> => {
  const qp: Record<string, any> = {};
  if (params?.page) qp.page = params.page;
  if (params?.limit) qp.limit = params.limit;
  if (params?.year) qp.year = params.year;
  if (params?.status) qp.status = params.status;
  if (params?.severity) qp.severity = params.severity;
  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.AUDITS_LIST(countyId), qp);
  const { data } = await apiClient.get<CountyAuditListResponse>(url);
  return data;
};

// Get audit reports with pagination
export const getAuditReportsPaginated = async (
  page: number = 1,
  limit: number = 20,
  filters?: Omit<AuditFilters, 'page' | 'limit'>
): Promise<PaginatedResponse<AuditReportResponse>> => {
  const queryParams: Record<string, any> = {
    page,
    limit,
  };

  if (filters?.countyId) queryParams.county_id = filters.countyId;
  if (filters?.fiscalYear) queryParams.fiscal_year = filters.fiscalYear;
  if (filters?.auditStatus?.length) queryParams.audit_status = filters.auditStatus;
  if (filters?.concernLevel?.length) queryParams.concern_level = filters.concernLevel;

  const url = buildUrlWithParams(AUDITS_ENDPOINTS.PAGINATED, queryParams);
  const response = await apiClient.get<PaginatedResponse<AuditReportResponse>>(url);
  return response.data;
};

// Get audit statistics
export const getAuditStatistics = async (): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(AUDITS_ENDPOINTS.STATISTICS);
  return response.data.data;
};

// Federal / national government audit findings
export interface FederalAuditFinding {
  id: number;
  entity_name: string;
  entity_type: string;
  finding: string;
  severity: string;
  recommended_action: string;
  amount_involved: string;
  amount_numeric: number;
  status: string;
  category: string;
  query_type: string;
  report_section: string;
  date_raised: string;
  date: string | null;
}

export interface FederalAuditResponse {
  report_title: string;
  auditor_general: string;
  fiscal_year: string;
  report_date: string;
  opinion_type: string;
  total_findings: number;
  total_amount_questioned: number;
  total_amount_questioned_label: string;
  by_severity: Record<string, number>;
  basis_for_qualification: string[];
  emphasis_of_matter: string[];
  key_statistics: {
    total_ministries_audited: number;
    total_findings: number;
    critical_findings: number;
    significant_findings: number;
    minor_findings: number;
    total_amount_flagged_kes: number;
    response_rate_to_previous_queries: string;
    recurring_issues_from_prior_year: number;
  };
  findings: FederalAuditFinding[];
  top_ministries: { ministry: string; finding_count: number }[];
  last_updated: string;
}

export const getFederalAudits = async (): Promise<FederalAuditResponse> => {
  const response = await apiClient.get<FederalAuditResponse>(AUDITS_ENDPOINTS.FEDERAL);
  return response.data;
};

// Get fiscal years with available audit data
export const getAvailableFiscalYears = async (): Promise<string[]> => {
  const response = await apiClient.get<ApiResponse<string[]>>(AUDITS_ENDPOINTS.FISCAL_YEARS);
  return response.data.data;
};
