"""Monitoring and observability setup with Sentry and Prometheus."""

import logging
import os
import time
from typing import Callable

import sentry_sdk
from fastapi import FastAPI, Request
from prometheus_client import Counter, Gauge, Histogram
from prometheus_fastapi_instrumentator import Instrumentator
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

logger = logging.getLogger(__name__)

# Prometheus metrics
http_requests_total = Counter(
    "http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"]
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
)

active_requests = Gauge("active_requests", "Number of active requests")

etl_runs_total = Counter("etl_runs_total", "Total ETL runs", ["status"])

data_validation_failures = Counter(
    "data_validation_failures_total",
    "Total data validation failures",
    ["validation_type"],
)

db_connection_pool_size = Gauge(
    "db_connection_pool_size", "Database connection pool size"
)


def setup_sentry(app: FastAPI, dsn: str = None):
    """Configure Sentry for error tracking."""
    dsn = dsn or os.getenv("SENTRY_DSN")

    if not dsn:
        logger.warning("Sentry DSN not configured. Error tracking disabled.")
        return

    sentry_sdk.init(
        dsn=dsn,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.1")),
        environment=os.getenv("ENVIRONMENT", "production"),
        release=os.getenv("APP_VERSION", "1.0.0"),
        send_default_pii=False,  # Don't send PII
        before_send=before_send_filter,
    )

    logger.info("Sentry initialized successfully")


def before_send_filter(event, hint):
    """Filter sensitive data before sending to Sentry."""
    # Remove sensitive headers
    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        if "Authorization" in headers:
            headers["Authorization"] = "[Filtered]"
        if "Cookie" in headers:
            headers["Cookie"] = "[Filtered]"

    return event


def setup_prometheus(app: FastAPI):
    """Configure Prometheus metrics collection."""
    instrumentator = Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics", "/health"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="http_requests_inprogress",
        inprogress_labels=True,
    )

    instrumentator.instrument(app).expose(app, endpoint="/metrics")

    logger.info("Prometheus metrics enabled at /metrics")


async def metrics_middleware(request: Request, call_next: Callable):
    """Custom middleware for detailed metrics collection."""
    # Track active requests
    active_requests.inc()

    # Start timer
    start_time = time.time()

    try:
        # Process request
        response = await call_next(request)

        # Record metrics
        duration = time.time() - start_time
        http_request_duration_seconds.labels(
            method=request.method, endpoint=request.url.path
        ).observe(duration)

        http_requests_total.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
        ).inc()

        return response

    finally:
        # Decrement active requests
        active_requests.dec()


def setup_structured_logging():
    """Configure structured JSON logging for production."""
    from pythonjsonlogger import jsonlogger

    log_handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d"
    )
    log_handler.setFormatter(formatter)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.addHandler(log_handler)
    root_logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

    logger.info("Structured JSON logging configured")


def record_etl_run(status: str):
    """Record ETL run metrics."""
    etl_runs_total.labels(status=status).inc()


def record_validation_failure(validation_type: str):
    """Record data validation failure."""
    data_validation_failures.labels(validation_type=validation_type).inc()


def update_db_pool_metrics(pool_status: dict):
    """Update database connection pool metrics."""
    db_connection_pool_size.set(pool_status.get("size", 0))
