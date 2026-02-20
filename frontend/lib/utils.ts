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
