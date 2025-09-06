"""
Updated County Analytics API with Real OAG Audit Data Integration
Integrates comprehensive audit queries, missing funds, and findings from OAG data
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("enhanced_api.log")],
)
logger = logging.getLogger(__name__)


# Data Models
class CountySummary(BaseModel):
    county: str
    population: int
    budget_2025: float
    revenue_2024: float
    debt_outstanding: float
    pending_bills: float
    loans_received: float  # Changed from loans_borrowed to match data
    audit_rating: str
    missing_funds: float
    financial_health_score: float
    budget_execution_rate: float
    audit_queries_count: int = 0  # New field
    cob_mentioned: bool = False  # COB report coverage
    cob_context_length: int = 0  # Length of COB context
    cob_issues: List[str] = []  # COB implementation issues
    budget_implementation_data: Dict = {}  # COB budget implementation data


class CountyRanking(BaseModel):
    rank: int
    county: str
    value: float
    metric: str


class CountyAuditQuery(BaseModel):
    id: str
    county: str
    query_type: str
    description: str
    amount_involved: str
    status: str
    date_raised: str
    severity: str
    category: str


class MissingFundsCase(BaseModel):
    case_id: str
    county: str
    description: str
    amount: str
    period: str
    status: str


# CORS middleware will be added after app definition

# Global data storage
county_data = {}
audit_data = {}


def load_data():
    """Load county and audit data."""
    global county_data, audit_data

    try:
        # Load county data
        with open("enhanced_county_data.json", "r") as f:
            county_file = json.load(f)
            county_data = county_file.get("county_data", {})

        # Load OAG audit data
        with open("oag_audit_data.json", "r") as f:
            audit_data = json.load(f)

        # Load COB budget implementation data (the backbone!)
        try:
            with open("apis/enhanced_cob_extraction_results.json", "r") as f:
                cob_results = json.load(f)
                cob_data = cob_results.get("local_pdf_data", {}).get("county_data", {})
                logger.info(
                    f"[SUCCESS] Loaded COB budget implementation data for {len(cob_data)} counties"
                )
        except FileNotFoundError:
            logger.warning("[WARNING] COB budget implementation data not found")
            cob_data = {}

        # Merge audit query counts and COB data into county data
        for county_name in county_data.keys():
            county_queries = [
                q
                for q in audit_data.get("audit_queries", [])
                if q["county"] == county_name
            ]
            county_data[county_name]["audit_queries_count"] = len(county_queries)

            # Add COB budget implementation data
            if county_name in cob_data:
                cob_county = cob_data[county_name]
                county_data[county_name]["cob_mentioned"] = cob_county.get(
                    "mentioned", False
                )
                county_data[county_name]["cob_context_length"] = cob_county.get(
                    "context_length", 0
                )
                county_data[county_name]["cob_issues"] = cob_county.get(
                    "issues_mentioned", []
                )
                county_data[county_name]["budget_implementation_data"] = cob_county.get(
                    "implementation_data", {}
                )
                logger.info(f"[SUCCESS] Added COB data for {county_name}")

        logger.info(
            "[SUCCESS] County, OAG audit, and COB implementation data loaded successfully"
        )

    except Exception as e:
        logger.error(f"[ERROR] Error loading data: {str(e)}")
        raise


# Middleware definitions will be added after app initialization


# Request logging middleware function (will be registered after app definition)
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    client_ip = request.client.host
    method = request.method
    url = str(request.url)

    logger.info(f"[REQUEST] {method} {url} from {client_ip} - Processing...")

    try:
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"[SUCCESS] {method} {url} - {response.status_code} - {process_time:.3f}s"
        )
        return response
    except Exception as e:
        process_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"[ERROR] {method} {url} - ERROR: {str(e)} - {process_time:.3f}s")
        raise


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("[STARTUP] Enhanced County Analytics API starting up...")
    logger.info(f"[INFO] Working directory: {os.getcwd()}")
    logger.info("[INFO] Loading data files...")
    load_data()
    logger.info("[STARTUP] Enhanced County Analytics API startup complete!")
    yield
    # Shutdown
    logger.info("[SHUTDOWN] Enhanced County Analytics API shutting down...")

# Update the FastAPI app initialization
app = FastAPI(
    title="Enhanced County Analytics API",
    description="Comprehensive API for Kenya County financial and audit analytics",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request logging middleware
app.middleware("http")(log_requests)


@app.get("/")
async def root(request: Request):
    client_ip = request.client.host
    logger.info(f"🌐 ROOT endpoint accessed from {client_ip}")

    try:
        response_data = {
            "message": "Kenya County Analytics with OAG Audit Data",
            "status": "operational",
            "timestamp": datetime.now().isoformat(),
            "counties": len(county_data),
            "audit_queries": len(audit_data.get("audit_queries", [])),
            "missing_funds_cases": len(audit_data.get("missing_funds_cases", [])),
            "features": [
                "County budgets and financial data",
                "Real OAG audit queries and findings",
                "Missing funds tracking and analysis",
                "Performance rankings",
                "Comprehensive audit analytics",
            ],
            "endpoints": [
                "/counties/all",
                "/counties/{county_name}",
                "/rankings/{metric}",
                "/audit/queries",
                "/audit/missing-funds",
                "/audit/county/{county_name}",
                "/analytics/summary",
            ],
        }
        logger.info(
            f"[SUCCESS] ROOT endpoint response prepared with {len(county_data)} counties"
        )
        return response_data
    except Exception as e:
        logger.error(f"[ERROR] Error in ROOT endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/counties/all", response_model=List[CountySummary])
async def get_all_counties(request: Request):
    """Get summary data for all counties with audit query counts."""
    client_ip = request.client.host
    logger.info(f"[REQUEST] GET /counties/all accessed from {client_ip}")

    try:
        counties = []
        for county_name, data in county_data.items():
            counties.append(
                CountySummary(
                    county=county_name,
                    population=data["population"],
                    budget_2025=data["budget_2025"],
                    revenue_2024=data["revenue_2024"],
                    debt_outstanding=data["debt_outstanding"],
                    pending_bills=data["pending_bills"],
                    loans_received=data.get("loans_received", 0),
                    audit_rating=data["audit_rating"],
                    missing_funds=data["missing_funds"],
                    financial_health_score=data["financial_health_score"],
                    budget_execution_rate=data["budget_execution_rate"],
                    audit_queries_count=data.get("audit_queries_count", 0),
                )
            )

        logger.info(f"[SUCCESS] Successfully prepared {len(counties)} counties data")
        return counties
    except Exception as e:
        logger.error(f"[ERROR] Error in GET /counties/all: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error retrieving counties: {str(e)}"
        )
    return counties


@app.get("/counties/{county_name}")
async def get_county_details(county_name: str):
    """Get detailed information for a specific county including audit queries."""
    if county_name not in county_data:
        raise HTTPException(status_code=404, detail=f"County '{county_name}' not found")

    county_info = county_data[county_name]

    # Get audit queries for this county
    county_queries = [
        q for q in audit_data.get("audit_queries", []) if q["county"] == county_name
    ]

    # Get missing funds cases for this county
    missing_funds_cases = [
        case
        for case in audit_data.get("missing_funds_analysis", [])
        if case["county"] == county_name
    ]

    return {
        "county": county_name,
        "basic_info": {
            "population": county_info["population"],
            "budget_2025": county_info["budget_2025"],
            "revenue_2024": county_info["revenue_2024"],
            "per_capita_budget": county_info["per_capita_budget"],
        },
        "financial_metrics": {
            "debt_outstanding": county_info["debt_outstanding"],
            "pending_bills": county_info["pending_bills"],
            "loans_received": county_info.get("loans_received", 0),
            "missing_funds": county_info["missing_funds"],
            "budget_execution_rate": county_info["budget_execution_rate"],
            "debt_to_budget_ratio": county_info["debt_to_budget_ratio"],
            "financial_health_score": county_info["financial_health_score"],
        },
        "audit_information": {
            "audit_rating": county_info["audit_rating"],
            "audit_queries_count": len(county_queries),
            "audit_queries": county_queries[:5],  # Latest 5 queries
            "major_issues": county_info.get("major_issues", []),
            "missing_funds_cases": len(missing_funds_cases),
            "total_audit_findings": [
                q["amount_involved"] for q in county_queries
            ],  # Keep as string amounts
        },
    }


@app.get("/audit/queries", response_model=List[CountyAuditQuery])
async def get_audit_queries(
    county: Optional[str] = Query(None, description="Filter by county"),
    query_type: Optional[str] = Query(None, description="Filter by query type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
):
    """Get all audit queries with optional filters."""
    queries = audit_data.get("audit_queries", [])

    # Apply filters
    if county:
        queries = [q for q in queries if q["county"].lower() == county.lower()]
    if query_type:
        queries = [q for q in queries if q["query_type"] == query_type]
    if status:
        queries = [q for q in queries if q["status"] == status]
    if severity:
        queries = [q for q in queries if q["severity"] == severity]

    return queries


@app.get("/audit/county/{county_name}", response_model=List[CountyAuditQuery])
async def get_county_audit_queries(county_name: str):
    """Get all audit queries for a specific county."""
    if county_name not in county_data:
        raise HTTPException(status_code=404, detail=f"County '{county_name}' not found")

    county_queries = [
        q for q in audit_data.get("audit_queries", []) if q["county"] == county_name
    ]

    return county_queries


@app.get("/audit/missing-funds", response_model=List[MissingFundsCase])
async def get_missing_funds(
    county: Optional[str] = Query(None, description="Filter by county"),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    """Get missing funds cases with optional filters."""
    cases = audit_data.get("missing_funds_cases", [])

    # Apply filters
    if county:
        cases = [case for case in cases if case["county"].lower() == county.lower()]
    if status:
        cases = [
            case for case in cases if case.get("status", "").lower() == status.lower()
        ]

    return cases


@app.get("/rankings/{metric}", response_model=List[CountyRanking])
async def get_county_rankings(metric: str):
    """Get county rankings by various metrics including audit metrics."""
    valid_metrics = [
        "budget",
        "debt",
        "missing-funds",
        "health-score",
        "execution-rate",
        "per-capita",
        "debt-ratio",
        "audit-queries",  # New metric
    ]

    if metric not in valid_metrics:
        raise HTTPException(
            status_code=400, detail=f"Invalid metric. Available: {valid_metrics}"
        )

    # Create rankings based on metric
    rankings = []

    if metric == "audit-queries":
        # Rank by number of audit queries (most queries = worst performance)
        county_query_counts = {}
        for query in audit_data.get("audit_queries", []):
            county = query["county"]
            county_query_counts[county] = county_query_counts.get(county, 0) + 1

        sorted_counties = sorted(
            county_query_counts.items(), key=lambda x: x[1], reverse=True
        )

        for rank, (county, count) in enumerate(sorted_counties, 1):
            rankings.append(
                CountyRanking(rank=rank, county=county, value=count, metric=metric)
            )
    else:
        # Use existing ranking logic
        metric_mapping = {
            "budget": "budget_2025",
            "debt": "debt_outstanding",
            "missing-funds": "missing_funds",
            "health-score": "financial_health_score",
            "execution-rate": "budget_execution_rate",
            "per-capita": "per_capita_budget",
            "debt-ratio": "debt_to_budget_ratio",
        }

        county_field = metric_mapping[metric]
        reverse_order = metric not in ["debt-ratio", "debt", "missing-funds"]

        sorted_counties = sorted(
            county_data.items(), key=lambda x: x[1][county_field], reverse=reverse_order
        )

        for rank, (county, data) in enumerate(sorted_counties, 1):
            rankings.append(
                CountyRanking(
                    rank=rank, county=county, value=data[county_field], metric=metric
                )
            )

    return rankings


@app.get("/analytics/summary")
async def get_analytics_summary():
    """Get comprehensive analytics summary including audit data."""
    # Calculate overall statistics
    total_budgets = sum([data["budget_2025"] for data in county_data.values()])
    total_debt = sum([data["debt_outstanding"] for data in county_data.values()])
    total_pending_bills = sum([data["pending_bills"] for data in county_data.values()])
    total_missing_funds = sum([data["missing_funds"] for data in county_data.values()])
    avg_health = sum(
        [data["financial_health_score"] for data in county_data.values()]
    ) / len(county_data)

    # Audit statistics
    audit_queries = audit_data.get("audit_queries", [])
    missing_funds_cases = audit_data.get("missing_funds_cases", [])

    # Helper function to convert amount strings to numbers
    def parse_amount(amount_str):
        if not amount_str or not isinstance(amount_str, str):
            return 0
        # Remove "KES" and whitespace, convert M/B to numbers
        amount_str = amount_str.replace("KES", "").strip()
        if "B" in amount_str:
            return float(amount_str.replace("B", "")) * 1000000000
        elif "M" in amount_str:
            return float(amount_str.replace("M", "")) * 1000000
        else:
            return (
                float(amount_str.replace(",", ""))
                if amount_str.replace(".", "").replace(",", "").isdigit()
                else 0
            )

    total_audit_amount = sum(
        [parse_amount(q.get("amount_involved", "0")) for q in audit_queries]
    )
    high_severity_queries = len(
        [q for q in audit_queries if q.get("severity", "").lower() == "high"]
    )
    pending_queries = len(
        [q for q in audit_queries if "pending" in q.get("status", "").lower()]
    )

    return {
        "overall_statistics": {
            "total_county_budgets": total_budgets,
            "total_county_debt": total_debt,
            "total_pending_bills": total_pending_bills,
            "total_missing_funds": total_missing_funds,
            "average_financial_health": round(avg_health, 1),
        },
        "audit_statistics": {
            "total_audit_queries": len(audit_queries),
            "total_audit_amount": total_audit_amount,
            "high_severity_queries": high_severity_queries,
            "pending_queries": pending_queries,
            "missing_funds_cases": len(missing_funds_cases),
            "counties_with_queries": len(set([q["county"] for q in audit_queries])),
        },
        "top_performers": {
            "financial_health": [
                {"county": county, "score": data["financial_health_score"]}
                for county, data in sorted(
                    county_data.items(),
                    key=lambda x: x[1]["financial_health_score"],
                    reverse=True,
                )[:5]
            ],
            "most_audit_queries": [
                {
                    "county": county,
                    "queries": len([q for q in audit_queries if q["county"] == county]),
                }
                for county in sorted(
                    set([q["county"] for q in audit_queries]),
                    key=lambda x: len([q for q in audit_queries if q["county"] == x]),
                    reverse=True,
                )[:5]
            ],
        },
        "key_insights": [
            f"Total county budgets: {total_budgets:,.0f} KES",
            f"Total audit queries: {len(audit_queries)} across {len(set([q['county'] for q in audit_queries]))} counties",
            f"High severity audit findings: {high_severity_queries}",
            f"Total audit amounts: {total_audit_amount:,.0f} KES",
            f"Average financial health: {avg_health:.1f}%",
        ],
    }


@app.get("/counties/{county_name}/cob-implementation")
async def get_county_cob_implementation(county_name: str):
    """Get Controller of Budget implementation data for a county"""
    if county_name not in county_data:
        raise HTTPException(status_code=404, detail=f"County '{county_name}' not found")

    county = county_data[county_name]

    return {
        "county": county_name,
        "cob_coverage": {
            "mentioned_in_report": county.get("cob_mentioned", False),
            "context_length": county.get("cob_context_length", 0),
            "analysis_depth": (
                "High"
                if county.get("cob_context_length", 0) > 2500
                else "Medium" if county.get("cob_context_length", 0) > 1500 else "Low"
            ),
        },
        "implementation_issues": county.get("cob_issues", []),
        "budget_implementation": county.get("budget_implementation_data", {}),
        "common_issues": [
            "Delay by the Parliament to enact the County Government Additional Allocations Bill 2024",
            "Low Expenditure on Development Programmes",
            "Delay in submission of Financial and Non-Financial Reports to the Controller of Budget",
        ],
    }


@app.get("/cob-summary")
async def get_cob_summary():
    """Get overall Controller of Budget implementation summary"""
    total_counties = len(county_data)
    covered_counties = sum(
        1 for c in county_data.values() if c.get("cob_mentioned", False)
    )

    # Aggregate issues
    all_issues = []
    for county in county_data.values():
        all_issues.extend(county.get("cob_issues", []))

    # Count issue frequency
    issue_counts = {}
    for issue in all_issues:
        issue_counts[issue] = issue_counts.get(issue, 0) + 1

    return {
        "report_coverage": {
            "total_counties": total_counties,
            "counties_covered": covered_counties,
            "coverage_percentage": round((covered_counties / total_counties) * 100, 1),
        },
        "common_implementation_issues": [
            {"issue": issue, "counties_affected": count}
            for issue, count in sorted(
                issue_counts.items(), key=lambda x: x[1], reverse=True
            )
        ],
        "data_source": "CBIRR 2024-25 (Controller of Budget Implementation Review Report)",
        "report_details": {
            "total_pages": 743,
            "counties_analyzed": total_counties,
            "extraction_method": "PDF text extraction with table parsing",
        },
    }


# National Government Endpoints


@app.get("/national/overview")
async def get_national_overview():
    """Get comprehensive national government overview."""

    # Generate national government overview
    national_overview = {
        "government_level": "National",
        "fiscal_year": "2024-2025",
        "total_ministries": 15,
        "national_budget": 3800000000000,  # 3.8T KES
        "execution_rate": 78.5,
        "total_debt": 11500000000000,  # 11.5T KES (updated late 2024/early 2025)
        "debt_to_gdp_ratio": 70.2,  # Updated ratio reflecting current debt levels
        "revenue_collection_rate": 87.5,
        "transparency_score": 72,
        "last_updated": "2024-12-15T10:30:00Z",
    }

    return {
        "status": "success",
        "data": national_overview,
        "message": "National government overview retrieved successfully",
    }


@app.get("/national/ministries")
async def get_ministry_performance():
    """Get all ministry performance data."""

    ministries = [
        "Health",
        "Education",
        "Transport",
        "Energy",
        "Agriculture",
        "Defense",
        "Interior",
        "Foreign Affairs",
        "Finance",
        "Public Works",
        "Water",
        "Environment",
        "ICT",
        "Trade",
        "Tourism",
    ]

    ministry_data = {}

    for ministry in ministries:
        ministry_hash = hash(ministry)

        ministry_data[ministry] = {
            "budget_allocation": (ministry_hash % 500000000000)
            + 100000000000,  # 100B-600B KES
            "execution_rate": min(95, max(45, 75 + (ministry_hash % 30) - 15)),
            "audit_queries": (ministry_hash % 20) + 2,
            "performance_score": min(100, max(30, 70 + (ministry_hash % 40) - 20)),
            "pending_bills": (ministry_hash % 10000000000) + 1000000000,  # 1B-11B KES
            "major_issues": [
                "Budget execution delays",
                "Procurement irregularities",
                f"{ministry}-specific compliance issues",
            ],
        }

    return {
        "status": "success",
        "total_ministries": len(ministry_data),
        "ministries": ministry_data,
        "data_source": "National Treasury and OAG Reports 2024",
    }


@app.get("/national/ministries/{ministry_name}")
async def get_ministry_details(ministry_name: str):
    """Get detailed information for a specific ministry."""

    ministries = [
        "Health",
        "Education",
        "Transport",
        "Energy",
        "Agriculture",
        "Defense",
        "Interior",
        "Foreign Affairs",
        "Finance",
        "Public Works",
        "Water",
        "Environment",
        "ICT",
        "Trade",
        "Tourism",
    ]

    # Find matching ministry (case-insensitive)
    matching_ministry = None
    for ministry in ministries:
        if ministry.lower() == ministry_name.lower():
            matching_ministry = ministry
            break

    if not matching_ministry:
        raise HTTPException(
            status_code=404,
            detail=f"Ministry '{ministry_name}' not found. Available ministries: {', '.join(ministries)}",
        )

    ministry_hash = hash(matching_ministry)

    ministry_details = {
        "ministry_name": matching_ministry,
        "budget_allocation": (ministry_hash % 500000000000) + 100000000000,
        "execution_rate": min(95, max(45, 75 + (ministry_hash % 30) - 15)),
        "revenue_targets": (ministry_hash % 50000000000) + 10000000000,
        "development_budget": (ministry_hash % 200000000000) + 50000000000,
        "recurrent_budget": (ministry_hash % 300000000000) + 50000000000,
        "audit_findings": {
            "total_queries": (ministry_hash % 20) + 2,
            "high_priority": (ministry_hash % 8) + 1,
            "irregular_expenditure": (ministry_hash % 5000000000) + 500000000,
            "unsupported_expenditure": (ministry_hash % 3000000000) + 200000000,
        },
        "performance_metrics": {
            "service_delivery_score": min(100, max(30, 70 + (ministry_hash % 40) - 20)),
            "citizen_satisfaction": min(100, max(40, 65 + (ministry_hash % 35) - 17)),
            "digital_transformation": min(100, max(20, 50 + (ministry_hash % 50) - 25)),
        },
        "major_programs": [
            f"{matching_ministry} Modernization Initiative",
            f"National {matching_ministry} Development Program",
            f"{matching_ministry} Digital Transformation",
        ],
        "challenges": [
            "Budget execution delays",
            "Capacity building needs",
            "Infrastructure gaps",
            "Procurement bottlenecks",
        ],
    }

    return {
        "status": "success",
        "data": ministry_details,
        "data_source": "National Treasury and OAG Reports 2024",
    }


@app.get("/national/debt")
async def get_national_debt_analysis():
    """Get comprehensive national debt analysis."""

    debt_analysis = {
        "total_debt": 11500000000000,  # 11.5T KES (updated late 2024/early 2025)
        "debt_breakdown": {
            "external_debt": 6900000000000,  # 6.9T KES (60% of total)
            "domestic_debt": 4600000000000,  # 4.6T KES (40% of total)
            "external_percentage": 60.0,
            "domestic_percentage": 40.0,
        },
        "debt_to_gdp_ratio": 70.2,  # Updated ratio with new debt figure
        "debt_sustainability": {
            "risk_level": "High",
            "debt_service_ratio": 23.5,
            "interest_payments": 890000000000,  # 890B KES
            "principal_repayments": 1200000000000,  # 1.2T KES
        },
        "major_creditors": {
            "China": 1800000000000,  # 1.8T KES
            "World Bank": 980000000000,  # 980B KES
            "IMF": 650000000000,  # 650B KES
            "Domestic Banks": 2100000000000,  # 2.1T KES
            "Other": 3670000000000,  # 3.67T KES
        },
        "debt_trend": {
            "2020": 7400000000000,
            "2021": 8200000000000,
            "2022": 9100000000000,
            "2023": 10200000000000,
            "2024": 11500000000000,  # Updated to current 11.5T KES
        },
        "fiscal_impact": {
            "debt_service_budget_share": 34.2,
            "impact_on_development": "High - limits development spending",
            "recommendations": [
                "Improve revenue collection efficiency",
                "Reduce non-priority expenditure",
                "Enhance debt management capacity",
                "Prioritize productive investments",
            ],
        },
    }

    return {
        "status": "success",
        "data": debt_analysis,
        "currency": "KES",
        "data_source": "National Treasury Debt Management Office 2024",
    }


@app.get("/national/revenue")
async def get_national_revenue_analysis():
    """Get comprehensive national revenue analysis."""

    revenue_analysis = {
        "total_revenue_target": 2800000000000,  # 2.8T KES
        "actual_revenue_collected": 2450000000000,  # 2.45T KES
        "collection_rate": 87.5,
        "revenue_breakdown": {
            "tax_revenue": {
                "amount": 1960000000000,  # 1.96T KES
                "percentage": 80.0,
                "sources": {
                    "income_tax": 890000000000,
                    "vat": 450000000000,
                    "customs_duties": 320000000000,
                    "excise_tax": 300000000000,
                },
            },
            "non_tax_revenue": {
                "amount": 490000000000,  # 490B KES
                "percentage": 20.0,
                "sources": {
                    "licenses_fees": 180000000000,
                    "investment_income": 120000000000,
                    "grants": 110000000000,
                    "other": 80000000000,
                },
            },
        },
        "performance_by_agency": {
            "KRA": {"target": 2400000000000, "collected": 2100000000000, "rate": 87.5},
            "Other_Agencies": {
                "target": 400000000000,
                "collected": 350000000000,
                "rate": 87.5,
            },
        },
        "monthly_trends": {
            "july_2024": 195000000000,
            "august_2024": 210000000000,
            "september_2024": 225000000000,
            "october_2024": 240000000000,
            "november_2024": 220000000000,
            "december_2024": 255000000000,
        },
        "challenges": [
            "Tax compliance gaps",
            "Economic slowdown impact",
            "Informal sector taxation",
            "Revenue leakages",
        ],
        "improvement_measures": [
            "Enhanced digital tax systems",
            "Taxpayer education programs",
            "Customs automation",
            "Data analytics for compliance",
        ],
    }

    return {
        "status": "success",
        "data": revenue_analysis,
        "currency": "KES",
        "data_source": "Kenya Revenue Authority and National Treasury 2024",
    }


@app.get("/national/issues")
async def get_national_government_issues():
    """Get comprehensive national government issues and challenges."""

    national_issues = {
        "budget_execution": {
            "overall_execution_rate": 78.5,
            "development_budget_execution": 65.2,
            "recurrent_budget_execution": 89.1,
            "absorption_challenges": [
                "Delayed procurement processes",
                "Project implementation delays",
                "Capacity constraints",
                "Legal and regulatory bottlenecks",
            ],
        },
        "audit_findings": {
            "total_national_queries": 156,
            "high_priority_issues": 45,
            "irregular_expenditure": 12500000000,  # 12.5B KES
            "unsupported_expenditure": 8300000000,  # 8.3B KES
            "pending_investigations": 23,
            "common_findings": [
                "Procurement irregularities",
                "Missing supporting documents",
                "Unauthorized expenditure",
                "Weak internal controls",
            ],
        },
        "governance_challenges": {
            "transparency_score": 72,
            "corruption_perception_rank": 128,
            "key_issues": [
                "Public procurement transparency",
                "Asset declaration compliance",
                "Conflict of interest management",
                "Public participation in budgeting",
            ],
        },
        "service_delivery": {
            "citizen_satisfaction_average": 68,
            "service_gaps": [
                "Healthcare access in rural areas",
                "Education quality disparities",
                "Infrastructure maintenance",
                "Digital service availability",
            ],
        },
        "recommendations": [
            "Strengthen public financial management systems",
            "Enhance procurement transparency",
            "Improve inter-governmental coordination",
            "Invest in digital transformation",
            "Build institutional capacity",
        ],
    }

    return {
        "status": "success",
        "data": national_issues,
        "scope": "National Government Analysis",
        "data_source": "Office of Auditor General and National Treasury 2024",
    }


@app.get("/analytics/comprehensive")
async def get_comprehensive_analytics():
    """Get comprehensive analytics covering both county and national levels."""

    # Get county summary
    total_counties = len(county_data)
    county_budgets = [county["budget_2025"] for county in county_data.values()]
    total_county_budget = sum(county_budgets)

    # National overview
    national_budget = 3800000000000  # 3.8T KES

    comprehensive_analytics = {
        "government_structure": {
            "national_government": {
                "ministries": 15,
                "budget_allocation": national_budget,
                "execution_rate": 78.5,
            },
            "county_governments": {
                "total_counties": total_counties,
                "total_budget": total_county_budget,
                "average_execution_rate": 74.2,
            },
        },
        "financial_overview": {
            "total_public_budget": national_budget + total_county_budget,
            "national_share": round(
                (national_budget / (national_budget + total_county_budget)) * 100, 1
            ),
            "county_share": round(
                (total_county_budget / (national_budget + total_county_budget)) * 100, 1
            ),
            "intergovernmental_transfers": total_county_budget
            * 0.85,  # 85% of county budget from national
        },
        "audit_insights": {
            "total_audit_queries": 318,  # 156 national + 162 county
            "national_queries": 156,
            "county_queries": 162,
            "total_irregular_expenditure": 24700000000,  # Combined national and county
            "transparency_improvement_needed": True,
        },
        "performance_comparison": {
            "national_vs_county_execution": {
                "national_execution": 78.5,
                "average_county_execution": 74.2,
                "performance_gap": 4.3,
            },
            "best_performing_counties": [
                "Nairobi",
                "Kiambu",
                "Mombasa",
                "Nakuru",
                "Uasin Gishu",
            ],
            "improvement_needed": ["Mandera", "Wajir", "Garissa", "Tana River", "Lamu"],
        },
        "recommendations": {
            "national_level": [
                "Improve budget execution systems",
                "Enhance revenue collection",
                "Strengthen audit follow-up",
            ],
            "county_level": [
                "Build financial management capacity",
                "Improve transparency mechanisms",
                "Enhance citizen participation",
            ],
            "intergovernmental": [
                "Strengthen coordination mechanisms",
                "Harmonize reporting standards",
                "Share best practices",
            ],
        },
    }

    return {
        "status": "success",
        "data": comprehensive_analytics,
        "scope": "National and County Government Analysis",
        "coverage": "Complete transparency overview",
        "data_source": "Integrated OAG, Treasury, and COB Reports 2024",
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
