/**
 * Tests for lib/api/endpoints.ts
 *
 * Covers:
 *  API_CONFIG constants
 *  getApiBaseUrl()
 *  COUNTIES_ENDPOINTS
 *  AUDITS_ENDPOINTS
 *  BUDGET_ENDPOINTS
 *  DEBT_ENDPOINTS
 *  FISCAL_ENDPOINTS
 *  STATISTICS_ENDPOINTS
 *  buildUrlWithParams()
 *  getAllEndpoints()
 */

import {
  API_CONFIG,
  API_ENDPOINTS,
  AUDITS_ENDPOINTS,
  BUDGET_ENDPOINTS,
  COUNTIES_ENDPOINTS,
  DEBT_ENDPOINTS,
  FISCAL_ENDPOINTS,
  STATISTICS_ENDPOINTS,
  buildUrlWithParams,
  getAllEndpoints,
  getApiBaseUrl,
} from '@/lib/api/endpoints';

// ── API_CONFIG ──────────────────────────────────────────────────────────

describe('API_CONFIG', () => {
  it('has a BASE_URL', () => {
    expect(typeof API_CONFIG.BASE_URL).toBe('string');
    expect(API_CONFIG.BASE_URL.length).toBeGreaterThan(0);
  });

  it('has a VERSION string', () => {
    expect(typeof API_CONFIG.VERSION).toBe('string');
  });

  it('has a numeric TIMEOUT', () => {
    expect(typeof API_CONFIG.TIMEOUT).toBe('number');
    expect(API_CONFIG.TIMEOUT).toBeGreaterThan(0);
  });
});

// ── getApiBaseUrl ───────────────────────────────────────────────────────

describe('getApiBaseUrl', () => {
  it('returns a string containing /api/ and the version', () => {
    const url = getApiBaseUrl();
    expect(url).toContain('/api/');
    expect(url).toContain(API_CONFIG.VERSION);
  });
});

// ── COUNTIES_ENDPOINTS ──────────────────────────────────────────────────

describe('COUNTIES_ENDPOINTS', () => {
  it('has a LIST string', () => {
    expect(COUNTIES_ENDPOINTS.LIST).toBe('/counties');
  });

  it('GET_BY_ID produces a path with the id', () => {
    expect(COUNTIES_ENDPOINTS.GET_BY_ID('42')).toBe('/counties/42');
  });

  it('GET_BY_CODE produces a path with the code', () => {
    expect(COUNTIES_ENDPOINTS.GET_BY_CODE('NRB')).toBe('/counties/code/NRB');
  });

  it('COMPREHENSIVE includes the id', () => {
    expect(COUNTIES_ENDPOINTS.COMPREHENSIVE('5')).toContain('5');
    expect(COUNTIES_ENDPOINTS.COMPREHENSIVE('5')).toContain('comprehensive');
  });

  it('BUDGET produces county budget path', () => {
    expect(COUNTIES_ENDPOINTS.BUDGET('7')).toBe('/counties/7/budget');
  });

  it('DEBT_TIMELINE produces correct path', () => {
    expect(COUNTIES_ENDPOINTS.DEBT_TIMELINE('3')).toBe('/counties/3/debt/timeline');
  });
});

// ── AUDITS_ENDPOINTS ────────────────────────────────────────────────────

describe('AUDITS_ENDPOINTS', () => {
  it('has LIST, STATISTICS, and FEDERAL', () => {
    expect(AUDITS_ENDPOINTS.LIST).toBe('/audits');
    expect(AUDITS_ENDPOINTS.STATISTICS).toBe('/audits/statistics');
    expect(AUDITS_ENDPOINTS.FEDERAL).toBe('/audits/federal');
  });

  it('GET_BY_ID produces audit path', () => {
    expect(AUDITS_ENDPOINTS.GET_BY_ID('abc')).toBe('/audits/abc');
  });
});

// ── BUDGET_ENDPOINTS ────────────────────────────────────────────────────

