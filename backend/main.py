import asyncio
import datetime
import importlib
import logging
import os
import random
import re
import smtplib
import sys
import time
from email.mime.text import MIMEText
from email.utils import formatdate
from typing import Any, Dict, List, Optional, Tuple

import httpx  # For internal API calls
import uvicorn
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pydantic import BaseModel

try:
    import boto3  # type: ignore
except Exception:
    boto3 = None  # type: ignore

# Import database and models if available; otherwise fall back to mocks
DATABASE_AVAILABLE = False
DBAudit = None
DBEntity = None
DBFiscalPeriod = None
DBSourceDocument = None


def get_db():  # default stub; may be overridden below if real DB is present
    return None


try:  # Try to wire real DB and models when available
    # Lazy imports so that local dev without DB still works
    from database import get_db as _real_get_db  # type: ignore
    from models import Audit as _DBAudit  # type: ignore
    from models import Entity as _DBEntity
    from models import FiscalPeriod as _DBFiscalPeriod
    from models import SourceDocument as _DBSourceDocument

    # Bind real references
    get_db = _real_get_db  # type: ignore
    DBAudit = _DBAudit
    DBEntity = _DBEntity
    DBFiscalPeriod = _DBFiscalPeriod
    DBSourceDocument = _DBSourceDocument
    DATABASE_AVAILABLE = True
except Exception:
    # Stay in mock mode
    DATABASE_AVAILABLE = False


# County ID to Name mapping
COUNTY_MAPPING = {
    "001": "Nairobi",
    "002": "Kwale",
    "003": "Kilifi",
    "004": "Tana River",
    "005": "Lamu",
    "006": "Taita Taveta",
    "007": "Garissa",
    "008": "Wajir",
    "009": "Mandera",
    "010": "Marsabit",
    "011": "Isiolo",
    "012": "Meru",
    "013": "Tharaka Nithi",
    "014": "Embu",
    "015": "Kitui",
    "016": "Machakos",
    "017": "Makueni",
    "018": "Nyandarua",
    "019": "Nyeri",
    "020": "Kirinyaga",
    "021": "Murang'a",
    "022": "Kiambu",
    "023": "Turkana",
    "024": "West Pokot",
    "025": "Samburu",
    "026": "Trans Nzoia",
    "027": "Uasin Gishu",
    "028": "Elgeyo Marakwet",
    "029": "Nandi",
    "030": "Baringo",
    "031": "Laikipia",
    "032": "Nakuru",
    "033": "Narok",
    "034": "Kajiado",
    "035": "Kericho",
    "036": "Bomet",
    "037": "Kakamega",
    "038": "Vihiga",
    "039": "Bungoma",
    "040": "Busia",
    "041": "Siaya",
    "042": "Kisumu",
    "043": "Homa Bay",
    "044": "Migori",
    "045": "Kisii",
    "046": "Nyamira",
    "047": "Mombasa",
}

# Reverse mapping for backend to frontend ID conversion
NAME_TO_ID_MAPPING = {v: k for k, v in COUNTY_MAPPING.items()}

# Enhanced County Analytics API base URL
ENHANCED_COUNTY_API_BASE = "http://localhost:8003"


class InternalAPIClient:
    """Client for making internal API calls to other services"""

    # simple in-memory TTL cache to reduce flakiness and repeated fetches during a session
    _cache: Dict[str, Dict[str, Any]] = {}
    _ttl_seconds = 6 * 60 * 60  # 6 hours

    @classmethod
    def _cache_get(cls, key: str):
        rec = cls._cache.get(key)
        if not rec:
            return None
        if time.time() - rec["ts"] > cls._ttl_seconds:
            cls._cache.pop(key, None)
            return None
        return rec["value"]

    @classmethod
    def _cache_set(cls, key: str, value: Any):
        cls._cache[key] = {"value": value, "ts": time.time()}

    @staticmethod
    async def get_county_data(county_name: str) -> Optional[Dict]:
        """Fetch county data from Enhanced County Analytics API"""
        try:
            cache_key = f"county_data:{county_name}"
            cached = InternalAPIClient._cache_get(cache_key)
            if cached is not None:
                return cached
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ENHANCED_COUNTY_API_BASE}/counties/{county_name}"
                )
                if response.status_code == 200:
                    data = response.json()
                    InternalAPIClient._cache_set(cache_key, data)
                    return data
                return None
        except Exception as e:
            logging.error(f"Error fetching county data for {county_name}: {e}")
            return None

    @staticmethod
    async def get_all_counties() -> Optional[List[Dict]]:
        """Fetch all counties data from Enhanced County Analytics API"""
        try:
            cache_key = "counties:all"
            cached = InternalAPIClient._cache_get(cache_key)
            if cached is not None:
                return cached
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{ENHANCED_COUNTY_API_BASE}/counties/all")
                if response.status_code == 200:
                    data = response.json()
                    InternalAPIClient._cache_set(cache_key, data)
                    return data
                return None
        except Exception as e:
            logging.error(f"Error fetching all counties data: {e}")
            return None

    @staticmethod
    async def get_county_financial_data(county_name: str) -> Optional[Dict]:
        """Fetch county financial data from Enhanced County Analytics API"""
        try:
            cache_key = f"county_financial:{county_name}"
            cached = InternalAPIClient._cache_get(cache_key)
            if cached is not None:
                return cached
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ENHANCED_COUNTY_API_BASE}/counties/{county_name}/financial"
                )
                if response.status_code == 200:
                    data = response.json()
                    InternalAPIClient._cache_set(cache_key, data)
                    return data
                return None
        except Exception as e:
            logging.error(f"Error fetching financial data for {county_name}: {e}")
            return None

    @staticmethod
    async def get_county_audit_queries(county_name: str) -> Optional[List[Dict]]:
        """Fetch all audit queries for a county from Enhanced API"""
        try:
            cache_key = f"audit_queries:{county_name}"
            cached = InternalAPIClient._cache_get(cache_key)
            if cached is not None:
                return cached
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ENHANCED_COUNTY_API_BASE}/audit/county/{county_name}"
                )
                if response.status_code == 200:
                    data = response.json()
                    InternalAPIClient._cache_set(cache_key, data)
                    return data
                return None
        except Exception as e:
            logging.error(f"Error fetching audit queries for {county_name}: {e}")
            return None

    @staticmethod
    async def get_missing_funds(county_name: str) -> Optional[List[Dict]]:
        """Fetch missing funds cases for a county from Enhanced API"""
        try:
            cache_key = f"missing_funds:{county_name}"
            cached = InternalAPIClient._cache_get(cache_key)
            if cached is not None:
                return cached
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ENHANCED_COUNTY_API_BASE}/audit/missing-funds",
                    params={"county": county_name},
                )
                if response.status_code == 200:
                    data = response.json()
                    InternalAPIClient._cache_set(cache_key, data)
                    return data
                return None
        except Exception as e:
            logging.error(f"Error fetching missing funds for {county_name}: {e}")
            return None

    @staticmethod
    async def get_cob_implementation(county_name: str) -> Optional[Dict]:
        """Fetch COB implementation info for a county from Enhanced API"""
        try:
            cache_key = f"cob_impl:{county_name}"
            cached = InternalAPIClient._cache_get(cache_key)
            if cached is not None:
                return cached
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ENHANCED_COUNTY_API_BASE}/counties/{county_name}/cob-implementation"
                )
                if response.status_code == 200:
                    data = response.json()
                    InternalAPIClient._cache_set(cache_key, data)
                    return data
                return None
        except Exception as e:
            logging.error(f"Error fetching COB implementation for {county_name}: {e}")
            return None


def transform_county_data_for_frontend(backend_data: Dict, county_id: str) -> Dict:
    """Transform backend county data to match frontend expectations"""
    if not backend_data:
        return {"id": county_id}

    # Extract data from the actual API response structure
    basic_info = backend_data.get("basic_info", {})
    financial_metrics = backend_data.get("financial_metrics", {})
    audit_info = backend_data.get("audit_information", {})

    # Derive commonly used fields for the frontend
    name = backend_data.get("county", "")
    population = basic_info.get("population") or backend_data.get("population", 0)
    budget_2025 = basic_info.get("budget_2025") or backend_data.get("budget_2025", 0)
    revenue_2024 = basic_info.get("revenue_2024") or backend_data.get("revenue_2024", 0)

    return {
        "id": county_id,
        "name": name,
        "population": population or 0,
        # Commonly referenced budget fields in the UI
        "budget_2025": budget_2025 or 0,
        "totalBudget": budget_2025 or 0,
        # Optional UI fields with safe defaults
        "audit_rating": audit_info.get("audit_rating")
        or backend_data.get("audit_rating"),
        "financial_health_score": financial_metrics.get("financial_health_score")
        or backend_data.get("financial_health_score"),
        "budgetUtilization": financial_metrics.get("budget_execution_rate"),
        "pendingBills": financial_metrics.get("pending_bills"),
        "developmentBudget": backend_data.get("development_budget"),
        "recurrentBudget": backend_data.get("recurrent_budget"),
        "education": backend_data.get("education"),
        "health": backend_data.get("health"),
        "infrastructure": backend_data.get("infrastructure"),
        # Keep projects if available
        "projects": backend_data.get("development_projects", []),
        # Keep raw values occasionally used elsewhere
        "revenue_2024": revenue_2024 or 0,
    }


# Model imports - temporarily disabled due to database issues
# from models import (
#     Allocation, Annotation, Audit, BudgetLine, Country,
#     Document, Entity, FiscalPeriod, Loan, SourceDocument, User,
# )

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("main_backend.log")],
)
logger = logging.getLogger(__name__)

# Add ETL module to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "etl"))

# Instead of importing ETL modules directly (which have dependency issues),
# we'll create a simple ETL function that works independently
ETL_AVAILABLE = True


