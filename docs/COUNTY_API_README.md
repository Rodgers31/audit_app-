# Kenya County Analytics API Documentation

## Overview

The Kenya County Analytics API provides comprehensive financial transparency data for all 47 counties in Kenya. This API powers government audit applications with real-time access to county budgets, debt information, audit ratings, missing funds tracking, and performance rankings.

**Base URL:** `http://localhost:8002`  
**API Documentation:** `http://localhost:8002/docs` (Interactive Swagger UI)

---

## 🏛️ Available Endpoints

### 1. API Status

**GET** `/`

Returns API status and basic information.

**Response:**

```json
{
  "message": "Kenya County Analytics Platform",
  "status": "operational",
  "counties": 47,
  "features": [
    "County budgets and financial data",
    "Audit ratings and queries",
    "Missing funds tracking",
    "Performance rankings",
    "Comprehensive analytics"
  ]
}
```

---

### 2. All Counties Summary

**GET** `/counties/all`

Returns summary data for all 47 Kenya counties.

**Response:** Array of county objects

```json
[
  {
    "county": "Nairobi",
    "population": 1007722,
    "budget_2025": 3023166000.0,
    "revenue_2024": 2267374500.0,
    "debt_outstanding": 755791500.0,
    "pending_bills": 453474900.0,
    "loans_received": 0.0,
    "audit_rating": "B",
    "missing_funds": 151158300.0,
    "financial_health_score": 78.0,
    "budget_execution_rate": 75.0
  }
  // ... 46 more counties
]
```

---

### 3. Individual County Details

**GET** `/counties/{county_name}`

Returns comprehensive details for a specific county.

**Parameters:**

- `county_name` (string): Name of the county (e.g., "Nairobi", "Mombasa")

**Example:** `GET /counties/Nairobi`

**Response:**

```json
{
  "county": "Nairobi",
  "basic_info": {
    "population": 1007722,
    "budget_2025": 3023166000,
    "revenue_2024": 2267374500,
    "per_capita_budget": 3000.0
  },
  "financial_metrics": {
    "debt_outstanding": 755791500,
    "pending_bills": 453474900,
    "loans_received": 0,
    "missing_funds": 151158300,
    "budget_execution_rate": 75.0,
    "debt_to_budget_ratio": 25.0,
    "financial_health_score": 78.0
  },
  "audit_information": {
    "audit_rating": "B",
    "audit_queries": [],
    "major_issues": ["Budget execution delays", "Revenue collection challenges"]
  }
}
```

---

### 4. County Search

**GET** `/counties/search`

Search counties by name with optional minimum population filter.

**Query Parameters:**

- `query` (string, optional): Search term for county name
- `min_population` (integer, optional): Minimum population filter

**Example:** `GET /counties/search?query=Nairobi&min_population=1000000`

**Response:** Array of matching counties (same format as `/counties/all`)

---

### 5. County Rankings

**GET** `/rankings/{metric}`

Returns counties ranked by specific financial metrics.

**Available Metrics:**

- `budget` - Largest county budgets
- `debt` - Highest debt levels
- `missing-funds` - Most missing funds
- `health-score` - Best financial health scores
- `execution-rate` - Best budget execution rates
- `per-capita` - Highest per-capita budgets
- `debt-ratio` - Highest debt-to-budget ratios

**Example:** `GET /rankings/health-score`

**Response:**

```json
[
  {
    "rank": 1,
    "county": "Kiambu",
    "value": 78.6,
    "metric": "health-score"
  },
  {
    "rank": 2,
    "county": "Nairobi",
    "value": 78.0,
    "metric": "health-score"
  }
  // ... more rankings
]
```

**Example:** `GET /rankings/missing-funds`

**Response:**

```json
[
  {
    "rank": 1,
    "county": "Mombasa",
    "value": 890000000.0,
    "metric": "missing-funds"
  },
  {
    "rank": 2,
    "county": "Nakuru",
    "value": 680000000.0,
    "metric": "missing-funds"
  }
  // ... more rankings
]
```

---

### 6. Audit Queries

**GET** `/audit/queries`

Returns all county audit queries and findings.

**Response:**

```json
[
  {
    "county": "CountyName",
    "query_id": "AQ001",
    "query_type": "Financial Irregularity",
    "description": "Audit query description",
    "amount": 1000000,
    "status": "Pending",
    "date_raised": "2024-01-15"
  }
  // ... more audit queries
]
```

---

### 7. Missing Funds Analysis

**GET** `/audit/missing-funds`

Returns detailed analysis of missing funds across counties.

**Query Parameters:**

- `min_amount` (float, optional): Minimum missing funds amount filter

**Response:**

