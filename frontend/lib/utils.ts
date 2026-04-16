import { type ClassValue, clsx } from 'clsx';
import numeral from 'numeral';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (value >= 1e12) {
    return `KES ${numeral(value / 1e12).format('0.0')}T`;
  }
  if (value >= 1e9) {
    return `KES ${numeral(value / 1e9).format('0.0')}B`;
  }
  if (value >= 1e6) {
    return `KES ${numeral(value / 1e6).format('0.0')}M`;
  }
  return `KES ${numeral(value).format('0,0')}`;
}

/**
 * Format a raw KES amount into a short human-readable string.
 * Input: raw KES (e.g. 5_441_872_939) → "KES 5.4B"
 */
export function fmtKES(val: number): string {
  if (!val || val === 0) return 'KES 0';
  const abs = Math.abs(val);
  if (abs >= 1e12) return `KES ${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `KES ${(val / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `KES ${(val / 1e6).toFixed(1)}M`;
  return `KES ${val.toLocaleString()}`;
}

/**
 * Format a **billion KES** value into a short human-readable string.
 * Input: billions (e.g. 3310 meaning KES 3.31 trillion) → "3.31T"
 *
 * ⚠ Do NOT pass raw KES to this function — use fmtKES() instead.
 */
export function fmtBillionKES(val: number): string {
  if (!val) return '—';
  if (val >= 1000) return `${(val / 1000).toFixed(2)}T`;
  return `${val.toFixed(0)}B`;
}

export function formatPercentage(value: number): string {
  return `${numeral(value).format('0.0')}%`;
}

export function formatNumber(value: number): string {
  return numeral(value).format('0,0');
}

export function getDebtRiskColor(debtToGdpRatio: number): string {
  if (debtToGdpRatio < 40) return 'text-brand-500';
  if (debtToGdpRatio < 60) return 'text-caution';
  return 'text-risk';
}

export function getDebtRiskLevel(debtToGdpRatio: number): string {
  if (debtToGdpRatio < 40) return 'Low Risk';
  if (debtToGdpRatio < 60) return 'Moderate Risk';
  return 'High Risk';
}

/**
 * Return the current Kenyan fiscal year label (e.g. "2024/25").
 * Kenya FY runs July 1 – June 30.
 */
export function getCurrentFiscalYear(): string {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

/**
 * Generate an array of Kenyan fiscal year labels starting from the current year going back.
 */
export function generateFiscalYears(count = 5): string[] {
  const now = new Date();
  let startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - i;
    return `${y}/${String(y + 1).slice(-2)}`;
  });
}