def run_simple_kenya_etl():
    """Simple Kenya ETL function that doesn't rely on complex imports."""
    import json

    import requests
    from bs4 import BeautifulSoup

    results = {
        "documents_fetched": 0,
        "documents_processed": 0,
        "entities_found": [],
        "sources_checked": [],
    }

    # Test Kenya Treasury website
    try:
        response = requests.get("https://treasury.go.ke", timeout=10)
        if response.status_code == 200:
            results["sources_checked"].append(
                {
                    "source": "Kenya National Treasury",
                    "status": "accessible",
                    "status_code": response.status_code,
                }
            )
            results["documents_fetched"] += 1
        else:
            results["sources_checked"].append(
                {
                    "source": "Kenya National Treasury",
                    "status": "error",
                    "status_code": response.status_code,
                }
            )
    except Exception as e:
        results["sources_checked"].append(
            {
                "source": "Kenya National Treasury",
                "status": "unreachable",
                "error": str(e),
            }
        )

    # Mock some entities that would be extracted
    results["entities_found"] = [
        {"name": "Ministry of Health", "type": "ministry", "code": "MOH"},
        {"name": "Ministry of Education", "type": "ministry", "code": "MOE"},
        {"name": "National Treasury", "type": "ministry", "code": "NT"},
    ]
    results["documents_processed"] = len(results["entities_found"])

    return results


def get_current_user():
    """Mock authentication dependency."""
    return {"id": 1, "username": "admin"}


# Response models using Pydantic
class CountryResponse(BaseModel):
    id: int
    name: str
    iso_code: str
    currency: str
    summary: Dict[str, Any]


class EntityResponse(BaseModel):
    id: int
    canonical_name: str
    type: str
    code: Optional[str] = None
    total_budget: Optional[float] = None
    total_spending: Optional[float] = None
    audit_count: Optional[int] = None


class DocumentResponse(BaseModel):
    id: int
    title: str
    source_url: str
    content_type: str
    verification_status: str


class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total_count: int
    page: int
    per_page: int


class BudgetLineResponse(BaseModel):
    id: int
    description: str
    allocated_amount: float
    actual_spent: float
    entity_id: int


class ETLJobResponse(BaseModel):
    job_id: str
    status: str
    country: str
    started_at: str
    completed_at: Optional[str] = None
    documents_processed: int
    errors: List[str]


class ETLStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Dict[str, Any]
    last_updated: str


class AuditListItem(BaseModel):
    id: Any
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    amountLabel: Optional[str] = None
    fiscal_year: Optional[str] = None
    source: Dict[str, Any]


class AuditListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[AuditListItem]


# Mock data models for development
class MockCountry:
    def __init__(self, id, name, iso_code, currency):
        self.id = id
        self.name = name
        self.iso_code = iso_code
        self.currency = currency


class MockEntity:
    def __init__(self, id, canonical_name, type, code, country_id=1):
        self.id = id
        self.canonical_name = canonical_name
        self.type = type
        self.code = code
        self.country_id = country_id


class MockBudgetLine:
    def __init__(self, id, description, allocated_amount, actual_spent=0, entity_id=1):
        self.id = id
        self.description = description
        self.allocated_amount = allocated_amount
        self.actual_spent = actual_spent
        self.entity_id = entity_id


class MockDocument:
    def __init__(
        self,
        id,
        title,
        source_url,
        content_type="budget",
        verification_status="verified",
    ):
        self.id = id
        self.title = title
        self.source_url = source_url
        self.content_type = content_type
        self.verification_status = verification_status


# Mock Session and DocumentStatus for development
class Session:
    def query(self, model):
        return MockQuery()


class MockQuery:
    def filter(self, *args):
        return self

    def order_by(self, *args):
        return self

    def limit(self, n):
        return self

    def all(self):
        return []

    def first(self):
        return None


class DocumentStatus:
    PROCESSED = "processed"


# Mock aliases for compatibility
Country = MockCountry
Entity = MockEntity
BudgetLine = MockBudgetLine
SourceDocument = MockDocument


class MockAudit:
    def __init__(self, id=1, entity_id=1):
        self.id = id
        self.entity_id = entity_id


class MockFiscalPeriod:
    def __init__(self, id=1, start_date=None):
        import datetime as _dt

        self.id = id
        self.start_date = start_date or _dt.datetime(2024, 1, 1)


Audit = MockAudit
FiscalPeriod = MockFiscalPeriod

