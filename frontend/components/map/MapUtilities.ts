/**
 * MapUtilities – colour helpers, name matching, legend data
 * Uses the gov-* design-token palette for visual consistency.
 */

import { County } from '@/types';

/* ────────────────── name matching ────────────────── */

export const getCountyByName = (geoCountyName: string, counties: County[]): County | undefined => {
  if (!counties || counties.length === 0) return undefined;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/county/g, '')
      .replace(/[^a-z]/g, '')
      .trim();

  const aliases: Record<string, string> = {
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

/* ────────────────── audit colour palette (gov tokens) ────────────────── */

const AUDIT_PALETTE: Record<
  string,
  { base: string; hover: string; active: string; muted: string }
> = {
  // Greens — gov-sage / gov-forest
  clean: { base: '#5a946c', hover: '#4A7C5C', active: '#1B3A2A', muted: '#b5d4bf' },
  'A+': { base: '#3d6a4e', hover: '#2f5940', active: '#1B3A2A', muted: '#a6ccb4' },
  A: { base: '#4A7C5C', hover: '#3d6a4e', active: '#1B3A2A', muted: '#b5d4bf' },
  'A-': { base: '#5a946c', hover: '#4A7C5C', active: '#2f5940', muted: '#c4dec9' },
  // Yellows — gov-gold
  qualified: { base: '#D9A441', hover: '#c49338', active: '#a87a24', muted: '#edd5a2' },
  'B+': { base: '#89a851', hover: '#6f8e40', active: '#557430', muted: '#c8daa5' },
  B: { base: '#D9A441', hover: '#c49338', active: '#a87a24', muted: '#edd5a2' },
  'B-': { base: '#d48c32', hover: '#be7928', active: '#a0651e', muted: '#ecc89a' },
  // Reds — gov-copper
  adverse: { base: '#C94A4A', hover: '#b03d3d', active: '#8f2e2e', muted: '#e8b3b3' },
  C: { base: '#C94A4A', hover: '#b03d3d', active: '#8f2e2e', muted: '#e8b3b3' },
  'C+': { base: '#d46545', hover: '#c0563a', active: '#a84730', muted: '#ecc1b3' },
  D: { base: '#8f2e2e', hover: '#7a2525', active: '#651c1c', muted: '#daa4a4' },
  // Violet
  disclaimer: { base: '#7c5cbf', hover: '#6a4aad', active: '#573d94', muted: '#c4b5e0' },
};

const FALLBACK_PAL = { base: '#b0b6ba', hover: '#979ea3', active: '#6b7280', muted: '#d5d8db' };

/** Softer fill for counties with no matching data */
const UNMATCHED_FILL = '#dce1dd';

/* ────────────────── county fill colour ────────────────── */

export const getCountyColor = (
  geoCountyName: string,
  counties: County[],
  _index: number,
  selectedCounty: County | null,
  currentCountyIndex: number,
  hoveredCounty: string | null,
  _animationMode: 'slideshow' | 'pulse' | 'wave',
  visualMode: 'focus' | 'overview' = 'overview'
): string => {
  const county = getCountyByName(geoCountyName, counties);
  if (!county) return UNMATCHED_FILL;

  const key = county.auditStatus ?? county.audit_rating ?? 'B';
  const pal = AUDIT_PALETTE[key] || FALLBACK_PAL;

  // Selected county — deepest shade
  if (selectedCounty?.id === county.id) return pal.active;

  // Auto-rotating county — same as selected
  const currentCounty = counties[currentCountyIndex] ?? null;
  if (!selectedCounty && currentCounty?.id === county.id) return pal.active;

  // Hovered county — mid shade
  if (hoveredCounty === geoCountyName) return pal.hover;

  // Focus mode — muted tint for non-active
  if (visualMode === 'focus') return pal.muted;

  // Overview mode — base audit colour
  return pal.base;
};

/** Get the hover fill for a county (used in Geography hover style) */
export const getCountyHoverColor = (geoCountyName: string, counties: County[]): string => {
  const county = getCountyByName(geoCountyName, counties);
  if (!county) return '#c8cec9';
  const key = county.auditStatus ?? county.audit_rating ?? 'B';
  return (AUDIT_PALETTE[key] || FALLBACK_PAL).hover;
};

/* ────────────────── helpers ────────────────── */

export const getFinancialTrend = (county: County): 'excellent' | 'good' | 'fair' | 'poor' => {
  const utilization = county.budgetUtilization || 0;
  const debt = county.debt ?? 0;
  const budget = county.budget && county.budget > 0 ? county.budget : 1;
  const debtRatio = (debt / budget) * 100;

  if (utilization > 90 && debtRatio < 30) return 'excellent';
  if (utilization > 80 && debtRatio < 50) return 'good';
  if (utilization > 70) return 'fair';
  return 'poor';
};

export const getNextAnimationMode = (
  current: 'slideshow' | 'pulse' | 'wave'
): 'slideshow' | 'pulse' | 'wave' => {
  const modes = ['slideshow', 'pulse', 'wave'] as const;
  return modes[(modes.indexOf(current) + 1) % modes.length];
};

/* ────────────────── legend items (for header bar) ────────────────── */

export const LEGEND_ITEMS = [
  { label: 'Clean / A+', color: '#4A7C5C' },
  { label: 'Qualified / B', color: '#D9A441' },
  { label: 'Adverse / C', color: '#C94A4A' },
  { label: 'Disclaimer', color: '#7c5cbf' },
] as const;
