"""
Shared test fixtures for the backend test suite.

Uses an in-memory SQLite database with JSONB→JSON compile shim so that
PostgreSQL-specific column types work.  Every test that requests a ``client``
or ``db_session`` fixture gets a **clean, isolated** database.
"""

import os
import sys
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Text, create_engine, event
from sqlalchemy.orm import sessionmaker

# ── path setup ──────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
for p in (ROOT_DIR, BACKEND_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

# ── JSONB → TEXT compile shim (must be registered before metadata.create_all) ─
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):  # noqa: ARG001
    return "TEXT"


# ── imports ─────────────────────────────────────────────────────────────
try:
    from database import get_db
    from main import app
    from models import Base
except ModuleNotFoundError:
    from backend.database import get_db
    from backend.main import app
    from backend.models import Base

# ── SQLite test engine ──────────────────────────────────────────────────
SQLALCHEMY_DATABASE_URL = "sqlite://"  # in-memory

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)


# Enable WAL/foreign-key support for consistency
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):  # noqa: ARG001
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── fixtures ────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _setup_tables():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    """Provide a transactional DB session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    """FastAPI TestClient with the DB dependency overridden to use test session."""

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass  # session cleanup handled by db_session fixture

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


# ── seed helpers (import into individual test files as needed) ──────────
@pytest.fixture()
def seed_country(db_session):
    """Insert a minimal Kenya Country row and return it."""
    from models import Country

    country = Country(
        id=1,
        iso_code="KEN",
        name="Kenya",
        currency="KES",
        timezone="Africa/Nairobi",
        default_locale="en_KE",
    )
    db_session.add(country)
    db_session.commit()
    db_session.refresh(country)
    return country


@pytest.fixture()
def seed_entity(db_session, seed_country):
    """Insert a sample county entity and return it."""
    from models import Entity, EntityType

    entity = Entity(
        id=1,
        country_id=seed_country.id,
        type=EntityType.COUNTY,
        canonical_name="Nairobi",
        slug="nairobi",
    )
    db_session.add(entity)
    db_session.commit()
    db_session.refresh(entity)
    return entity


@pytest.fixture()
def seed_fiscal_period(db_session, seed_country):
    """Insert a fiscal period and return it."""
    from models import FiscalPeriod

    fp = FiscalPeriod(
        id=1,
        country_id=seed_country.id,
        label="FY2024/25",
        start_date=datetime(2024, 7, 1),
        end_date=datetime(2025, 6, 30),
    )
    db_session.add(fp)
    db_session.commit()
    db_session.refresh(fp)
    return fp


@pytest.fixture()
def seed_source_doc(db_session, seed_country):
    """Insert a source document and return it."""
    from models import DocumentStatus, DocumentType, SourceDocument

    doc = SourceDocument(
        id=1,
        country_id=seed_country.id,
        publisher="Kenya National Treasury",
        title="FY2024/25 Budget Estimates",
        url="https://treasury.go.ke/budget-2024",
        fetch_date=datetime(2024, 8, 1, tzinfo=timezone.utc),
        doc_type=DocumentType.BUDGET,
        status=DocumentStatus.AVAILABLE,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc
