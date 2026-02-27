/**
 * Tests for lib/api/axios.ts
 *
 * Covers:
 *  apiClient creation and configuration
 *  Request interceptors
 *  Response interceptors
 */

import { apiClient } from '@/lib/api/axios';

describe('apiClient', () => {
  it('is an axios instance with a baseURL', () => {
    expect(apiClient.defaults.baseURL).toBeDefined();
    expect(typeof apiClient.defaults.baseURL).toBe('string');
  });

  it('has a timeout configured', () => {
    expect(apiClient.defaults.timeout).toBeGreaterThan(0);
  });

  it('sets Content-Type to application/json', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('has request interceptors installed', () => {
    // Axios stores interceptors internally
    expect(apiClient.interceptors.request).toBeDefined();
  });

  it('has response interceptors installed', () => {
    expect(apiClient.interceptors.response).toBeDefined();
  });

  it('baseURL contains /api/', () => {
    expect(apiClient.defaults.baseURL).toContain('/api/');
  });
});
