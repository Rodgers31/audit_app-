/**
 * Central exports for all React Query hooks
 * Import all hooks from a single location for convenience
 */

// Counties hooks
export {
  useCounties,
  useCountiesInfinite,
  useCountiesSearch,
  useCounty,
  useCountyByCode,
  useCountyFinancialSummary,
  useFlaggedCounties,
  useTopPerformingCounties,
} from './useCounties';

// Audits hooks
export {
  useAuditReport,
  useAuditReports,
  useAuditReportsInfinite,
  useAuditStatistics,
  useAvailableFiscalYears,
  useCountyAuditReports,
  useCountyAuditsEnriched,
  useLatestCountyAudit,
} from './useAudits';

// Budget hooks
export {
  useBudgetAllocation,
  useBudgetComparison,
  useBudgetTrends,
  useBudgetUtilizationSummary,
  useNationalBudgetSummary,
  useSectorBudgetAllocation,
} from './useBudget';

// Debt hooks
export {
  useCountyDebtData,
  useDebtBreakdown,
  useDebtComparison,
  useDebtRiskAssessment,
  useDebtSustainabilityIndicators,
  useDebtTimeline,
  useNationalDebtOverview,
  useTopLoans,
} from './useDebt';

// Statistics hooks
export {
  useAlertsAndNotifications,
  useAuditComplianceStats,
  useDashboardStats,
  useFinancialHealthIndicators,
  useNationalOverview,
  useNationalTrends,
  usePerformanceRankings,
  useRegionalAnalysis,
  useSectorPerformance,
  useTransparencyIndex,
} from './useStatistics';

// Query Provider
export { QueryProvider } from './QueryProvider';
