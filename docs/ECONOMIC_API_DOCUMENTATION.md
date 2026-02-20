# Economic Data API Documentation

## Overview

The Economic Data API provides access to Kenya National Bureau of Statistics (KNBS) data including population, GDP, economic indicators, and poverty indices. All endpoints support filtering, pagination, and confidence score thresholds.

**Base URL**: `/api/v1/economic`

**Authentication**: No authentication required (public endpoints)

---

## Endpoints Summary

| Endpoint                        | Method | Description                                              |
| ------------------------------- | ------ | -------------------------------------------------------- |
| `/population`                   | GET    | Query population data by county/year                     |
| `/gdp`                          | GET    | Query national GDP and county GCP                        |
| `/indicators`                   | GET    | Query economic indicators (CPI, inflation, unemployment) |
| `/poverty`                      | GET    | Query poverty indices and Gini coefficients              |
| `/counties/{county_id}/profile` | GET    | Get comprehensive county economic profile                |
| `/summary`                      | GET    | Get national economic summary                            |

---

## Endpoint Details

### 1. Get Population Data

**GET** `/api/v1/economic/population`

Get population data from KNBS with demographic breakdowns.

#### Query Parameters

| Parameter        | Type    | Required | Description                                         |
| ---------------- | ------- | -------- | --------------------------------------------------- |
| `entity_id`      | integer | No       | Filter by entity ID (county or national)            |
| `year`           | integer | No       | Filter by specific year                             |
| `start_year`     | integer | No       | Start year for range query                          |
| `end_year`       | integer | No       | End year for range query                            |
| `min_confidence` | float   | No       | Minimum confidence score (0-1), default: 0.7        |
| `limit`          | integer | No       | Maximum results to return (max: 1000), default: 100 |

#### Response Model

```json
[
  {
    "id": 1,
    "entity_id": 1,
    "entity_name": "Nairobi",
    "entity_type": "county",
    "year": 2024,
    "total_population": 4500000,
    "male_population": 2200000,
    "female_population": 2300000,
    "urban_population": 4000000,
    "rural_population": 500000,
    "population_density": 5200.5,
    "confidence": 0.95,
    "source_document_id": 42,
    "created_at": "2025-10-11T10:00:00"
  }
]
```

#### Example Requests

```bash
# Get all population data
GET /api/v1/economic/population

# Get Nairobi county population data
GET /api/v1/economic/population?entity_id=1

# Get national population for 2024
GET /api/v1/economic/population?year=2024&entity_id=null

# Get population trends 2020-2024
GET /api/v1/economic/population?start_year=2020&end_year=2024

# Get high-confidence data only
GET /api/v1/economic/population?min_confidence=0.9
```

---

### 2. Get GDP Data

**GET** `/api/v1/economic/gdp`

Get national GDP and Gross County Product (GCP) data.

#### Query Parameters

| Parameter        | Type    | Required | Description                                         |
| ---------------- | ------- | -------- | --------------------------------------------------- |
| `entity_id`      | integer | No       | NULL for national GDP, county ID for GCP            |
| `year`           | integer | No       | Filter by specific year                             |
| `quarter`        | string  | No       | Filter by quarter (Q1, Q2, Q3, Q4)                  |
| `start_year`     | integer | No       | Start year for range query                          |
| `end_year`       | integer | No       | End year for range query                            |
| `min_confidence` | float   | No       | Minimum confidence score (0-1), default: 0.7        |
| `limit`          | integer | No       | Maximum results to return (max: 1000), default: 100 |

#### Response Model

```json
[
  {
    "id": 1,
    "entity_id": null,
    "entity_name": null,
    "entity_type": "national",
    "year": 2024,
    "quarter": "Q2",
    "gdp_value": 13500000000000.0,
    "gdp_growth_rate": 5.2,
    "currency": "KES",
    "confidence": 0.98,
    "source_document_id": 45,
    "created_at": "2025-10-11T10:00:00"
  }
]
```

#### Example Requests

```bash
# Get national GDP
GET /api/v1/economic/gdp?entity_id=null

# Get Nairobi GCP
GET /api/v1/economic/gdp?entity_id=1

# Get Q2 2024 GDP
GET /api/v1/economic/gdp?year=2024&quarter=Q2

# Get GDP trend 2020-2024
GET /api/v1/economic/gdp?start_year=2020&end_year=2024
```

---

### 3. Get Economic Indicators

**GET** `/api/v1/economic/indicators`

Get economic indicators including CPI, PPI, inflation, and unemployment rates.

#### Query Parameters