app = FastAPI(
    title="Government Financial Transparency API",
    description="API for accessing government budget, spending, and audit data with full provenance",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.datetime.now()
    client_ip = request.client.host
    method = request.method
    url = str(request.url)

    logger.info(f"PROCESSING {method} {url} from {client_ip} - Processing...")
    try:
        response = await call_next(request)
        process_time = (datetime.datetime.now() - start_time).total_seconds()
        logger.info(
            f"SUCCESS {method} {url} - {response.status_code} - {process_time:.3f}s"
        )
        return response
    except Exception as e:
        process_time = (datetime.datetime.now() - start_time).total_seconds()
        logger.error(f"ERROR {method} {url} - ERROR: {str(e)} - {process_time:.3f}s")
        raise


# Helper functions for provenance tracking
def _get_allocation_provenance(db: Session, country_id: int):
    """Get provenance information for budget allocations."""
    sources = (
        db.query(SourceDocument)
        .filter(
            SourceDocument.country_id == country_id,
            SourceDocument.status == DocumentStatus.PROCESSED,
        )
        .order_by(SourceDocument.fetch_date.desc())
        .limit(3)
        .all()
    )

    return [
        {
            "document_id": doc.id,
            "title": doc.title,
            "source_url": doc.source_url,
            "fetch_date": doc.fetch_date.isoformat(),
            "verification_status": doc.verification_status.value,
        }
        for doc in sources
    ]


def _get_spending_provenance(db: Session, country_id: int):
    """Get provenance information for spending data."""
    sources = (
        db.query(SourceDocument)
        .filter(
            SourceDocument.country_id == country_id,
            SourceDocument.content_type.in_(["expenditure_report", "audit_report"]),
            SourceDocument.status == DocumentStatus.PROCESSED,
        )
        .order_by(SourceDocument.fetch_date.desc())
        .limit(3)
        .all()
    )

    return [
        {
            "document_id": doc.id,
            "title": doc.title,
            "source_url": doc.source_url,
            "fetch_date": doc.fetch_date.isoformat(),
            "verification_status": doc.verification_status.value,
        }
        for doc in sources
    ]


def _get_debt_provenance(db: Session, country_id: int):
    """Get provenance information for debt data."""
    sources = (
        db.query(SourceDocument)
        .filter(
            SourceDocument.country_id == country_id,
            SourceDocument.content_type == "debt_report",
            SourceDocument.status == DocumentStatus.PROCESSED,
        )
        .order_by(SourceDocument.fetch_date.desc())
        .limit(3)
        .all()
    )

    return [
        {
            "document_id": doc.id,
            "title": doc.title,
            "source_url": doc.source_url,
            "fetch_date": doc.fetch_date.isoformat(),
            "verification_status": doc.verification_status.value,
        }
        for doc in sources
    ]


def _get_data_sources_summary(db: Session, country_id: int):
    """Get summary of data sources for a country."""
    from sqlalchemy import func

    source_summary = (
        db.query(
            SourceDocument.source_type,
            func.count(SourceDocument.id).label("count"),
            func.max(SourceDocument.fetch_date).label("latest_update"),
        )
        .filter(
            SourceDocument.country_id == country_id,
            SourceDocument.status == DocumentStatus.PROCESSED,
        )
        .group_by(SourceDocument.source_type)
        .all()
    )

    return [
        {
            "source_type": source_type,
            "document_count": count,
            "latest_update": latest_update.isoformat() if latest_update else None,
        }
        for source_type, count, latest_update in source_summary
    ]


security = HTTPBearer()


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize the main backend API."""
    logger.info("Main Backend API starting up...")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info("Initializing database connections...")
    logger.info("Main Backend API startup complete!")


@app.get("/")
async def root(request: Request):
    client_ip = request.client.host
    logger.info(f"Main backend root endpoint accessed from {client_ip}")

    try:
        response = {
            "message": "Government Financial Transparency API",
            "version": "1.0.0",
            "docs": "/docs",
            "status": "operational",
            "timestamp": datetime.datetime.now().isoformat(),
        }
        logger.info("Main backend root response prepared")
        return response
    except Exception as e:
        logger.error(f"Error in main backend root: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/v1/countries", response_model=List[CountryResponse])
async def get_countries(db: Session = Depends(get_db)):
    """Get list of all countries with summary metrics."""
    try:
        countries = db.query(Country).all()
        if not countries:
            # Return mock data if database is empty
            logger.info("🔄 No countries found in database, returning mock data")
            return [
                {
                    "id": 1,
                    "name": "Kenya",
                    "iso_code": "KEN",
                    "currency": "KES",
                    "summary": {
                        "total_entities": 47,
                        "total_budget": "25T KES",
                        "transparency_score": 75.5,
                    },
                }
            ]
        return countries
    except Exception as e:
        logger.error(f"Database error in get_countries: {str(e)}")
        # Return mock data on database error
        return [
            {
                "id": 1,
                "name": "Kenya",
                "iso_code": "KEN",
                "currency": "KES",
                "summary": {
                    "total_entities": 47,
                    "total_budget": "25T KES",
                    "transparency_score": 75.5,
                },
            }
        ]


@app.get("/api/v1/countries/{country_id}/summary")
async def get_country_summary(country_id: int):
    """Get detailed financial summary for a specific country."""
    # Use mock data for Kenya (country_id = 1)
    if country_id != 1:
        raise HTTPException(status_code=404, detail="Country not found")

    return {
        "country": {
            "id": 1,
            "name": "Kenya",
            "iso_code": "KE",
            "currency": "KES",
        },
        "financial_summary": {
            "total_allocation": {
                "value": 3200000000000.0,
                "currency": "KES",
                "provenance": [
                    {
                        "document_title": "National Budget 2023/24",
                        "url": "https://treasury.go.ke/budget/2023-24",
                        "fetch_date": "2024-01-15T08:00:00Z",
                    }
                ],
            },
            "total_spent": {
                "value": 2800000000000.0,
                "currency": "KES",
                "provenance": [
                    {
                        "document_title": "Q2 Expenditure Report 2023/24",
                        "url": "https://treasury.go.ke/reports/expenditure/q2-2023-24",
                        "fetch_date": "2024-01-10T14:30:00Z",
                    }
                ],
            },
            "execution_rate": {"value": 87.5, "unit": "percentage"},
            "total_debt": {
                "value": 8500000000000.0,
                "currency": "KES",
                "provenance": [
                    {
                        "document_title": "Public Debt Bulletin December 2023",
                        "url": "https://treasury.go.ke/debt/bulletin/dec-2023",
                        "fetch_date": "2024-01-05T09:15:00Z",
                    }
                ],
            },
        },
        "entity_breakdown": {"ministry": 25, "department": 12, "agency": 8},
        "recent_audits": [
            {
                "id": 1,
                "entity_name": "Ministry of Health",
                "severity": "medium",
                "finding_summary": "Budget variance of 15% identified in health infrastructure projects...",
            },
            {
                "id": 2,
                "entity_name": "Ministry of Education",
                "severity": "low",
                "finding_summary": "Minor documentation gaps in scholarship disbursements...",
            },
        ],
        "last_updated": "2024-01-15T10:30:00Z",
        "data_sources": {
            "budget_documents": 15,
            "expenditure_reports": 8,
            "audit_reports": 12,
            "debt_reports": 6,
        },
    }


# Consolidated County Endpoints - Using Enhanced County Analytics API
@app.get("/api/v1/counties")
async def get_counties():
    """Get all counties with basic information"""
    try:
        # Fetch from Enhanced County Analytics API
        backend_data = await InternalAPIClient.get_all_counties()

        if not backend_data:
            # Fallback to basic county list if API unavailable
            return [{"id": id, "name": name} for id, name in COUNTY_MAPPING.items()]

        # Transform data for frontend
        counties = []
        for county_data in backend_data:
            # For /counties/all endpoint, the data structure is different - it's flatter
            county_name = county_data.get("county", "")
            county_id = NAME_TO_ID_MAPPING.get(county_name, "")

            if county_id:
                # Create a simplified response for the list view
                counties.append(
                    {
                        "id": county_id,
                        "name": county_name,
                        "population": county_data.get("population", 0),
                        "budget_2025": county_data.get("budget_2025", 0),
                        "financial_health_score": county_data.get(
                            "financial_health_score", 0
                        ),
                        "audit_rating": county_data.get("audit_rating", ""),
                    }
                )

        return counties

    except Exception as e:
        logging.error(f"Error in get_counties: {e}")
        # Fallback response
        return [{"id": id, "name": name} for id, name in COUNTY_MAPPING.items()]


@app.get("/api/v1/counties/{county_id}")
async def get_county_details(county_id: str):
    """Get detailed information for a specific county"""
    try:
        # Convert frontend ID to backend name
        county_name = COUNTY_MAPPING.get(county_id)
        if not county_name:
            raise HTTPException(status_code=404, detail="County not found")

        # Fetch from Enhanced County Analytics API
        backend_data = await InternalAPIClient.get_county_data(county_name)

        if not backend_data:
            raise HTTPException(status_code=404, detail="County data not available")

        # Transform data for frontend
        return transform_county_data_for_frontend(backend_data, county_id)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching county {county_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/counties/{county_id}/financial")
async def get_county_financial_data(county_id: str):
    """Get financial data for a specific county"""
    try:
        # Convert frontend ID to backend name
        county_name = COUNTY_MAPPING.get(county_id)
        if not county_name:
            raise HTTPException(status_code=404, detail="County not found")

        # Fetch from Enhanced County Analytics API
        backend_data = await InternalAPIClient.get_county_financial_data(county_name)

        if not backend_data:
            # Try the general county endpoint as fallback
            backend_data = await InternalAPIClient.get_county_data(county_name)
            if backend_data:
                backend_data = backend_data.get("financial_data", {})

        if not backend_data:
            raise HTTPException(status_code=404, detail="Financial data not available")

        return {
            "county_id": county_id,
            "county_name": county_name,
            "financial_data": backend_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching financial data for county {county_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/counties/{county_id}/budget")
async def get_county_budget(county_id: str):
    """Get budget information for a specific county"""
    try:
        county_name = COUNTY_MAPPING.get(county_id)
        if not county_name:
            raise HTTPException(status_code=404, detail="County not found")

        backend_data = await InternalAPIClient.get_county_data(county_name)
        if not backend_data:
            raise HTTPException(status_code=404, detail="County data not available")

        financial_data = backend_data.get("financial_data", {})
        budget_data = {
            "county_id": county_id,
            "county_name": county_name,
            "budget_2025": financial_data.get("budget_2025", 0),
            "budget_execution_rate": financial_data.get("budget_execution_rate", 0),
            "revenue_2024": financial_data.get("revenue_2024", 0),
            "expenditure_breakdown": financial_data.get("expenditure_breakdown", {}),
            "budget_allocation": financial_data.get("budget_allocation", {}),
        }

        return budget_data

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching budget for county {county_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/counties/{county_id}/debt")
async def get_county_debt(county_id: str):
    """Get debt information for a specific county"""
    try:
        county_name = COUNTY_MAPPING.get(county_id)
        if not county_name:
            raise HTTPException(status_code=404, detail="County not found")

        backend_data = await InternalAPIClient.get_county_data(county_name)
        if not backend_data:
            raise HTTPException(status_code=404, detail="County data not available")

        financial_data = backend_data.get("financial_data", {})
        debt_data = {
            "county_id": county_id,
            "county_name": county_name,
            "debt_outstanding": financial_data.get("debt_outstanding", 0),
            "debt_to_revenue_ratio": financial_data.get("debt_to_revenue_ratio", 0),
            "debt_breakdown": financial_data.get("debt_breakdown", {}),
            "debt_sustainability": financial_data.get("debt_sustainability", "unknown"),
        }

        return debt_data

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching debt for county {county_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/counties/{county_id}/audits")
async def get_county_audits(county_id: str):
    """Get audit information for a specific county"""
    try:
        county_name = COUNTY_MAPPING.get(county_id)
        if not county_name:
            raise HTTPException(status_code=404, detail="County not found")

        # Fetch data from Enhanced API
        county_details, audit_queries, missing_funds, cob_impl = (
            await InternalAPIClient.get_county_data(county_name),
            await InternalAPIClient.get_county_audit_queries(county_name),
            await InternalAPIClient.get_missing_funds(county_name),
            await InternalAPIClient.get_cob_implementation(county_name),
        )

        if not county_details:
            raise HTTPException(status_code=404, detail="County data not available")

        # Safe defaults
        audit_queries = audit_queries or []
        missing_funds = missing_funds or []
        audit_info = county_details.get("audit_information", {})
        financial_metrics = county_details.get("financial_metrics", {})

        # Helper to parse KES amount strings like "KES 2.5B" / "KES 800M"
        def parse_amount(amount_str: Any) -> float:
            try:
                if amount_str is None:
                    return 0.0
                if isinstance(amount_str, (int, float)):
                    return float(amount_str)
                s = str(amount_str).upper().replace("KES", "").strip()
                s = s.replace(",", "")
                if s.endswith("B"):
                    return float(s[:-1]) * 1_000_000_000
                if s.endswith("M"):
                    return float(s[:-1]) * 1_000_000
                return float(s)
            except Exception:
                return 0.0

        # Aggregate audit queries
        total_amount = sum(
            parse_amount(q.get("amount_involved")) for q in audit_queries
        )
        by_severity: Dict[str, int] = {}
        by_status: Dict[str, int] = {}
        by_category: Dict[str, int] = {}
        for q in audit_queries:
            by_severity[q.get("severity", "unknown")] = (
                by_severity.get(q.get("severity", "unknown"), 0) + 1
            )
            by_status[q.get("status", "unknown")] = (
                by_status.get(q.get("status", "unknown"), 0) + 1
            )
            by_category[q.get("category", "other")] = (
                by_category.get(q.get("category", "other"), 0) + 1
            )

        # Top recent issues by date
        def _date_key(q: Dict) -> str:
            return q.get("date_raised", "0000-01-01")

        top_recent = sorted(audit_queries, key=_date_key, reverse=True)[:5]

        # Missing funds aggregation
        missing_total = sum(parse_amount(c.get("amount")) for c in missing_funds)
        notable_cases = [
            {
                "case_id": c.get("case_id"),
                "description": c.get("description"),
                "amount": parse_amount(c.get("amount")),
                "amount_label": c.get("amount"),
                "period": c.get("period"),
                "status": c.get("status"),
            }
            for c in missing_funds
        ]

        # COB implementation
        cob_summary = {
            "coverage": {
                "mentioned_in_report": False,
                "context_length": 0,
                "analysis_depth": "Low",
            },
            "issues": [],
            "budget_implementation": {},
        }
        if cob_impl:
            cov = cob_impl.get("cob_coverage", {})
            cob_summary = {
                "coverage": {
                    "mentioned_in_report": cov.get("mentioned_in_report", False),
                    "context_length": cov.get("context_length", 0),
                    "analysis_depth": cov.get("analysis_depth", "Low"),
                },
                "issues": cob_impl.get("implementation_issues", []),
                "budget_implementation": cob_impl.get("budget_implementation", {}),
            }

        response = {
            "county_id": county_id,
            "county_name": county_name,
            "summary": {
                "queries_count": len(audit_queries),
                "total_amount_involved": total_amount,
                "by_severity": by_severity,
                "by_status": by_status,
                "by_category": by_category,
            },
            "top_recent": top_recent,
            "queries": audit_queries,
            "missing_funds": {
                "count": len(missing_funds),
                "total_amount": missing_total,
                "cases": notable_cases,
            },
            "cob_implementation": cob_summary,
            "kpis": {
                "budget_execution_rate": financial_metrics.get("budget_execution_rate"),
                "pending_bills": financial_metrics.get("pending_bills"),
                "financial_health_score": financial_metrics.get(
                    "financial_health_score"
                ),
            },
        }

        return response

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching audit info for county {county_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/counties/{county_id}/audits/history")
async def get_county_audits_history(county_id: str):
    """Historical audit queries grouped by fiscal year with quick aggregates."""
    try:
        county_name = COUNTY_MAPPING.get(county_id)
        if not county_name:
            raise HTTPException(status_code=404, detail="County not found")

        audit_queries = await InternalAPIClient.get_county_audit_queries(county_name)
        audit_queries = audit_queries or []

        # Group by year if available on 'period' or 'date_raised'
        def year_of(q: Dict) -> str:
            p = q.get("period") or q.get("fiscal_year") or q.get("fiscal_period")
            if isinstance(p, str) and re.search(r"\d{4}/\d{2}", p):
                return p
            d = q.get("date_raised")
            if isinstance(d, str) and len(d) >= 4 and d[:4].isdigit():
                y = int(d[:4])
                return f"FY{y}/{str((y+1))[-2:]}"
            return "Unknown"

        groups: Dict[str, List[Dict]] = {}
        for q in audit_queries:
            y = year_of(q)
            groups.setdefault(y, []).append(q)

        by_year = []
        for y, qs in sorted(groups.items(), reverse=True):
            by_status: Dict[str, int] = {}
            for q in qs:
                by_status[q.get("status", "unknown")] = (
                    by_status.get(q.get("status", "unknown"), 0) + 1
                )
            by_year.append(
                {
                    "fiscal_year": y,
                    "count": len(qs),
                    "by_status": by_status,
                }
            )

        return {
            "county_id": county_id,
            "county_name": county_name,
            "years": by_year,
            "total": len(audit_queries),
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching audit history for county {county_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/counties/{county_id}/audits/list", response_model=AuditListResponse)
async def list_county_audits(
    county_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    year: Optional[str] = Query(None, description="Fiscal year e.g. FY2022/23"),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Paginated audit queries with filters. DB-backed when available; falls back to Enhanced API."""
    try:
        county_name = COUNTY_MAPPING.get(county_id)
        if not county_name:
            raise HTTPException(status_code=404, detail="County not found")

        # DB-backed path
        if DATABASE_AVAILABLE and DBAudit and DBEntity and db:
            from sqlalchemy import func

            entity_ids = [
                e.id
                for e in db.query(DBEntity)
                .filter(DBEntity.canonical_name == county_name)
                .all()
            ]

            query = db.query(DBAudit)
            if entity_ids:
                query = query.filter(DBAudit.entity_id.in__(entity_ids))

            if year:
                if DBFiscalPeriod:
                    query = query.join(
                        DBFiscalPeriod, DBAudit.fiscal_period_id == DBFiscalPeriod.id
                    ).filter(DBFiscalPeriod.name == year)
                else:
                    try:
                        query = query.filter(DBAudit.fiscal_year == year)  # type: ignore[attr-defined]
                    except Exception:
                        pass

            if status:
                try:
                    query = query.filter(func.lower(DBAudit.status) == status.lower())  # type: ignore[attr-defined]
                except Exception:
                    pass
            if severity:
                try:
                    query = query.filter(func.lower(DBAudit.severity) == severity.lower())  # type: ignore[attr-defined]
                except Exception:
                    pass

            total = query.count()
            try:
                query = query.order_by(DBAudit.created_at.desc())  # type: ignore[attr-defined]
            except Exception:
                pass
            audits = query.offset((page - 1) * limit).limit(limit).all()

            items: List[Dict[str, Any]] = []
            for a in audits:
                url = None
                title = None
                page_ref = None
                table_index = None
                try:
                    if hasattr(a, "source_document") and a.source_document:
                        url = getattr(a.source_document, "source_url", None)
                        title = getattr(a.source_document, "title", None)
                    page_ref = getattr(a, "page", None)
                    table_index = getattr(a, "table_index", None)
                except Exception:
                    pass

                fy = None
                try:
                    if (
                        hasattr(a, "fiscal_period")
                        and a.fiscal_period
                        and getattr(a.fiscal_period, "name", None)
                    ):
                        fy = a.fiscal_period.name
                    elif hasattr(a, "fiscal_year"):
                        fy = getattr(a, "fiscal_year")
                except Exception:
                    fy = None

                desc = None
                try:
                    desc = getattr(a, "finding_text", None) or getattr(
                        a, "description", None
                    )
                except Exception:
                    desc = None

                amount_label = None
                try:
                    amount_label = getattr(a, "amount_label", None) or getattr(
                        a, "amount", None
                    )
                except Exception:
                    amount_label = None

                items.append(
                    {
                        "id": a.id,
                        "description": desc,
                        "severity": getattr(a, "severity", None),
                        "status": getattr(a, "status", None),
                        "category": getattr(a, "category", None),
                        "amountLabel": amount_label,
                        "fiscal_year": fy,
                        "source": {
                            "title": title,
                            "url": url,
                            "page": page_ref,
                            "table_index": table_index,
                        },
                    }
                )

            return {"total": total, "page": page, "limit": limit, "items": items}

        # Fallback path: Enhanced API data filtered in-memory
        audit_queries = await InternalAPIClient.get_county_audit_queries(county_name)
        items = audit_queries or []

        def to_year(q: Dict) -> str:
            p = q.get("period") or q.get("fiscal_year") or q.get("fiscal_period")
            if isinstance(p, str) and re.search(r"\d{4}/\d{2}", p):
                return p
            d = q.get("date_raised")
            if isinstance(d, str) and len(d) >= 4 and d[:4].isdigit():
                y = int(d[:4])
                return f"FY{y}/{str((y+1))[-2:]}"
            return "Unknown"

        if year:
            items = [q for q in items if to_year(q) == year]
        if status:
            items = [
                q for q in items if str(q.get("status", "")).lower() == status.lower()
            ]
        if severity:
            items = [
                q
                for q in items
                if str(q.get("severity", "")).lower() == severity.lower()
            ]

        total = len(items)
        start = (page - 1) * limit
        end = start + limit
        page_items = items[start:end]

        def map_item(q: Dict, idx: int) -> Dict[str, Any]:
            prov = q.get("provenance") or {}
            source = q.get("source") or {}
            url = source.get("url") or q.get("document_url")
            page_ref = prov.get("page") or source.get("page")
            return {
                "id": q.get("id") or f"{county_id}-{start+idx}",
                "description": q.get("description")
                or q.get("finding")
                or q.get("text"),
                "severity": q.get("severity"),
                "status": q.get("status"),
                "category": q.get("category"),
                "amountLabel": q.get("amount_involved") or q.get("amount"),
                "fiscal_year": to_year(q),
                "source": {
                    "title": source.get("title"),
                    "url": url,
                    "page": page_ref,
                    "table_index": prov.get("table_index") or source.get("table_index"),
                },
            }

        mapped = [map_item(q, i) for i, q in enumerate(page_items)]
        return {"total": total, "page": page, "limit": limit, "items": mapped}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing audit queries for {county_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/sources/status")
async def get_sources_status():
    """Summarize crawl status from ETL manifest and latest pipeline results file."""
    try:
        etl_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "etl"))
        downloads_dir = os.path.join(etl_dir, "downloads")
        manifest_path = os.path.join(downloads_dir, "processed_manifest.json")

        sources: Dict[str, Dict[str, Any]] = {}

        # From manifest
        if os.path.exists(manifest_path):
            import json as _json

            try:
                manifest = _json.loads(
                    open(manifest_path, "r", encoding="utf-8").read()
                )
            except Exception:
                manifest = {}
            for md5, rec in (manifest.get("by_md5") or {}).items():
                src = rec.get("source") or "unknown"
                s = sources.setdefault(src, {"documents": 0})
                s["documents"] = s.get("documents", 0) + 1
                s["last_fetched"] = max(
                    s.get("last_fetched", "1970-01-01T00:00:00"), rec.get("fetched", "")
                )

        # Latest pipeline results file
        latest_run = None
        if os.path.exists(downloads_dir):
            try:
                files = [
                    f
                    for f in os.listdir(downloads_dir)
                    if f.startswith("pipeline_results_")
                ]
                if files:
                    files.sort(reverse=True)
                    latest_file = os.path.join(downloads_dir, files[0])
                    import json as _json

                    latest_run = _json.loads(
                        open(latest_file, "r", encoding="utf-8").read()
                    )
                    for skey, res in (
                        latest_run.get("sources_processed") or {}
                    ).items():
                        s = sources.setdefault(skey, {})
                        s["last_run"] = {
                            "discovered": res.get("discovered", 0),
                            "processed": res.get("processed", 0),
                            "successful": res.get("successful", 0),
                        }
                        s["last_pipeline_run_at"] = latest_run.get("end_time")
            except Exception:
                pass

        # Flatten to list
        out = [
            {"source": name, **data}
            for name, data in sorted(sources.items(), key=lambda kv: kv[0].lower())
        ]
        return {"sources": out}
    except Exception as e:
        logging.error(f"Error reading source status: {e}")
        return {"sources": []}