```json
{
  "total_missing_funds": 6602731900,
  "affected_counties": 47,
  "top_counties_by_missing_funds": [
    {
      "county": "Mombasa",
      "missing_funds": 890000000,
      "percentage_of_budget": 4.94
    }
    // ... more counties
  ],
  "summary": {
    "average_per_county": 140483872,
    "counties_above_average": 15,
    "total_as_percentage_of_budgets": 4.79
  }
}
```

---

### 8. Analytics Summary

**GET** `/analytics/summary`

Returns comprehensive analytics and insights across all counties.

**Response:**

```json
{
  "overall_statistics": {
    "total_county_budgets": 137954638000,
    "total_county_debt": 35463659500,
    "total_pending_bills": 22738195700,
    "total_missing_funds": 6602731900,
    "average_financial_health": 78.0
  },
  "top_performers": {
    "financial_health": [
      {
        "county": "Kiambu",
        "score": 78.6
      }
      // ... top 5 counties
    ],
    "largest_budgets": [
      {
        "county": "Mombasa",
        "budget": 18000000000
      }
      // ... top 5 counties
    ],
    "highest_debt_ratios": []
  },
  "key_insights": [
    "Total county budgets: 137,954,638,000 KES",
    "Average financial health: 78.0%",
    "Total missing funds: 6,602,731,900 KES",
    "Counties with debt issues: 0"
  ]
}
```

---

## 🎯 Common Use Cases for Frontend UI

### 1. County Dashboard

```javascript
// Get individual county details
fetch('/counties/Nairobi')
  .then((response) => response.json())
  .then((data) => {
    // Display county summary, budget, debt, audit rating
  });
```

### 2. County Comparison Table

```javascript
// Get all counties for comparison
fetch('/counties/all')
  .then((response) => response.json())
  .then((counties) => {
    // Create comparison table with budget, debt, health scores
  });
```

### 3. Performance Rankings

```javascript
// Get top performing counties
fetch('/rankings/health-score')
  .then((response) => response.json())
  .then((rankings) => {
    // Display county performance rankings
  });
```

### 4. Missing Funds Analysis

```javascript
// Get missing funds data
fetch('/rankings/missing-funds')
  .then((response) => response.json())
  .then((data) => {
    // Show counties with most missing funds
  });
```

### 5. Overall Analytics

```javascript
// Get summary statistics
fetch('/analytics/summary')
  .then((response) => response.json())
  .then((analytics) => {
    // Display total budgets, debt, key insights
  });
```

---

## 📊 Data Schema

### County Object Structure

```json
{
  "county": "string",
  "population": "number",
  "budget_2025": "number (KES)",
  "revenue_2024": "number (KES)",
  "debt_outstanding": "number (KES)",
  "pending_bills": "number (KES)",
  "loans_received": "number (KES)",
  "audit_rating": "string (A+, A, A-, B+, B, B-, C+, C, C-)",
  "missing_funds": "number (KES)",
  "financial_health_score": "number (0-100)",
  "budget_execution_rate": "number (percentage)",
  "debt_to_budget_ratio": "number (percentage)",
  "per_capita_budget": "number (KES)"
}
```

### Ranking Object Structure

```json
{
  "rank": "number",
  "county": "string",
  "value": "number",
  "metric": "string"
}
```

---

## 🚀 Getting Started

1. **Start the API Server:**

   ```bash
   python county_analytics_api.py
   ```

2. **Access API Documentation:**
   Open `http://localhost:8002/docs` in your browser

3. **Test Endpoints:**

   ```bash
   # Get all counties
   curl http://localhost:8002/counties/all

   # Get specific county
   curl http://localhost:8002/counties/Nairobi

   # Get rankings
   curl http://localhost:8002/rankings/health-score
   ```

---

## 💡 Notes

- All monetary values are in Kenyan Shillings (KES)
- County names are case-sensitive
- The API includes data for all 47 Kenya counties
- Financial health scores range from 0-100 (higher is better)
- Audit ratings follow standard grading: A+ (excellent) to C- (poor)

---

## 🔧 Error Handling

### Common Error Responses

**404 - County Not Found:**

```json
{
  "detail": "County 'InvalidName' not found"
}
```

**400 - Invalid Metric:**

```json
{
  "detail": "Invalid metric. Available: ['budget', 'debt', 'missing-funds', 'health-score', 'execution-rate', 'per-capita', 'debt-ratio']"
}
```

**422 - Validation Error:**

```json
{
  "detail": [
    {
      "loc": ["query", "min_population"],
      "msg": "ensure this value is greater than 0",
      "type": "value_error"
    }
  ]
}
```

---

_This API provides comprehensive county financial transparency data for Kenya government audit applications._
