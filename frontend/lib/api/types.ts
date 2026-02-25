/**
 * API response types and interfaces
 */
import { AuditIssue, County } from '@/types';

// Base API response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  timestamp: string;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  success: boolean;
  message?: string;
}

// Error response
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
}

// County API responses
export interface CountyResponse extends County {
  // Additional fields that might come from API
  lastUpdated?: string;
}

export interface CountiesListResponse {
  counties: CountyResponse[];
  total: number;
}

// Audit API responses
export interface AuditReportResponse {
  id: string;
  countyId: string;
  countyName: string;
  fiscalYear: string;
  auditStatus: string;
  auditOpinion: string;
  auditDate: string;
  findings: AuditIssue[];
  summary: {
    headline: string;
    summary: string;
    keyFindings: string[];
    concern_level: string;
  };
  financialData: {
    totalBudget: number;
    budgetUtilization: number;
    revenueCollection: number;
    pendingBills: number;
  };
}

// Budget API responses
export interface BudgetAllocationResponse {
  countyId: string;
  countyName: string;
  fiscalYear: string;
  allocations: {
    sector: string;
    budgeted: number;
    spent: number;
    percentage: number;
  }[];
  totalBudget: number;
  totalSpent: number;
}

// Debt API responses
export interface DebtDataResponse {
  countyId: string;
  countyName: string;
  totalDebt: number;
  debtToGdpRatio: number;
  debtCategories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  debtTimeline: {
    year: string;
    amount: number;
  }[];
}

// National statistics
export interface NationalStatsResponse {
  totalCounties: number;
  totalBudget: number;
  totalDebt: number;
  averageAuditScore: number;
  countiesByAuditStatus: {
    clean: number;
    qualified: number;
    adverse: number;
    disclaimer: number;
    pending: number;
  };
  topPerformingCounties: CountyResponse[];
  flaggedCounties: CountyResponse[];
}

// Query parameters
export interface CountyFilters {
  search?: string;
  auditStatus?: string[];
  debtLevel?: 'low' | 'medium' | 'high';
  budgetRange?: [number, number];
  fiscalYear?: string;
  page?: number;
  limit?: number;
}

export interface AuditFilters {
  countyId?: string;
  fiscalYear?: string;
  auditStatus?: string[];
  concernLevel?: string[];
  page?: number;
  limit?: number;
}

// Enriched audits response from backend /api/v1/counties/{id}/audits
export interface CountyAuditsEnriched {
  county_id: string;
  county_name: string;
  summary: {
    queries_count: number;
    total_amount_involved: number;
    by_severity: Record<string, number>;
    by_status: Record<string, number>;
    by_category: Record<string, number>;
  };
  top_recent: Array<{
    id: string;
    county: string;
    query_type: string;
    description: string;
    amount_involved: string;
    severity: string;
    status: string;
    date_raised: string;
    category: string;
  }>;
  queries: Array<{
    id: string;
    county: string;
    query_type: string;
    description: string;
    amount_involved: string;
    severity: string;
    status: string;
    date_raised: string;
    category: string;
  }>;
  missing_funds: {
    count: number;
    total_amount: number;
    cases: Array<{
      case_id: string;
      description: string;
      amount: number;
      amount_label: string;
      period: string;
      status: string;
    }>;
  };
  cob_implementation: {
    coverage: {
      mentioned_in_report: boolean;
      context_length: number;
      analysis_depth: string;
    };
    issues: string[];
    budget_implementation: Record<string, any>;
  };
  kpis: {
    budget_execution_rate?: number;
    pending_bills?: number;
    financial_health_score?: number;
  };
}