async def _run_etl_for_source(source_key: str) -> Dict[str, Any]:
    """Discover and process a small batch for one source and write a run log file."""
    # Import lazily to avoid heavy deps on import time
    # Ensure project root is on sys.path so we can import the 'etl' package
    sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
    try:
        kp_mod = importlib.import_module("etl.kenya_pipeline")
        KenyaDataPipeline = getattr(kp_mod, "KenyaDataPipeline")
    except Exception as e:  # pragma: no cover
        logging.error(f"ETL import failed: {e}")
        return {"error": str(e)}

    pipeline = KenyaDataPipeline()
    discovered = pipeline.discover_budget_documents(source_key)
    processed = 0
    successful = 0
    for doc in discovered[:5]:
        result = await pipeline.download_and_process_document(doc)
        processed += 1
        if result:
            successful += 1
        # polite spacing
        await asyncio.sleep(2)

    run = {
        "source": source_key,
        "discovered": len(discovered),
        "processed": processed,
        "successful": successful,
        "ended_at": datetime.datetime.now().isoformat(),
    }

    # Write file-based run log
    try:
        etl_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "etl"))
        downloads_dir = os.path.join(etl_dir, "downloads")
        os.makedirs(downloads_dir, exist_ok=True)
        log_file = os.path.join(downloads_dir, "etl_run_logs.jsonl")
        with open(log_file, "a", encoding="utf-8") as f:
            import json as _json

            f.write(_json.dumps(run) + "\n")
    except Exception:
        pass

    return run


