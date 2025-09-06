/**
 * MapUtilities - Helper functions for map interactions and county data processing
 * Contains reusable logic for county matching, color coding, and status determination
 */

import { County } from '@/types';

/**
 * Match GeoJSON county names to our county data
 * Handles name variations and normalization
 */
export const getCountyByName = (geoCountyName: string, counties: County[]): County | undefined => {
  if (!counties || counties.length === 0) return undefined;

  // Normalize names: lowercase, remove spaces, punctuation, and "county" suffix
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/county/g, '')
      .replace(/[^a-z]/g, '')
      .trim();

  // Common alias corrections between API data and GeoJSON labels
  const aliases: Record<string, string> = {
    // e.g., "Elgeyo Marakwet" vs "Elgeyo-Marakwet"
    elgeyomarakwet: 'elgeyomarakwet',
    thika: 'kiambu',
    eldoret: 'uasingishu',
    mombasa: 'mombasa',
    nairobi: 'nairobi',
  };

  const normalizedGeoName = aliases[normalize(geoCountyName)] || normalize(geoCountyName);

  return counties.find((c) => {
    const n = normalize(c.name);
    return (
      n === normalizedGeoName || normalizedGeoName.includes(n) || n.includes(normalizedGeoName)
    );
  });
};

/**
 * Get county color based on selection state and audit rating
 * Enhanced with focus/overview modes and vibrant audit-based colors
 */
export const getCountyColor = (
  geoCountyName: string,
  counties: County[],
  index: number,
  selectedCounty: County | null,
  currentCountyIndex: number,
  hoveredCounty: string | null,
  animationMode: 'slideshow' | 'pulse' | 'wave',
  visualMode: 'focus' | 'overview' = 'overview'
): string => {
  const county = getCountyByName(geoCountyName, counties);
  if (!county) return '#e5e7eb'; // Gray for unknown counties

  // Priority 1: Selected county - always use audit-based color
  if (selectedCounty?.id === county.id) {
    return getAuditColor(county.auditStatus ?? 'B', 'selected');
  }

  // Priority 2: Current auto-rotating county - vibrant audit color
  const currentCounty = counties && counties.length > 0 ? counties[currentCountyIndex] : null;
  if (!selectedCounty && currentCounty && county.id === currentCounty.id) {
    return getAuditColor(county.auditStatus ?? 'B', 'active');
  }

  // Priority 3: Hovered county - audit color with hover effect
  if (hoveredCounty === geoCountyName) {
    return getAuditColor(county.auditStatus ?? 'B', 'hover');
  }

  // Focus Mode: Only active/selected counties get audit colors, others are neutral
  if (visualMode === 'focus') {
    return '#e2e8f0'; // Light gray for non-active counties
  }

  // Overview Mode: All counties show audit-based colors
  return getAuditColor(county.auditStatus ?? 'B', 'default');
};

/**
 * Get vibrant colors based on audit status and interaction state
 */
const getAuditColor = (
  auditStatus: string,
  state: 'default' | 'hover' | 'active' | 'selected'
): string => {
  const colors = {
    'A+': {
      default: '#10b981', // Emerald-500
      hover: '#059669', // Emerald-600
      active: '#047857', // Emerald-700
      selected: '#065f46', // Emerald-800
    },
    A: {
      default: '#10b981', // Emerald-500
      hover: '#059669', // Emerald-600
      active: '#047857', // Emerald-700
      selected: '#065f46', // Emerald-800
    },
    'A-': {
      default: '#22c55e', // Green-500
      hover: '#16a34a', // Green-600
      active: '#15803d', // Green-700
      selected: '#166534', // Green-800
    },
    'B+': {
      default: '#84cc16', // Lime-500
      hover: '#65a30d', // Lime-600
      active: '#4d7c0f', // Lime-700
      selected: '#3f6212', // Lime-800
    },
    B: {
      default: '#eab308', // Yellow-500
      hover: '#ca8a04', // Yellow-600
      active: '#a16207', // Yellow-700
      selected: '#854d0e', // Yellow-800
    },
    'B-': {
      default: '#f59e0b', // Amber-500
      hover: '#d97706', // Amber-600
      active: '#b45309', // Amber-700
      selected: '#92400e', // Amber-800
    },
    C: {
      default: '#f97316', // Orange-500
      hover: '#ea580c', // Orange-600
      active: '#c2410c', // Orange-700
      selected: '#9a3412', // Orange-800
    },
    D: {
      default: '#ef4444', // Red-500
      hover: '#dc2626', // Red-600
      active: '#b91c1c', // Red-700
      selected: '#991b1b', // Red-800
    },
    clean: {
      default: '#10b981', // Emerald-500
      hover: '#059669', // Emerald-600
      active: '#047857', // Emerald-700
      selected: '#065f46', // Emerald-800
    },
    qualified: {
      default: '#eab308', // Yellow-500
      hover: '#ca8a04', // Yellow-600
      active: '#a16207', // Yellow-700
      selected: '#854d0e', // Yellow-800
    },
    adverse: {
      default: '#ef4444', // Red-500
      hover: '#dc2626', // Red-600
      active: '#b91c1c', // Red-700
      selected: '#991b1b', // Red-800
    },
    disclaimer: {
      default: '#8b5cf6', // Violet-500
      hover: '#7c3aed', // Violet-600
      active: '#6d28d9', // Violet-700
      selected: '#5b21b6', // Violet-800
    },
  };

  // Ensure auditStatus is a valid key, fallback to 'B' if not
  const validAuditStatus = auditStatus in colors ? auditStatus : 'B';
  return (colors as any)[validAuditStatus]?.[state] || (colors as any)['B']?.[state] || '#eab308';
};

/**
 * Determine financial trend based on utilization and debt metrics
 * Used for additional financial health indicators
 */
export const getFinancialTrend = (county: County): 'excellent' | 'good' | 'fair' | 'poor' => {
  const utilizationRate = county.budgetUtilization || 0;
  const debt = county.debt ?? 0;
  const budget = county.budget && county.budget > 0 ? county.budget : 1; // avoid /0
  const debtRatio = (debt / budget) * 100;

  if (utilizationRate > 90 && debtRatio < 30) return 'excellent';
  if (utilizationRate > 80 && debtRatio < 50) return 'good';
  if (utilizationRate > 70) return 'fair';
  return 'poor';
};

/**
 * Animation mode cycling logic
 * Rotates through different visual animation modes
 */
export const getNextAnimationMode = (
  current: 'slideshow' | 'pulse' | 'wave'
): 'slideshow' | 'pulse' | 'wave' => {
  const modes = ['slideshow', 'pulse', 'wave'] as const;
  const currentIndex = modes.indexOf(current);
  return modes[(currentIndex + 1) % modes.length];
};
