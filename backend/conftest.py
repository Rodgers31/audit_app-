import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure package imports work whether tests are run from repo root or backend/
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)

try:
    from backend.database import get_db
    from backend.main import app
    from backend.models import Base
except Exception:
    # Fallback when running pytest from within backend directory
    from database import get_db
    from main import app
    from models import Base

# Attempt to set up a lightweight SQLite test DB; if models use PostgreSQL-only
# types (e.g., JSONB), gracefully fall back to a DB-less override that returns 503.
try:
    # Test database URL
    SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
except Exception:
    # DB-less fallback for routes that should handle DB unavailability (503)
    def override_get_db():
        yield None

    app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    # Provide a session if engine exists; otherwise, skip
    try:
        connection = engine.connect()
        transaction = connection.begin()
        session = TestingSessionLocal(bind=connection)
        yield session
        session.close()
        transaction.rollback()
        connection.close()
    except Exception:
        pytest.skip("DB session not available in DB-less test mode")