# ---------------- Scheduler + Notifications helpers ----------------
class AppSettings(BaseModel):
    smtp_host: Optional[str] = os.getenv("SMTP_HOST")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: Optional[str] = os.getenv("SMTP_USER")
    smtp_password: Optional[str] = os.getenv("SMTP_PASSWORD")
    notify_email_to: Optional[str] = os.getenv("NOTIFY_EMAIL_TO")
    environment: str = os.getenv("ENVIRONMENT", "development")
    aws_bucket: Optional[str] = os.getenv("AWS_BUCKET_NAME")
    aws_region: str = os.getenv("AWS_REGION", "us-east-1")


settings = AppSettings()

_s3_client = None
if boto3 and settings.aws_bucket:
    try:
        _s3_client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
    except Exception:
        _s3_client = None


def _artifact_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _artifact_dir() -> str:
    root = _artifact_root()
    path = os.path.join(root, "reports", datetime.datetime.now().strftime("%Y-%m-%d"))
    os.makedirs(path, exist_ok=True)
    return path


def _known_dir() -> str:
    root = _artifact_root()
    path = os.path.join(root, "reports", "known")
    os.makedirs(path, exist_ok=True)
    return path


def send_email(subject: str, body: str) -> None:
    if not (
        settings.smtp_host
        and settings.smtp_user
        and settings.smtp_password
        and settings.notify_email_to
    ):
        logger.info("Email not configured; skipping notification")
        return
    try:
        msg = MIMEText(body, _charset="utf-8")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_user
        msg["To"] = settings.notify_email_to
        msg["Date"] = formatdate(localtime=True)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(
                settings.smtp_user, [settings.notify_email_to], msg.as_string()
            )
    except Exception as e:
        logger.error(f"Failed to send email: {e}")


def _load_known_urls(path: str) -> set:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return set(line.strip() for line in f if line.strip())
    except Exception:
        return set()


def _save_known_urls(path: str, urls: set) -> None:
    try:
        with open(path, "w", encoding="utf-8") as f:
            for u in sorted(urls):
                f.write(u + "\n")
    except Exception as e:
        logger.error(f"Failed saving known urls: {e}")


def _load_known_hashes(path: str) -> Dict[str, str]:
    try:
        import json as _json

        with open(path, "r", encoding="utf-8") as f:
            data = _json.load(f)
            return {str(k): str(v) for k, v in data.items()}
    except Exception:
        return {}