| Parameter        | Type    | Required | Description                                         |
| ---------------- | ------- | -------- | --------------------------------------------------- |
| `indicator_type` | string  | No       | CPI, PPI, inflation_rate, unemployment_rate         |
| `entity_id`      | integer | No       | NULL for national, county ID for county-level       |
| `start_date`     | string  | No       | Start date for range query (YYYY-MM-DD)             |
| `end_date`       | string  | No       | End date for range query (YYYY-MM-DD)               |
| `min_confidence` | float   | No       | Minimum confidence score (0-1), default: 0.7        |
| `limit`          | integer | No       | Maximum results to return (max: 1000), default: 100 |

#### Response Model

```json
[
  {
    "id": 1,
    "indicator_type": "inflation_rate",
    "indicator_date": "2024-09-01T00:00:00",
    "value": 4.6,
    "entity_id": null,
    "entity_name": null,
    "entity_type": "national",
    "unit": "percent",
    "confidence": 0.99,
    "source_document_id": 48,
    "created_at": "2025-10-11T10:00:00"
  }
]
```

#### Example Requests

```bash
# Get all economic indicators
GET /api/v1/economic/indicators

# Get inflation rates only
GET /api/v1/economic/indicators?indicator_type=inflation_rate

# Get CPI for 2024
GET /api/v1/economic/indicators?indicator_type=CPI&start_date=2024-01-01&end_date=2024-12-31

# Get unemployment rates
GET /api/v1/economic/indicators?indicator_type=unemployment_rate
```

---

### 4. Get Poverty Indices

**GET** `/api/v1/economic/poverty`

Get poverty indices including poverty rates and Gini coefficients.

#### Query Parameters

| Parameter        | Type    | Required | Description                                         |
| ---------------- | ------- | -------- | --------------------------------------------------- |
| `entity_id`      | integer | No       | Filter by entity ID (county or national)            |
| `year`           | integer | No       | Filter by specific year                             |
| `start_year`     | integer | No       | Start year for range query                          |
| `end_year`       | integer | No       | End year for range query                            |
| `min_confidence` | float   | No       | Minimum confidence score (0-1), default: 0.7        |
| `limit`          | integer | No       | Maximum results to return (max: 1000), default: 100 |

#### Response Model

```json
[
  {
    "id": 1,
    "entity_id": null,
    "entity_name": null,
    "entity_type": "national",
    "year": 2022,
    "poverty_headcount_rate": 39.8,
    "extreme_poverty_rate": 18.5,
    "gini_coefficient": 0.42,
    "confidence": 0.92,
    "source_document_id": 50,
    "created_at": "2025-10-11T10:00:00"
  }
]
```

#### Example Requests

```bash
# Get national poverty indices
GET /api/v1/economic/poverty?entity_id=null

# Get county poverty data
GET /api/v1/economic/poverty?entity_id=17

# Get poverty trends 2015-2024
GET /api/v1/economic/poverty?start_year=2015&end_year=2024
```

---

### 5. Get County Economic Profile

**GET** `/api/v1/economic/counties/{county_id}/profile`

Get comprehensive economic profile for a specific county including population, GCP, poverty, indicators, and calculated metrics.

#### Path Parameters

| Parameter   | Type    | Required | Description      |
| ----------- | ------- | -------- | ---------------- |
| `county_id` | integer | Yes      | County entity ID |

#### Response Model

```json
{
  "county_id": 1,
  "county_name": "Nairobi",
  "latest_population": {
    "id": 1,
    "entity_id": 1,
    "entity_name": "Nairobi",
    "entity_type": "county",
    "year": 2024,
    "total_population": 4500000,
    "male_population": 2200000,
    "female_population": 2300000,
    "urban_population": 4000000,
    "rural_population": 500000,
    "population_density": 5200.5,
    "confidence": 0.95,
    "source_document_id": 42,
    "created_at": "2025-10-11T10:00:00"
  },
  "latest_gcp": {
    "id": 10,
    "entity_id": 1,
    "entity_name": "Nairobi",
    "entity_type": "county",
    "year": 2024,
    "quarter": "Q2",
    "gdp_value": 3500000000000.0,
    "gdp_growth_rate": 6.2,
    "currency": "KES",
    "confidence": 0.96,
    "source_document_id": 45,
    "created_at": "2025-10-11T10:00:00"
  },
  "latest_poverty": {
    "id": 5,
    "entity_id": 1,
    "entity_name": "Nairobi",
    "entity_type": "county",
    "year": 2022,
    "poverty_headcount_rate": 22.5,
    "extreme_poverty_rate": 8.2,
    "gini_coefficient": 0.48,
    "confidence": 0.9,
    "source_document_id": 50,
    "created_at": "2025-10-11T10:00:00"
  },
  "economic_indicators": [
    {
      "id": 20,
      "indicator_type": "unemployment_rate",
      "indicator_date": "2024-06-01T00:00:00",
      "value": 12.5,
      "entity_id": 1,
      "entity_name": "Nairobi",
      "entity_type": "county",
      "unit": "percent",
      "confidence": 0.88,
      "source_document_id": 52,
      "created_at": "2025-10-11T10:00:00"
    }
  ],
  "per_capita_gcp": 777777.78,
  "population_growth_rate": 2.8
}
```

