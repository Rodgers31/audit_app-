"""Comprehensive health check endpoints for monitoring."""

from datetime import datetime, timezone
from typing import Any, Dict

from cache.redis_cache import cache
from database import get_db, get_pool_status
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/detailed", status_code=status.HTTP_200_OK)
async def detailed_health_check(db: Session = Depends(get_db)):
    """Detailed health check with component status."""

    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "environment": "production",
        "components": {},
    }

    # Check database
    try:
        db.execute("SELECT 1")
        db_pool = get_pool_status()
        health_status["components"]["database"] = {
            "status": "healthy",
            "pool_size": db_pool.get("size"),
            "checked_out": db_pool.get("checked_out"),
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e),
        }

    # Check Redis
    redis_health = cache.health_check()
    health_status["components"]["cache"] = redis_health
    if redis_health.get("status") != "healthy":
        health_status["status"] = "degraded"

    # Add more component checks as needed
    health_status["components"]["etl"] = {
        "status": "not_implemented",
    }

    return health_status


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: Session = Depends(get_db)):
    """Readiness check for Kubernetes/orchestration."""
    try:
        # Check if app is ready to serve traffic
        db.execute("SELECT 1")
        return {"status": "ready"}
    except Exception:
        return {"status": "not_ready"}, status.HTTP_503_SERVICE_UNAVAILABLE


@router.get("/health/live", status_code=status.HTTP_200_OK)
async def liveness_check():
    """Liveness check for Kubernetes/orchestration."""
    # Simple check if the app is running
    return {"status": "alive"}
