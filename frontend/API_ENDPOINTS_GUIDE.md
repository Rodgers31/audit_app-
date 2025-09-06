# API Endpoints Configuration Guide

## Overview

All API endpoints are now centralized in `lib/api/endpoints.ts` for better organization, debugging, and maintenance. This approach provides several benefits:

- **Centralized Configuration**: All endpoints in one location
- **Easy Debugging**: Visual component and console logging utilities
- **Type Safety**: TypeScript support with proper typing
- **Consistent URL Building**: Automated query parameter handling
- **Environment Flexibility**: Easy switching between development/production

## File Structure

```
lib/api/
├── endpoints.ts          # ⭐ Centralized endpoints configuration
├── axios.ts             # HTTP client configuration
├── types.ts             # TypeScript interfaces
├── counties.ts          # Counties API service (updated)
├── audits.ts           # Audits API service (updated)
├── budget.ts           # Budget API service (updated)
├── debt.ts             # Debt API service (updated)
├── statistics.ts       # Statistics API service (updated)
└── index.ts            # Central exports
```

## Endpoints Configuration

### Base Configuration

```typescript
// Base API configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  VERSION: process.env.NEXT_PUBLIC_API_VERSION || 'v1',
  TIMEOUT: 10000,
} as const;

// Get full API base URL
export const getApiBaseUrl = () => `${API_CONFIG.BASE_URL}/api/${API_CONFIG.VERSION}`;
```

### Endpoint Categories

#### 1. Counties Endpoints (`COUNTIES_ENDPOINTS`)

```typescript
const COUNTIES_ENDPOINTS = {
  LIST: '/counties',
  GET_BY_ID: (id: string) => `/counties/${id}`,
  SEARCH: '/counties/search',
  TOP_PERFORMING: '/counties/top-performing',
  FINANCIAL_SUMMARY: (id: string) => `/counties/${id}/financial-summary`,
  // ... more endpoints
};
```

#### 2. Audits Endpoints (`AUDITS_ENDPOINTS`)

```typescript
const AUDITS_ENDPOINTS = {
  LIST: '/audits',
  GET_BY_ID: (id: string) => `/audits/${id}`,
  STATISTICS: '/audits/statistics',
  FISCAL_YEARS: '/audits/fiscal-years',
};
```

#### 3. Budget Endpoints (`BUDGET_ENDPOINTS`)

```typescript
const BUDGET_ENDPOINTS = {
  COMPARISON: '/budget/comparison',
  NATIONAL: '/budget/national',
  SECTORS: (sector: string) => `/budget/sectors/${sector}`,
};
```

#### 4. Debt Endpoints (`DEBT_ENDPOINTS`)

```typescript
const DEBT_ENDPOINTS = {
  NATIONAL: '/debt/national',
  BREAKDOWN: '/debt/breakdown',
  TOP_LOANS: '/debt/top-loans',
  RISK_ASSESSMENT: '/debt/risk-assessment',
};
```

#### 5. Statistics Endpoints (`STATISTICS_ENDPOINTS`)

```typescript
const STATISTICS_ENDPOINTS = {
  DASHBOARD: '/stats/dashboard',
  OVERVIEW: '/stats/overview',
  RANKINGS: '/stats/rankings',
  TRANSPARENCY_INDEX: '/stats/transparency-index',
};
```

## Usage in API Services

### Before (Manual URL Building)

```typescript
// ❌ Old approach - manual URL building
export const getCounties = async (filters?: CountyFilters) => {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  // ... more parameter building

  const response = await apiClient.get(`/counties?${params}`);
  return response.data.data;
};
```

### After (Centralized Configuration)

```typescript
// ✅ New approach - centralized endpoints
import { COUNTIES_ENDPOINTS, buildUrlWithParams } from './endpoints';

export const getCounties = async (filters?: CountyFilters) => {
  const queryParams: Record<string, any> = {};
  if (filters?.search) queryParams.search = filters.search;
  // ... build params object

  const url = buildUrlWithParams(COUNTIES_ENDPOINTS.LIST, queryParams);
  const response = await apiClient.get(url);
  return response.data.data;
};
```

## Helper Functions

### URL Building with Parameters

```typescript
// Automatic query parameter handling
const url = buildUrlWithParams('/counties', {
  search: 'nairobi',
  limit: 10,
  audit_status: ['clean', 'qualified'],
});
// Result: '/counties?search=nairobi&limit=10&audit_status=clean&audit_status=qualified'
```

### Debug Utilities

```typescript
// Log all endpoints to console (development only)
import { logAllEndpoints } from '@/lib/api/endpoints';
logAllEndpoints();

// Get array of all endpoint strings
import { getAllEndpoints } from '@/lib/api/endpoints';
const endpoints = getAllEndpoints();
```

## Development Debugging

### 1. Console Logging

```typescript
import { logAllEndpoints } from '@/lib/api/endpoints';

// In development, log all endpoints
if (process.env.NODE_ENV === 'development') {
  logAllEndpoints();
}
```

### 2. Visual Debugger Component

```tsx
import EndpointsDebugger from '@/components/EndpointsDebugger';

// Add to your layout or page (development only)
export default function Layout({ children }) {
  return (
    <div>
      {children}
      <EndpointsDebugger />
    </div>
  );
}
```

The `EndpointsDebugger` component provides:

- 🔗 Floating button to open endpoint viewer
- 📋 Categorized list of all endpoints
- 🖨️ Console logging functionality
- 🎯 Only shown in development mode

## Benefits

### 1. **Easy Endpoint Management**

- All endpoints in one file for quick reference
- Update base URL or add new endpoints in single location
- Clear categorization by API domain

### 2. **Improved Debugging**

- Visual component shows all available endpoints
- Console logging for development debugging
- Easy identification of endpoint patterns

### 3. **Better Type Safety**

- TypeScript support for endpoint functions
- Consistent parameter handling
- Reduced chance of URL typos

### 4. **Simplified Maintenance**

- Change API structure in one place
- Consistent URL building across all services
- Easy environment switching (dev/staging/prod)

## Environment Configuration

Update your `.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_VERSION=v1
```

## Migration Guide

If you're updating existing API calls:

1. **Import endpoints configuration**:

   ```typescript
   import { COUNTIES_ENDPOINTS, buildUrlWithParams } from './endpoints';
   ```

2. **Replace manual URL building**:

   ```typescript
   // Before
   const response = await apiClient.get(`/counties/${id}`);

   // After
   const response = await apiClient.get(COUNTIES_ENDPOINTS.GET_BY_ID(id));
   ```

3. **Use buildUrlWithParams for query parameters**:

   ```typescript
   // Before
   const params = new URLSearchParams();
   params.append('search', query);
   const response = await apiClient.get(`/counties/search?${params}`);

   // After
   const url = buildUrlWithParams(COUNTIES_ENDPOINTS.SEARCH, { q: query });
   const response = await apiClient.get(url);
   ```

## Next Steps

1. **Add the debugger component** to your layout for development
2. **Test all API endpoints** using the visual debugger
3. **Update environment variables** as needed
4. **Begin replacing mock data** in components with actual API calls

This centralized approach makes your API layer much more maintainable and debuggable!
