FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    pkg-config \
    libpq-dev \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt ./requirements.txt
COPY etl/requirements.txt ./etl-requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -r etl-requirements.txt 2>/dev/null || true

# Copy application code — backend is the main app
COPY backend/ ./

# Copy ETL and extractors so live_data_fetcher can import them
COPY etl/ /app/etl/
COPY extractors/ /app/extractors/

# Create directories for uploads and logs
RUN mkdir -p uploads logs

# Ensure extractors packages have __init__.py so Python treats them as packages
RUN touch /app/extractors/__init__.py \
    /app/extractors/cob/__init__.py \
    /app/extractors/county/__init__.py \
    /app/extractors/government/__init__.py

# Set environment variables — /app is both backend and the root for etl/extractors
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Run the application (no --reload in production for single stable worker)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
