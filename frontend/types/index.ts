export interface AuditIssue {
  id: string;
  type: 'financial' | 'compliance' | 'performance' | 'governance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  amount?: number; // Monetary impact if applicable
  status: 'open' | 'resolved' | 'pending';
}

export interface County {
  id: string;
  name: string;
  code?: string;
  coordinates?: [number, number]; // [longitude, latitude]
  budget?: number;
  debt?: number;
  population: number;
  // Backend actual fields
  budget_2025: number;
  financial_health_score: number;
  audit_rating: string; // 'A-', 'B', 'B+', etc.
  // Legacy frontend fields for compatibility
  auditStatus?: 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'pending';
  lastAuditDate?: string;
  gdp?: number;
  // Enhanced financial data
  moneyReceived?: number; // Total grants/transfers received
  budgetUtilization?: number; // Percentage of budget used
  auditIssues?: AuditIssue[];
  revenueCollection?: number; // Local revenue collected
  pendingBills?: number; // Outstanding payments
  developmentBudget?: number; // Capital/development budget
  recurrentBudget?: number; // Operational budget
  // Additional fields for county explorer
  governor?: string; // Governor name
  totalBudget?: number; // Total budget (computed from dev + recurrent)
  totalDebt?: number; // Total debt (same as debt)
  education?: number; // Education spending
  health?: number; // Health spending
  infrastructure?: number; // Infrastructure spending
}

export interface NationalData {
  totalDebt: number;
  gdp: number;
  debtToGdpRatio: number;
  lastUpdated: string;
  debtBreakdown: {
    domestic: number;
    external: number;
  };
}

export interface AuditStatus {
  status: 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'pending';
  label: string;
  color: string;
  icon: string;
}

export interface FederalProject {
  id: string;
  name: string;
  ministry: string;
  budget: number;
  completion: number; // percentage
  auditStatus: 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'pending';
  keyIssues: string[];
  citizenImpact: string;
  timeframe: string;
}

export interface Ministry {
  id: string;
  name: string;
  budget: number;
  auditStatus: 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'pending';
  majorProjects: string[];
  keyIssues: string[];
  citizenServices: string[];
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface TooltipData {
  content: string;
  position: {
    x: number;
    y: number;
  };
  visible: boolean;
}
