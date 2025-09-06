"""
Simple FastAPI server for Government Financial Transparency API.
This is a working version with mock data for development and testing.
"""

from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# Response models
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


# Initialize FastAPI app
app = FastAPI(
    title="Government Financial Transparency API",
    description="API for accessing government financial data with full provenance",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data
MOCK_COUNTRIES = [
    {
        "id": 1,
        "name": "Kenya",
        "iso_code": "KE",
        "currency": "KES",
        "summary": {
            "total_budget_allocation": 3200000000000.0,
            "total_actual_spending": 2800000000000.0,
            "budget_execution_rate": 87.5,
            "total_debt": 8500000000000.0,
            "debt_to_gdp_ratio": 67.8,
            "source_documents": 1250,
            "last_updated": "2024-01-15T10:30:00Z",
            "allocation_provenance": [
                {
                    "document_title": "National Budget 2023/24",
                    "url": "https://treasury.go.ke/budget/2023-24",
                    "fetch_date": "2024-01-15T08:00:00Z",
                }
            ],
            "spending_provenance": [
                {
                    "document_title": "Q2 Expenditure Report 2023/24",
                    "url": "https://treasury.go.ke/reports/expenditure/q2-2023-24",
                    "fetch_date": "2024-01-10T14:30:00Z",
                }
            ],
            "debt_provenance": [
                {
                    "document_title": "Public Debt Bulletin December 2023",
                    "url": "https://treasury.go.ke/debt/bulletin/dec-2023",
                    "fetch_date": "2024-01-05T09:15:00Z",
                }
            ],
        },
    }
]

MOCK_ENTITIES = [
    {
        "id": 1,
        "canonical_name": "Ministry of Health",
        "type": "ministry",
        "code": "MOH",
        "total_budget": 150000000000.0,
        "total_spending": 140000000000.0,
        "audit_count": 5,
    },
    {
        "id": 2,
        "canonical_name": "Ministry of Education",
        "type": "ministry",
        "code": "MOE",
        "total_budget": 300000000000.0,
        "total_spending": 285000000000.0,
        "audit_count": 8,
    },
    {
        "id": 3,
        "canonical_name": "National Treasury",
        "type": "ministry",
        "code": "NT",
        "total_budget": 500000000000.0,
        "total_spending": 475000000000.0,
        "audit_count": 12,
    },
]

MOCK_DOCUMENTS = [
    {
        "id": 1,
        "title": "National Budget 2023/24",
        "source_url": "https://treasury.go.ke/budget/2023-24",
        "content_type": "budget",
        "verification_status": "verified",
    },
    {
        "id": 2,
        "title": "Q2 Expenditure Report 2023/24",
        "source_url": "https://treasury.go.ke/reports/expenditure/q2-2023-24",
        "content_type": "expenditure_report",
        "verification_status": "verified",
    },
]


# Routes
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Government Financial Transparency API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/v1/countries", response_model=List[CountryResponse])
async def get_countries():
    """Get list of countries with financial summary data."""
    return MOCK_COUNTRIES


@app.get("/api/v1/countries/{country_id}/summary")
async def get_country_summary(country_id: int):
    """Get detailed financial summary for a specific country."""
    country = next((c for c in MOCK_COUNTRIES if c["id"] == country_id), None)
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")

    return {
        "country": {
            "id": country["id"],
            "name": country["name"],
            "iso_code": country["iso_code"],
            "currency": country["currency"],
        },
        "financial_summary": {
            "total_allocation": {
                "value": country["summary"]["total_budget_allocation"],
                "currency": country["currency"],
                "provenance": country["summary"]["allocation_provenance"],
            },
            "total_spent": {
                "value": country["summary"]["total_actual_spending"],
                "currency": country["currency"],
                "provenance": country["summary"]["spending_provenance"],
            },
            "execution_rate": {
                "value": country["summary"]["budget_execution_rate"],
                "unit": "percentage",
            },
            "total_debt": {
                "value": country["summary"]["total_debt"],
                "currency": country["currency"],
                "provenance": country["summary"]["debt_provenance"],
            },
        },
        "last_updated": country["summary"]["last_updated"],
    }


@app.get("/api/v1/entities", response_model=List[EntityResponse])
async def get_entities(
    country: Optional[str] = Query(None, description="Filter by country ISO code"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    search: Optional[str] = Query(None, description="Search entity names"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """Get list of government entities with filters and search."""
    entities = MOCK_ENTITIES.copy()

    # Apply filters
    if entity_type:
        entities = [e for e in entities if e["type"] == entity_type]

    if search:
        entities = [
            e for e in entities if search.lower() in e["canonical_name"].lower()
        ]

    # Apply pagination
    total = len(entities)
    start = (page - 1) * limit
    end = start + limit
    entities = entities[start:end]

    return entities


@app.get("/api/v1/entities/{entity_id}", response_model=EntityResponse)
async def get_entity_details(entity_id: int):
    """Get detailed information for a specific entity."""
    entity = next((e for e in MOCK_ENTITIES if e["id"] == entity_id), None)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    return entity


@app.get("/api/v1/search", response_model=SearchResponse)
async def search_content(
    q: str = Query(..., description="Search query"),
    content_type: Optional[str] = Query(None, description="Filter by content type"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """Full-text search across all documents and entities."""
    results = []

    # Search entities
    for entity in MOCK_ENTITIES:
        if q.lower() in entity["canonical_name"].lower():
            results.append(
                {
                    "type": "entity",
                    "id": entity["id"],
                    "title": entity["canonical_name"],
                    "snippet": f"Government entity: {entity['type']}",
                    "relevance_score": 0.9,
                }
            )

    # Search documents
    for doc in MOCK_DOCUMENTS:
        if q.lower() in doc["title"].lower():
            results.append(
                {
                    "type": "document",
                    "id": doc["id"],
                    "title": doc["title"],
                    "snippet": f"Document type: {doc['content_type']}",
                    "url": doc["source_url"],
                    "relevance_score": 0.8,
                }
            )

    # Apply pagination
    total = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    results = results[start:end]

    return SearchResponse(
        results=results, total_count=total, page=page, per_page=per_page
    )


@app.get("/api/v1/documents", response_model=List[DocumentResponse])
async def get_documents(
    country: Optional[str] = Query(None, description="Filter by country ISO code"),
    content_type: Optional[str] = Query(None, description="Filter by document type"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """Get list of source documents with filters."""
    documents = MOCK_DOCUMENTS.copy()

    # Apply filters
    if content_type:
        documents = [d for d in documents if d["content_type"] == content_type]

    # Apply pagination
    start = (page - 1) * limit
    end = start + limit
    documents = documents[start:end]

    return documents


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "government-transparency-api"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