describe('BUDGET_ENDPOINTS', () => {
  it('has NATIONAL, UTILIZATION, OVERVIEW, ENHANCED', () => {
    expect(BUDGET_ENDPOINTS.NATIONAL).toBe('/budget/national');
    expect(BUDGET_ENDPOINTS.UTILIZATION).toBe('/budget/utilization');
    expect(BUDGET_ENDPOINTS.OVERVIEW).toBe('/budget/overview');
    expect(BUDGET_ENDPOINTS.ENHANCED).toBe('/budget/enhanced');
  });

  it('SECTORS produces sector path', () => {
    expect(BUDGET_ENDPOINTS.SECTORS('health')).toBe('/budget/sectors/health');
  });
});

// ── DEBT_ENDPOINTS ──────────────────────────────────────────────────────

describe('DEBT_ENDPOINTS', () => {
  it('has top-level debt paths', () => {
    expect(DEBT_ENDPOINTS.NATIONAL).toBe('/debt/national');
    expect(DEBT_ENDPOINTS.LOANS).toBe('/debt/loans');
    expect(DEBT_ENDPOINTS.TIMELINE).toBe('/debt/timeline');
  });

  it('BREAKDOWN_BY_COUNTY includes county id', () => {
    expect(DEBT_ENDPOINTS.BREAKDOWN_BY_COUNTY('12')).toBe('/debt/breakdown/12');
  });
});

// ── FISCAL_ENDPOINTS ────────────────────────────────────────────────────

describe('FISCAL_ENDPOINTS', () => {
  it('has SUMMARY', () => {
    expect(FISCAL_ENDPOINTS.SUMMARY).toBe('/fiscal/summary');
  });
});

// ── STATISTICS_ENDPOINTS ────────────────────────────────────────────────

describe('STATISTICS_ENDPOINTS', () => {
  it('has DASHBOARD, OVERVIEW, RANKINGS', () => {
    expect(STATISTICS_ENDPOINTS.DASHBOARD).toBe('/stats/dashboard');
    expect(STATISTICS_ENDPOINTS.OVERVIEW).toBe('/stats/overview');
    expect(STATISTICS_ENDPOINTS.RANKINGS).toBe('/stats/rankings');
  });

  it('has audit compliance and financial health', () => {
    expect(STATISTICS_ENDPOINTS.AUDIT_COMPLIANCE).toBeDefined();
    expect(STATISTICS_ENDPOINTS.FINANCIAL_HEALTH).toBeDefined();
  });
});

// ── buildUrlWithParams ──────────────────────────────────────────────────

describe('buildUrlWithParams', () => {
  it('returns endpoint unchanged when no params', () => {
    expect(buildUrlWithParams('/counties')).toBe('/counties');
  });

  it('returns endpoint unchanged for empty params object', () => {
    expect(buildUrlWithParams('/counties', {})).toBe('/counties');
  });

  it('appends query string for simple params', () => {
    const url = buildUrlWithParams('/counties', { page: 1, limit: 10 });
    expect(url).toContain('/counties?');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
  });

  it('skips undefined and null values', () => {
    const url = buildUrlWithParams('/search', { q: 'test', sort: undefined, order: null });
    expect(url).toContain('q=test');
    expect(url).not.toContain('sort');
    expect(url).not.toContain('order');
  });

  it('handles array values', () => {
    const url = buildUrlWithParams('/filter', { tags: ['a', 'b'] });
    expect(url).toContain('tags=a');
    expect(url).toContain('tags=b');
  });

  it('converts numeric values to strings', () => {
    const url = buildUrlWithParams('/data', { year: 2024 });
    expect(url).toContain('year=2024');
  });
});

// ── getAllEndpoints ─────────────────────────────────────────────────────

describe('getAllEndpoints', () => {
  it('returns an array of strings', () => {
    const endpoints = getAllEndpoints();
    expect(Array.isArray(endpoints)).toBe(true);
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it('is sorted alphabetically', () => {
    const endpoints = getAllEndpoints();
    const sorted = [...endpoints].sort();
    expect(endpoints).toEqual(sorted);
  });
});

// ── API_ENDPOINTS (aggregated) ──────────────────────────────────────────

describe('API_ENDPOINTS', () => {
  it('groups all endpoint categories', () => {
    expect(API_ENDPOINTS.COUNTIES).toBeDefined();
    expect(API_ENDPOINTS.AUDITS).toBeDefined();
    expect(API_ENDPOINTS.BUDGET).toBeDefined();
    expect(API_ENDPOINTS.DEBT).toBeDefined();
    expect(API_ENDPOINTS.STATISTICS).toBeDefined();
  });
});