def _save_known_hashes(path: str, mapping: Dict[str, str]) -> None:
    try:
        import json as _json

        with open(path, "w", encoding="utf-8") as f:
            _json.dump(mapping, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed saving known hashes: {e}")


async def _discover(source_key: str) -> List[Dict[str, Any]]:
    sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
    kp_mod = importlib.import_module("etl.kenya_pipeline")
    KenyaDataPipeline = getattr(kp_mod, "KenyaDataPipeline")
    pipeline = KenyaDataPipeline()
    return pipeline.discover_budget_documents(source_key)


async def _ingest_batch(
    source_key: str, docs: List[Dict[str, Any]], limit: int = 25
) -> Tuple[int, int, List[Dict[str, Any]]]:
    """Download/process up to limit docs; return (processed, successful, failures)."""
    sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
    kp_mod = importlib.import_module("etl.kenya_pipeline")
    KenyaDataPipeline = getattr(kp_mod, "KenyaDataPipeline")
    pipeline = KenyaDataPipeline()
    processed = 0
    successful = 0
    failures: List[Dict[str, Any]] = []
    for doc in docs[:limit]:
        try:
            ok = await pipeline.download_and_process_document(doc)
            processed += 1
            if ok:
                successful += 1
            else:
                failures.append({"doc": doc, "error": "process_failed"})
        except Exception as e:
            failures.append({"doc": doc, "error": str(e)})
        await asyncio.sleep(1)
    return processed, successful, failures


async def _run_job(source_key: str, job_type: str = "light") -> Dict[str, Any]:
    start = datetime.datetime.now()
    art_dir = _artifact_dir()
    known_path = os.path.join(_known_dir(), f"known_{source_key}.txt")
    known = _load_known_urls(known_path)
    known_hash_path = os.path.join(_known_dir(), f"known_{source_key}_hashes.json")
    known_hashes = _load_known_hashes(known_hash_path)

    discovered = await _discover(source_key)
    urls = [d.get("url") or d.get("file_url") for d in discovered]
    new_docs = [
        d for d in discovered if (d.get("url") or d.get("file_url")) not in known
    ]
    changed_docs: List[Dict[str, Any]] = []

    # Compute landing-page hashes for known URLs to detect changes
    async def _hash_url(u: str) -> Optional[str]:
        if not u:
            return None
        if re.search(r"\.(pdf|xlsx?|csv|docx?|zip)(?:$|\?)", u, re.I):
            return None
        try:
            timeout = httpx.Timeout(15.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.get(u, headers={"User-Agent": "Mozilla/5.0"})
                if "html" not in (r.headers.get("content-type", "").lower()):
                    return None
                text = r.text[:500_000]
                import hashlib as _h

                return _h.md5(text.encode("utf-8", errors="ignore")).hexdigest()
        except Exception:
            return None

    for d in discovered:
        u = d.get("url") or d.get("file_url")
        if not u or u not in known:
            continue
        prev = known_hashes.get(u)
        newh = await _hash_url(u)
        if newh and prev and newh != prev:
            changed_docs.append(d)
        if newh:
            known_hashes[u] = newh

    processed = successful = 0
    failures: List[Dict[str, Any]] = []

    if job_type == "deep":
        INGEST_LIMITS = {"treasury": 25, "cob": 20, "oag": 15}
        limit = INGEST_LIMITS.get(source_key, 25)
        processed, successful, failures = await _ingest_batch(
            source_key, new_docs, limit=limit
        )

    # Write artifacts
    import csv  # local import to avoid top-level cost
    import json

    tsv_path = os.path.join(art_dir, f"{source_key}_{job_type}_discovered.tsv")
    with open(tsv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(["Title", "URL"])
        for d in discovered:
            w.writerow(
                [
                    (d.get("title") or "").strip(),
                    d.get("url") or d.get("file_url"),
                ]
            )

    summary = {
        "source": source_key,
        "job_type": job_type,
        "started_at": start.isoformat(),
        "ended_at": datetime.datetime.now().isoformat(),
        "discovered": len(discovered),
        "new": len(new_docs),
        "changed": len(changed_docs),
        "processed": processed,
        "successful": successful,
        "failed": len(failures),
        "artifact_tsv": os.path.relpath(tsv_path, _artifact_root()),
    }

    json_path = os.path.join(art_dir, f"{source_key}_{job_type}_summary.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(
            {**summary, "failures": failures[:50]}, f, ensure_ascii=False, indent=2
        )

    # Update known
    _save_known_urls(known_path, set(u for u in urls if u))
    _save_known_hashes(known_hash_path, known_hashes)

    # Notify
    subject = f"[ETL {settings.environment}] {source_key.upper()} {job_type}: +{summary['new']} new, {summary['failed']} failed"
    top_new = "\n".join(
        [
            f"- {(d.get('title') or '').strip()} — {(d.get('url') or d.get('file_url'))}"
            for d in new_docs[:10]
        ]
    )
    top_fail = "\n".join(
        [
            f"- {(f.get('doc') or {}).get('url') or (f.get('doc') or {}).get('file_url')} :: {f.get('error')}"
            for f in failures[:10]
        ]
    )
    body = (
        f"Source: {source_key}\nJob: {job_type}\nDiscovered: {summary['discovered']}\nNew: {summary['new']}\nChanged: {summary['changed']}\n"
        f"Processed: {processed} (ok {successful}, failed {summary['failed']})\nArtifacts: {summary['artifact_tsv']}\n\n"
        f"New (top 10):\n{top_new or '—'}\n\nFailures (top 10):\n{top_fail or '—'}\n"
    )
    send_email(subject, body)

    logger.info(f"ETL job finished: {summary}")
    return summary


@app.post("/api/v1/admin/etl/run")
async def run_etl_job(
    source: str = Query(..., pattern="^(oag|cob|treasury)$"),
    job: str = Query("light", pattern="^(light|deep)$"),
):
    """Manually trigger an ETL job for a source (light or deep)."""
    return await _run_job(source, job)


@app.on_event("startup")
async def setup_scheduler():
    # keep prior startup logs
    logger.info("Main Backend API starting up...")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info("Initializing database connections...")
    logger.info("Main Backend API startup complete!")

    # Start background scheduler if available
    try:
        async_mod = importlib.import_module("apscheduler.schedulers.asyncio")
        AsyncIOScheduler = getattr(async_mod, "AsyncIOScheduler")
    except Exception:
        AsyncIOScheduler = None

    if not AsyncIOScheduler:
        logger.info("APScheduler not installed; skipping ETL scheduling.")
        return

    scheduler = AsyncIOScheduler()

    # Per-source intervals with jitter seconds
    def jitter(base_seconds: int, spread: int = 900) -> int:
        return max(60, base_seconds + random.randint(-spread, spread))

    # OAG: light weekly, deep monthly
    scheduler.add_job(
        _run_job,
        args=["oag", "light"],
        trigger="interval",
        seconds=jitter(7 * 24 * 3600),
        id="etl_oag_light",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        _run_job,
        args=["oag", "deep"],
        trigger="interval",
        seconds=jitter(30 * 24 * 3600),
        id="etl_oag_deep",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    # COB: light weekly, deep biweekly
    scheduler.add_job(
        _run_job,
        args=["cob", "light"],
        trigger="interval",
        seconds=jitter(7 * 24 * 3600),
        id="etl_cob_light",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        _run_job,
        args=["cob", "deep"],
        trigger="interval",
        seconds=jitter(14 * 24 * 3600),
        id="etl_cob_deep",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    # Treasury: light twice weekly (~3.5 days), deep weekly
    scheduler.add_job(
        _run_job,
        args=["treasury", "light"],
        trigger="interval",
        seconds=jitter(int(3.5 * 24 * 3600)),
        id="etl_treasury_light",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        _run_job,
        args=["treasury", "deep"],
        trigger="interval",
        seconds=jitter(7 * 24 * 3600),
        id="etl_treasury_deep",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    scheduler.start()

    # Weekly digest email (every 7 days)
    try:

        def _digest_wrapper():
            import asyncio as _asyncio

            _asyncio.get_event_loop().create_task(send_weekly_digest())

        scheduler.add_job(
            _digest_wrapper,
            trigger="interval",
            seconds=jitter(7 * 24 * 3600),
            id="etl_weekly_digest",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=3600,
        )
    except Exception as e:
        logger.warning(f"Failed to schedule weekly digest: {e}")


# ---------------- UX link resolver (original/mirrored) ----------------
def _manifest_file_path() -> str:
    # etl/downloads/processed_manifest.json relative to backend
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return os.path.join(root, "etl", "downloads", "processed_manifest.json")


def _load_manifest() -> Dict[str, Any]:
    try:
        path = _manifest_file_path()
        if os.path.exists(path):
            import json as _json

            with open(path, "r", encoding="utf-8") as f:
                return _json.load(f)
    except Exception as e:
        logger.error(f"Failed to load manifest: {e}")
    return {"by_md5": {}}


@app.get("/api/v1/docs/resolve")
async def resolve_document(url: str = Query(..., description="Original document URL")):
    """Resolve a document by original URL, returning original and mirrored (presigned) links if available."""
    man = _load_manifest()
    rec = None
    for md5, v in (man.get("by_md5") or {}).items():
        if (v.get("url") or "").strip() == url.strip():
            rec = v
            break
    if not rec:
        return {
            "original_url": url,
            "mirrored": False,
            "mirror_url": None,
            "local_path": None,
        }

    s3_key = rec.get("s3_key")
    presigned = None
    if s3_key and _s3_client and settings.aws_bucket:
        try:
            presigned = _s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.aws_bucket, "Key": s3_key},
                ExpiresIn=3600,
            )
        except Exception as e:
            logger.warning(f"Could not presign s3 object {s3_key}: {e}")

    return {
        "original_url": url,
        "mirrored": bool(s3_key and presigned),
        "mirror_url": presigned,
        "local_path": rec.get("file_path"),
        "title": rec.get("title"),
        "source": rec.get("source"),
        "doc_type": rec.get("doc_type"),
        "fetched": rec.get("fetched"),
    }


async def send_weekly_digest() -> None:
    """Email a weekly summary across sources based on the current known files and last summaries."""
    try:
        root = _artifact_root()
        reports_dir = os.path.join(root, "reports")
        # Find the latest summary files
        latest: Dict[str, Dict[str, Any]] = {}
        if os.path.isdir(reports_dir):
            for day in sorted(os.listdir(reports_dir), reverse=True)[
                :14
            ]:  # last 2 weeks
                day_dir = os.path.join(reports_dir, day)
                if not os.path.isdir(day_dir):
                    continue
                for name in os.listdir(day_dir):
                    if name.endswith("_summary.json"):
                        src = name.split("_")[0]
                        try:
                            import json as _json

                            with open(
                                os.path.join(day_dir, name), "r", encoding="utf-8"
                            ) as f:
                                latest[src] = _json.load(f)
                        except Exception:
                            pass
        lines = ["Weekly ETL Digest"]
        for src in sorted(latest.keys()):
            s = latest[src]
            lines.append(
                f"- {src.upper()}: discovered {s.get('discovered',0)}, new {s.get('new',0)}, processed {s.get('processed',0)} (ok {s.get('successful',0)}, failed {s.get('failed',0)})"
            )
        body = "\n".join(lines)
        send_email(f"[ETL {settings.environment}] Weekly Digest", body)
    except Exception as e:
        logger.error(f"Weekly digest failed: {e}")


@app.get("/api/v1/storage/status")
async def storage_status():
    """Summarize storage/provenance: counts, with/without s3 mirror, and last fetched."""
    man = _load_manifest()
    by_md5 = man.get("by_md5") or {}
    total = len(by_md5)
    mirrored = sum(1 for v in by_md5.values() if v.get("s3_key"))
    latest = None
    for v in by_md5.values():
        ts = v.get("fetched")
        if ts and (not latest or ts > latest):
            latest = ts
    return {
        "total": total,
        "mirrored": mirrored,
        "not_mirrored": max(0, total - mirrored),
        "last_fetch": latest,
    }


# National-level endpoints
@app.get("/api/v1/debt/national")
async def get_national_debt():
    """Get national debt overview and statistics"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ENHANCED_COUNTY_API_BASE}/national/debt")
            if response.status_code == 200:
                data = response.json()
                return data
            else:
                # Fallback to basic national debt data
                return {
                    "status": "success",
                    "data": {
                        "total_debt": 10500000000000,
                        "debt_to_gdp_ratio": 75.5,
                        "debt_breakdown": {
                            "external_debt": 6300000000000,
                            "domestic_debt": 4200000000000,
                            "external_percentage": 60.0,
                            "domestic_percentage": 40.0,
                        },
                        "debt_sustainability": {
                            "risk_level": "High",
                            "debt_service_ratio": 37.0,
                        },
                    },
                    "currency": "KES",
                    "data_source": "Fallback data",
                }

    except Exception as e:
        logging.error(f"Error fetching national debt data: {e}")
        # Return fallback data in case of error
        return {
            "status": "success",
            "data": {
                "total_debt": 10500000000000,
                "debt_to_gdp_ratio": 75.5,
                "debt_breakdown": {
                    "external_debt": 6300000000000,
                    "domestic_debt": 4200000000000,
                    "external_percentage": 60.0,
                    "domestic_percentage": 40.0,
                },
                "debt_sustainability": {
                    "risk_level": "High",
                    "debt_service_ratio": 37.0,
                },
            },
            "currency": "KES",
            "data_source": "Fallback data due to API error",
        }


@app.get("/api/v1/entities", response_model=List[EntityResponse])
async def get_entities(
    country: Optional[str] = Query(None, description="Filter by country ISO code"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    search: Optional[str] = Query(None, description="Search entity names"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """Get list of government entities with filters and search."""
    try:
        from sqlalchemy import func

        query = db.query(Entity)

        if country:
            query = query.join(Country).filter(Country.iso_code == country)

        if entity_type:
            query = query.filter(Entity.type == entity_type)

        if search:
            query = query.filter(Entity.canonical_name.ilike(f"%{search}%"))

        # Get total count for pagination
        total = query.count()

        # Apply pagination and ordering
        entities = (
            query.order_by(Entity.canonical_name)
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        # Enrich with financial summaries
        enriched_entities = []
        for entity in entities:
            # Get financial summary
            total_allocation = (
                db.query(func.sum(BudgetLine.allocated_amount))
                .filter(BudgetLine.entity_id == entity.id)
                .scalar()
                or 0
            )

            total_spent = (
                db.query(func.sum(BudgetLine.actual_spent))
                .filter(BudgetLine.entity_id == entity.id)
                .scalar()
                or 0
            )

            audit_count = (
                db.query(func.count(Audit.id))
                .filter(Audit.entity_id == entity.id)
                .scalar()
                or 0
            )

            enriched_entities.append(
                {
                    "id": entity.id,
                    "canonical_name": entity.canonical_name,
                    "type": entity.type,
                    "code": entity.code,
                    "country": entity.country.name if entity.country else None,
                    "parent_entity_id": entity.parent_entity_id,
                    "financial_summary": {
                        "total_allocation": float(total_allocation),
                        "total_spent": float(total_spent),
                        "execution_rate": (
                            (total_spent / total_allocation * 100)
                            if total_allocation > 0
                            else 0
                        ),
                    },
                    "audit_findings_count": audit_count,
                    "created_at": entity.created_at.isoformat(),
                }
            )

        return enriched_entities

    except Exception as e:
        logger.error(f"Database error in get_entities: {str(e)}")
        # Return mock data on database error
        mock_entities = [
            {
                "id": 1,
                "canonical_name": "Ministry of Health",
                "type": "ministry",
                "code": "MOH",
                "country": "Kenya",
                "parent_entity_id": None,
                "financial_summary": {
                    "total_allocation": 850000000000.0,
                    "total_spent": 680000000000.0,
                    "execution_rate": 80.0,
                },
                "audit_findings_count": 5,
                "created_at": "2024-01-01T00:00:00",
            },
            {
                "id": 2,
                "canonical_name": "Ministry of Education",
                "type": "ministry",
                "code": "MOE",
                "country": "Kenya",
                "parent_entity_id": None,
                "financial_summary": {
                    "total_allocation": 1200000000000.0,
                    "total_spent": 960000000000.0,
                    "execution_rate": 80.0,
                },
                "audit_findings_count": 3,
                "created_at": "2024-01-01T00:00:00",
            },
            {
                "id": 3,
                "canonical_name": "National Treasury",
                "type": "ministry",
                "code": "NT",
                "country": "Kenya",
                "parent_entity_id": None,
                "financial_summary": {
                    "total_allocation": 500000000000.0,
                    "total_spent": 425000000000.0,
                    "execution_rate": 85.0,
                },
                "audit_findings_count": 8,
                "created_at": "2024-01-01T00:00:00",
            },
        ]

        return mock_entities


@app.get("/api/v1/entities/{entity_id}", response_model=EntityResponse)
async def get_entity(entity_id: int, db: Session = Depends(get_db)):
    """Get detailed entity profile with time series and documents."""
    from sqlalchemy import func

    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Get financial time series by fiscal period
    budget_summary = (
        db.query(
            FiscalPeriod,
            func.sum(BudgetLine.allocated_amount).label("total_allocation"),
            func.sum(BudgetLine.actual_spent).label("total_spent"),
            func.count(BudgetLine.id).label("budget_lines_count"),
        )
        .join(BudgetLine, BudgetLine.fiscal_period_id == FiscalPeriod.id)
        .filter(BudgetLine.entity_id == entity_id)
        .group_by(FiscalPeriod.id)
        .order_by(FiscalPeriod.start_date.desc())
        .all()
    )

    # Get recent budget lines
    recent_budget_lines = (
        db.query(BudgetLine)
        .filter(BudgetLine.entity_id == entity_id)
        .order_by(BudgetLine.created_at.desc())
        .limit(10)
        .all()
    )

    # Get audit findings
    audit_findings = (
        db.query(Audit)
        .filter(Audit.entity_id == entity_id)
        .order_by(Audit.created_at.desc())
        .limit(5)
        .all()
    )

    # Get source documents
    source_docs = (
        db.query(SourceDocument)
        .join(BudgetLine, BudgetLine.source_document_id == SourceDocument.id)
        .filter(BudgetLine.entity_id == entity_id)
        .distinct()
        .order_by(SourceDocument.fetch_date.desc())
        .limit(5)
        .all()
    )

    return {
        "entity": {
            "id": entity.id,
            "canonical_name": entity.canonical_name,
            "type": entity.type,
            "code": entity.code,
            "country": entity.country.name if entity.country else None,
            "parent_entity_id": entity.parent_entity_id,
            "created_at": entity.created_at.isoformat(),
        },
        "financial_time_series": [
            {
                "fiscal_period": {
                    "id": period.id,
                    "name": period.name,
                    "start_date": period.start_date.isoformat(),
                    "end_date": period.end_date.isoformat(),
                },
                "total_allocation": float(total_allocation or 0),
                "total_spent": float(total_spent or 0),
                "execution_rate": (
                    (float(total_spent or 0) / float(total_allocation or 1) * 100)
                    if total_allocation
                    else 0
                ),
                "budget_lines_count": budget_lines_count,
            }
            for period, total_allocation, total_spent, budget_lines_count in budget_summary
        ],
        "recent_budget_lines": [
            {
                "id": bl.id,
                "description": bl.description,
                "allocated_amount": float(bl.allocated_amount),
                "actual_spent": float(bl.actual_spent or 0),
                "fiscal_period": bl.fiscal_period.name if bl.fiscal_period else None,
                "created_at": bl.created_at.isoformat(),
            }
            for bl in recent_budget_lines
        ],
        "audit_findings": [
            {
                "id": audit.id,
                "severity": audit.severity.value,
                "finding_text": (
                    audit.finding_text[:300] + "..."
                    if len(audit.finding_text) > 300
                    else audit.finding_text
                ),
                "created_at": audit.created_at.isoformat(),
            }
            for audit in audit_findings
        ],
        "source_documents": [
            {
                "id": doc.id,
                "title": doc.title,
                "source_url": doc.source_url,
                "content_type": doc.content_type,
                "fetch_date": doc.fetch_date.isoformat(),
                "verification_status": doc.verification_status.value,
            }
            for doc in source_docs
        ],
    }


@app.get("/api/v1/entities/{entity_id}/periods/{period_id}/budget_lines")
async def get_budget_lines(
    entity_id: int,
    period_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    """Get paginated budget lines with full provenance."""
    budget_lines = (
        db.query(BudgetLine)
        .filter(BudgetLine.entity_id == entity_id, BudgetLine.period_id == period_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": budget_lines,
        "total": len(budget_lines),
        "skip": skip,
        "limit": limit,
    }


@app.get("/api/v1/documents/{document_id}")
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get document metadata and signed download URL."""
    document = db.query(SourceDocument).filter(SourceDocument.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # TODO: Generate signed S3 URL
    return {
        "document": document,
        "download_url": f"/api/v1/documents/{document_id}/download",
    }


@app.get("/api/v1/search")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    filters: Optional[str] = Query(None, description="JSON filters"),
    skip: int = Query(0, ge=0, description="Skip records"),
    limit: int = Query(50, le=200, description="Limit results"),
    db: Session = Depends(get_db),
):
    """Full-text search across budget lines, audits, and documents."""
    import json

    from sqlalchemy import and_, or_

    results = {
        "entities": [],
        "budget_lines": [],
        "audit_findings": [],
        "documents": [],
    }

    # Parse filters if provided
    filter_dict = {}
    if filters:
        try:
            filter_dict = json.loads(filters)
        except json.JSONDecodeError:
            pass

    # Search entities
    entity_query = db.query(Entity).filter(
        or_(Entity.canonical_name.ilike(f"%{q}%"), Entity.code.ilike(f"%{q}%"))
    )

    if "country" in filter_dict:
        entity_query = entity_query.join(Country).filter(
            Country.iso_code == filter_dict["country"]
        )

    entities = entity_query.limit(10).all()
    results["entities"] = [
        {
            "id": e.id,
            "type": "entity",
            "canonical_name": e.canonical_name,
            "entity_type": e.type,
            "code": e.code,
            "country": e.country.name if e.country else None,
        }
        for e in entities
    ]

    # Search budget lines
    budget_query = db.query(BudgetLine).filter(
        or_(BudgetLine.description.ilike(f"%{q}%"), BudgetLine.category.ilike(f"%{q}%"))
    )

    if "entity_id" in filter_dict:
        budget_query = budget_query.filter(
            BudgetLine.entity_id == filter_dict["entity_id"]
        )

    budget_lines = budget_query.limit(10).all()
    results["budget_lines"] = [
        {
            "id": bl.id,
            "type": "budget_line",
            "description": bl.description,
            "category": bl.category,
            "allocated_amount": float(bl.allocated_amount),
            "actual_spent": float(bl.actual_spent or 0),
            "entity_name": bl.entity.canonical_name if bl.entity else None,
            "fiscal_period": bl.fiscal_period.name if bl.fiscal_period else None,
        }
        for bl in budget_lines
    ]

    # Search documents
    doc_query = db.query(SourceDocument).filter(
        or_(
            SourceDocument.title.ilike(f"%{q}%"),
            SourceDocument.content_type.ilike(f"%{q}%"),
        )
    )

    documents = doc_query.limit(10).all()
    results["documents"] = [
        {
            "id": doc.id,
            "type": "document",
            "title": doc.title,
            "content_type": doc.content_type,
            "source_url": doc.source_url,
            "fetch_date": doc.fetch_date.isoformat(),
            "verification_status": doc.verification_status.value,
        }
        for doc in documents
    ]

    total_results = (
        len(results["entities"])
        + len(results["budget_lines"])
        + len(results["documents"])
    )

    return {
        "query": q,
        "results": results,
        "total": total_results,
        "skip": skip,
        "limit": limit,
        "filters": filter_dict,
    }


# Lightweight dashboards wired from ETL outputs (manifest + simple heuristics)
def _read_etl_manifest() -> Dict[str, Any]:
    try:
        etl_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "etl"))
        downloads_dir = os.path.join(etl_dir, "downloads")
        manifest_path = os.path.join(downloads_dir, "processed_manifest.json")
        if os.path.exists(manifest_path):
            import json as _json

            return _json.loads(open(manifest_path, "r", encoding="utf-8").read())
    except Exception:
        pass
    return {"by_md5": {}}


@app.get("/api/v1/dashboards/national/debt-mix")
async def dashboard_debt_mix():
    """Debt mix snapshot. Uses ETL manifest titles as provenance; falls back to static if empty."""
    manifest = _read_etl_manifest()
    docs = list((manifest.get("by_md5") or {}).values())
    treas = [
        d for d in docs if d.get("source") and "treasury" in d.get("source", "").lower()
    ]
    prov = [
        {
            "title": d.get("title"),
            "source": d.get("source"),
            "fetched": d.get("fetched"),
            "file": d.get("file_path"),
        }
        for d in treas[:5]
    ]
    # Fallback static split; replaced when real parsed data wired
    data = {
        "external": 60.0,
        "domestic": 40.0,
        "currency": "KES",
        "provenance": prov,
    }
    return data


@app.get("/api/v1/dashboards/national/fiscal-outturns")
async def dashboard_fiscal_outturns():
    """Quarterly fiscal outturns from QEBR. Returns tiny time series; falls back if none."""
    manifest = _read_etl_manifest()
    docs = list((manifest.get("by_md5") or {}).values())
    qebr_like = [
        d
        for d in docs
        if re.search(r"qebr|quarterly\s+economic", (d.get("title") or ""), re.I)
    ]
    # Simple fake series ordered by fetched time desc
    series = []
    for d in sorted(qebr_like, key=lambda x: x.get("fetched", ""), reverse=True)[:8]:
        series.append(
            {
                "period": d.get("title"),
                "revenue": None,
                "expenditure": None,
                "balance": None,
                "provenance": {"title": d.get("title"), "file": d.get("file_path")},
            }
        )
    if not series:
        series = [
            {
                "period": "FY2024/25 Q1",
                "revenue": 850_000_000_000,
                "expenditure": 900_000_000_000,
                "balance": -50_000_000_000,
            },
            {
                "period": "FY2024/25 Q2",
                "revenue": 870_000_000_000,
                "expenditure": 920_000_000_000,
                "balance": -50_000_000_000,
            },
        ]
    return {"series": series}


@app.get("/api/v1/dashboards/national/sector-ceilings")
async def dashboard_sector_ceilings():
    """Sector ceilings snapshot from BPS/BRoP; stub with provenance."""
    manifest = _read_etl_manifest()
    docs = list((manifest.get("by_md5") or {}).values())
    bps_like = [
        d
        for d in docs
        if re.search(r"bps|policy\s+statement|sector", (d.get("title") or ""), re.I)
    ]
    prov = [
        {
            "title": d.get("title"),
            "file": d.get("file_path"),
            "fetched": d.get("fetched"),
        }
        for d in bps_like[:3]
    ]
    # Fallback illustrative values
    allocation = {
        "health": 15.0,
        "education": 27.0,
        "infrastructure": 22.0,
        "governance": 8.0,
        "other": 28.0,
        "unit": "%",
        "provenance": prov,
    }
    return allocation


@app.post("/api/v1/etl/treasury/run-batch")
async def run_treasury_batch():
    """Run the targeted batch: latest 10 QEBR + 3 ABP + 5 Circulars."""
    try:
        # Lazy import to avoid heavy cost on app start
        sys.path.append(os.path.join(os.path.dirname(__file__), "..", "etl"))
        kp_mod = importlib.import_module("kenya_pipeline")
        KenyaDataPipeline = getattr(kp_mod, "KenyaDataPipeline")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETL import failed: {e}")

    pipeline = KenyaDataPipeline()
    docs = pipeline.discover_budget_documents("treasury")
    # Use selector for targeted batch
    if hasattr(pipeline, "select_treasury_batch"):
        batch = pipeline.select_treasury_batch(docs)
    else:
        batch = docs[:18]

    processed = 0
    successful = 0
    doc_ids: List[Any] = []
    for d in batch:
        try:
            res = await pipeline.download_and_process_document(d)
            processed += 1
            if res:
                successful += 1
                doc_ids.append(res.get("document_id"))
        except Exception as e:
            logger.error(f"Batch doc failed: {e}")
        # gentle pacing
        await asyncio.sleep(2)

    return {
        "requested": {
            "qebr": 10,
            "abp": 3,
            "circulars": 5,
        },
        "processed": processed,
        "successful": successful,
        "document_ids": doc_ids,
    }


@app.post("/api/v1/etl/cob/run-batch")
async def run_cob_batch(limit: int = 25):
    """Run a COB batch across national and consolidated county BIRR pages.
    Default limit is 25 recent items to validate nested lists from 2014+.
    """
    try:
        sys.path.append(os.path.join(os.path.dirname(__file__), "..", "etl"))
        kp_mod = importlib.import_module("kenya_pipeline")
        KenyaDataPipeline = getattr(kp_mod, "KenyaDataPipeline")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETL import failed: {e}")

    pipeline = KenyaDataPipeline()
    docs = pipeline.discover_budget_documents("cob")

    # Prefer items that look like BIRR PDFs and include FY in title
    def score(d: Dict[str, Any]) -> tuple:
        t = (d.get("title") or "").lower()
        fy = 1 if re.search(r"fy\s*20\d{2}|20\d{2}\s*[/–-]\s*20\d{2}", t) else 0
        birr = 1 if ("budget" in t and ("implementation" in t or "review" in t)) else 0
        nat = 1 if "national" in t else 0
        cty = 1 if "county" in t or "consolidated" in t else 0
        return (fy + birr + nat + cty, t)

    ranked = sorted(docs, key=score, reverse=True)

    processed = 0
    successful = 0
    doc_ids: List[Any] = []
    for d in ranked[: max(1, min(limit, 50))]:
        try:
            res = await pipeline.download_and_process_document(d)
            processed += 1
            if res:
                successful += 1
                doc_ids.append(res.get("document_id"))
        except Exception as e:
            logger.error(f"COB batch doc failed: {e}")
        await asyncio.sleep(2)

    return {
        "requested": {"limit": limit},
        "discovered": len(docs),
        "processed": processed,
        "successful": successful,
        "document_ids": doc_ids,
    }


# Admin endpoints
@app.post("/api/v1/annotations")
async def create_annotation(
    annotation_data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create annotation/comment on budget line or audit finding."""
    # TODO: Implement annotation creation
    return {"message": "Annotation created", "id": 1}


@app.post("/api/v1/documents/upload")
async def upload_document(
    file_data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Manual document upload for missing documents."""
    # TODO: Implement document upload
    return {"message": "Document uploaded", "id": 1}


@app.get("/api/v1/analytics/top_spenders")
async def get_top_spenders(
    country: str = Query(...),
    period: str = Query(...),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
):
    """Get top spending entities for analytics."""
    # TODO: Implement analytics queries
    return {"top_spenders": []}


# ETL Pipeline Endpoints
@app.post("/api/v1/etl/kenya/start", response_model=ETLJobResponse)
async def start_kenya_etl(background_tasks: BackgroundTasks):
    """Start ETL pipeline for Kenya government data."""
    if not ETL_AVAILABLE:
        raise HTTPException(status_code=503, detail="ETL pipeline not available")

    import datetime
    import uuid

    job_id = str(uuid.uuid4())

    # Start ETL in background
    background_tasks.add_task(run_kenya_etl_pipeline, job_id)

    return ETLJobResponse(
        job_id=job_id,
        status="started",
        country="Kenya",
        started_at=datetime.datetime.now().isoformat(),
        documents_processed=0,
        errors=[],
    )


@app.get("/api/v1/etl/status/{job_id}", response_model=ETLStatusResponse)
async def get_etl_status(job_id: str):
    """Get status of ETL job."""
    if not ETL_AVAILABLE:
        raise HTTPException(status_code=503, detail="ETL pipeline not available")

    # TODO: Implement job status tracking (could use Redis or database)
    return ETLStatusResponse(
        job_id=job_id,
        status="completed",
        progress={
            "documents_fetched": 15,
            "documents_processed": 12,
            "entities_created": 25,
            "budget_lines_created": 150,
        },
        last_updated=datetime.datetime.now().isoformat(),
    )


@app.get("/api/v1/etl/kenya/sources")
async def get_kenya_data_sources():
    """Get available Kenya government data sources with real-time status."""
    if not ETL_AVAILABLE:
        raise HTTPException(status_code=503, detail="ETL pipeline not available")

    try:
        # Test real-time connection status
        import os
        import sys

        sys.path.append(os.path.dirname(os.path.dirname(__file__)))

        from etl_test_runner import SimpleKenyaETL

        etl = SimpleKenyaETL()

        # Quick connection test
        treasury_status = etl.test_treasury_connection()

        sources = [
            {
                "name": "Kenya National Treasury",
                "url": "https://treasury.go.ke",
                "document_types": [
                    "budget",
                    "expenditure_report",
                    "debt_report",
                    "financial_statements",
                ],
                "last_fetch": treasury_status.get("timestamp", "2024-01-15T10:30:00Z"),
                "status": (
                    "active" if treasury_status.get("accessible", False) else "error"
                ),
                "live_test_results": {
                    "response_code": treasury_status.get("status_code"),
                    "pdf_documents_found": treasury_status.get(
                        "pdf_documents_found", 0
                    ),
                    "page_title": treasury_status.get("page_title", ""),
                    "sample_documents": treasury_status.get("sample_pdfs", [])[:3],
                },
            },
            {
                "name": "Office of Auditor General",
                "url": "https://oagkenya.go.ke",
                "document_types": [
                    "audit_report",
                    "special_audits",
                    "compliance_reports",
                ],
                "last_fetch": "2024-01-10T14:20:00Z",
                "status": "timeout_issues",
                "note": "Site occasionally experiences timeouts but contains valuable audit reports",
            },
            {
                "name": "Controller of Budget",
                "url": "https://cob.go.ke",
                "document_types": ["budget_implementation_review", "quarterly_reports"],
                "last_fetch": "2024-01-12T09:15:00Z",
                "status": "pending_test",
            },
        ]

        return {
            "sources": sources,
            "real_time_test": True,
            "test_timestamp": treasury_status.get("timestamp"),
            "summary": {
                "total_sources": len(sources),
                "active_sources": len([s for s in sources if s["status"] == "active"]),
                "total_pdf_documents": treasury_status.get("pdf_documents_found", 0),
            },
        }

    except Exception as e:
        # Fall back to static data if real-time test fails
        return {
            "sources": [
                {
                    "name": "Kenya National Treasury",
                    "url": "https://treasury.go.ke",
                    "document_types": ["budget", "expenditure_report", "debt_report"],
                    "last_fetch": "2024-01-15T10:30:00Z",
                    "status": "active",
                },
                {
                    "name": "Office of Auditor General",
                    "url": "https://oagkenya.go.ke",
                    "document_types": ["audit_report"],
                    "last_fetch": "2024-01-10T14:20:00Z",
                    "status": "active",
                },
                {
                    "name": "Controller of Budget",
                    "url": "https://cob.go.ke",
                    "document_types": ["budget_implementation_review"],
                    "last_fetch": "2024-01-12T09:15:00Z",
                    "status": "active",
                },
            ],
            "real_time_test": False,
            "error": str(e),
        }


async def run_kenya_etl_pipeline(job_id: str):
    """Background task to run Kenya ETL pipeline with real data."""
    try:
        # Import and run our working ETL
        import os
        import sys

        sys.path.append(os.path.dirname(os.path.dirname(__file__)))

        from etl_test_runner import SimpleKenyaETL

        # Run the real ETL pipeline
        etl = SimpleKenyaETL()
        results = etl.run_full_pipeline()

        print(f"ETL Job {job_id}: Successfully processed real Kenya government data")
        print(
            f"ETL Job {job_id}: Found {results['sources_accessible']} accessible sources"
        )
        print(
            f"ETL Job {job_id}: Extracted {results['entities_extracted']} government entities"
        )
        print(f"ETL Job {job_id}: Processed {results['documents_processed']} documents")

        return results

    except Exception as e:
        print(f"ETL Job {job_id} failed: {str(e)}")
        return {"error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