#### Example Request

```bash
# Get Nairobi county profile
GET /api/v1/economic/counties/1/profile

# Get Makueni county profile
GET /api/v1/economic/counties/17/profile
```

---

### 6. Get National Economic Summary

**GET** `/api/v1/economic/summary`

Get high-level national economic summary with latest available data.

#### Response Model

```json
{
  "total_population": 53330978,
  "total_gdp": 13500000000000.0,
  "gdp_growth_rate": 5.2,
  "inflation_rate": 4.6,
  "unemployment_rate": 7.8,
  "poverty_rate": 39.8,
  "data_as_of": "2025-10-11T18:00:00"
}
```

#### Example Request

```bash
# Get national summary
GET /api/v1/economic/summary
```

---

## Common Response Codes

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Success                                      |
| 400  | Bad Request (invalid parameters)             |
| 404  | Not Found (county doesn't exist)             |
| 503  | Service Unavailable (database not available) |

---

## Data Quality

All endpoints support filtering by confidence score using the `min_confidence` parameter:

- **0.9-1.0**: High confidence (primary sources, official publications)
- **0.7-0.89**: Medium confidence (derived calculations, estimates)
- **Below 0.7**: Low confidence (filtered out by default)

---

## Integration Examples

### Per-Capita Budget Analysis

```python
import httpx

async def get_per_capita_budget(county_id: int):
    """Calculate per-capita budget allocation for a county."""

    # Get county economic profile
    profile_response = await httpx.get(
        f"http://localhost:8000/api/v1/economic/counties/{county_id}/profile"
    )
    profile = profile_response.json()

    # Get county budget
    budget_response = await httpx.get(
        f"http://localhost:8000/api/v1/counties/{county_id}/budget"
    )
    budget = budget_response.json()

    # Calculate per-capita metrics
    population = profile["latest_population"]["total_population"]
    total_budget = budget["total_allocation"]

    per_capita_budget = total_budget / population

    return {
        "county_name": profile["county_name"],
        "population": population,
        "total_budget": total_budget,
        "per_capita_budget": per_capita_budget,
        "per_capita_gcp": profile["per_capita_gcp"],
        "budget_to_gcp_ratio": (total_budget / profile["latest_gcp"]["gdp_value"]) * 100
    }
```

### County Comparison Dashboard

```python
async def compare_counties(county_ids: list[int]):
    """Compare economic profiles across multiple counties."""

    profiles = []
    for county_id in county_ids:
        response = await httpx.get(
            f"http://localhost:8000/api/v1/economic/counties/{county_id}/profile"
        )
        profiles.append(response.json())

    return {
        "counties": [
            {
                "name": p["county_name"],
                "population": p["latest_population"]["total_population"],
                "gcp": p["latest_gcp"]["gdp_value"],
                "per_capita_gcp": p["per_capita_gcp"],
                "poverty_rate": p["latest_poverty"]["poverty_headcount_rate"],
                "population_growth": p["population_growth_rate"]
            }
            for p in profiles
        ]
    }
```

---

## Rate Limiting

No rate limiting currently implemented. Be respectful with API usage.

---

## Data Sources

All data sourced from Kenya National Bureau of Statistics (KNBS):

- Economic Survey (annual, May)
- Statistical Abstract (annual, December)
- Quarterly GDP Reports
- Monthly CPI/Inflation Reports
- County Statistical Abstracts
- Facts and Figures

---

## Support

For issues or questions:

- Check `/docs` for interactive API documentation
- Review KNBS_IMPLEMENTATION_PROGRESS.md for technical details
- Contact API maintainers

---

## Version History

- **v1.0** (Oct 2025): Initial release with 6 endpoints
  - Population data
  - GDP/GCP data
  - Economic indicators
  - Poverty indices
  - County profiles
  - National summary
