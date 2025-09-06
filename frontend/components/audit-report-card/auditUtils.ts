/**
 * Utility functions for audit report formatting and status handling
 */

export interface StatusBadge {
  text: string;
  bg: string;
  text_color: string;
  border: string;
}

export interface StatusBadges {
  clean: StatusBadge;
  qualified: StatusBadge;
  adverse: StatusBadge;
  disclaimer: StatusBadge;
  pending: StatusBadge;
}

/**
 * Format currency values to billions with KES prefix
 */
export const formatCurrency = (amount: number): string => {
  return `KES ${(amount / 1e9).toFixed(1)}B`;
};

/**
 * Format date to localized string
 */
export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Get status badge configuration based on audit status
 */
export const getStatusBadges = (): StatusBadges => ({
  clean: {
    text: 'Clean Report',
    bg: 'bg-green-100',
    text_color: 'text-green-800',
    border: 'border-green-200',
  },
  qualified: {
    text: 'Some Concerns',
    bg: 'bg-yellow-100',
    text_color: 'text-yellow-800',
    border: 'border-yellow-200',
  },
  adverse: {
    text: 'Major Issues',
    bg: 'bg-red-100',
    text_color: 'text-red-800',
    border: 'border-red-200',
  },
  disclaimer: {
    text: 'Critical Problems',
    bg: 'bg-red-200',
    text_color: 'text-red-900',
    border: 'border-red-300',
  },
  pending: {
    text: 'Audit Pending',
    bg: 'bg-gray-100',
    text_color: 'text-gray-800',
    border: 'border-gray-200',
  },
});

/**
 * Get concern level color class
 */
export const getConcernLevelColor = (level: string): string => {
  switch (level) {
    case 'low':
      return 'text-green-600';
    case 'medium':
      return 'text-yellow-600';
    case 'high':
      return 'text-red-600';
    case 'critical':
      return 'text-red-800';
    default:
      return 'text-gray-600';
  }
};

/**
 * Get citizen impact message based on audit status
 */
export const getCitizenImpactMessage = (auditStatus: string): string => {
  switch (auditStatus) {
    case 'clean':
      return 'Your county is managing money well. Services should improve and projects should be completed on time and budget.';
    case 'qualified':
      return 'Your county has some issues to fix, but most services should continue normally. Improvements are needed in financial management.';
    case 'adverse':
      return 'Serious problems mean some services may be affected. Citizens should demand better accountability from county leadership.';
    case 'disclaimer':
      return 'Major problems with financial records mean we cannot verify how your tax money was spent. Immediate action is needed.';
    case 'pending':
      return 'Audit is ongoing. Full results will show how well your county is managing public funds.';
    default:
      return 'Audit status unknown. Please check back for updated information.';
  }
};
