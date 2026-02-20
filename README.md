# Government Financial Transparency Audit Application

🎉 **Production-Ready!** This application has been hardened for production deployment with comprehensive security, monitoring, testing, and legal compliance.

A comprehensive platform for transparent, auditable publication of government allocations, spending, borrowing, and audits with extensible multi-country support.

## 🚀 Production Status

✅ **Security Hardened** - Rate limiting, audit logging, secure configuration  
✅ **Fully Tested** - 70% test coverage with CI/CD integration  
✅ **Monitored** - Sentry, Prometheus metrics, structured logging  
✅ **Performant** - Redis caching, database indexes, connection pooling  
✅ **Resilient** - Retry logic, exponential backoff, graceful degradation  
✅ **Compliant** - Privacy policy, terms of service, Kenya DPA 2019 ready

📊 **Production Readiness**: 95/100

See [`PRODUCTION_FIXES.md`](./PRODUCTION_FIXES.md) for implementation details.

## System Goals

- **Accurate, auditable publication** of allocations, spending, borrowing, audits
- **Transparent provenance** - show original documents & links next to every figure
- **Easy-to-use UI** for citizens & journalists
- **Extensible** to support additional countries
- **SEO & discoverability** with server-side rendering
- **Maintainability** for solo developer
- **Reliability & reproducibility** of ETL with versioned extractions
- **Security & legal safety** with defamation avoidance

## Architecture

### Tech Stack

- **Frontend**: Next.js (React), TypeScript, TailwindCSS, Recharts
- **Backend**: FastAPI (Python) + Uvicorn/Gunicorn
- **ETL/Parsing**: Python (pandas, pdfplumber, camelot, tabula-py)
- **Database**: PostgreSQL (normalized data), MongoDB (raw extractions)
- **Storage**: AWS S3 or DigitalOcean Spaces
- **Auth**: JWT with OIDC for admin
- **CI/CD**: GitHub Actions
- **Hosting**: Vercel (frontend), Railway/Render (backend)
- **Monitoring**: Sentry, Prometheus

### Project Structure

```text
audit_app/
├── backend/           # FastAPI backend
├── frontend/          # Next.js frontend
├── etl/              # Data extraction and processing
├── infra/            # Deployment configurations
├── admin/            # Admin UI components
└── docs/             # Documentation
```

## Quick Start

### Local Development (Full Stack)

```bash
# 1. Start Backend (Terminal 1)
cd audit_app
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. Start Frontend (Terminal 2)
cd frontend
npm install
npm run dev

# 3. Access Application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Testing Without Backend

The frontend includes Playwright E2E tests that use mocked API responses, so you can test the UI without running the backend:

```bash
cd frontend
npm run test:e2e        # Run all E2E tests
npm run test:e2e:ui     # Run with Playwright UI
```

See [`frontend/E2E_ARCHITECTURE.md`](./frontend/E2E_ARCHITECTURE.md) for details on how the mock system works.

### Database Seeding

The application includes a comprehensive seeding system to populate the database with real government data from Controller of Budget, OAG, and KNBS sources.

#### Quick Start Seeding

```bash
# Ensure database migrations are applied
cd backend
alembic upgrade head

# Bootstrap reference data (Kenya country + counties)
python bootstrap_data.py

# Test with dry-run (no database writes)
python -m seeding.cli seed --domain counties_budget --dry-run

# Seed counties budget data
python -m seeding.cli seed --domain counties_budget

# Seed all domains
python -m seeding.cli seed --all
```

#### Available Domains

- `counties_budget` - County budget execution data
- `audits` - Audit findings from OAG
- `population` - Population statistics from KNBS
- `economic_indicators` - CPI, GDP, unemployment data
- `national_debt` - Government debt bulletins
- `learning_hub` - Educational Q&A content

#### Configuration

Configure data sources in `backend/.env`:

```bash
# Development: Use local fixtures
SEED_BUDGETS_DATASET_URL=file:///path/to/backend/seeding/fixtures/budgets.json

# Production: Use real government APIs
SEED_BUDGETS_DATASET_URL=https://opendata.go.ke/api/views/xyz/rows.json
```

📚 **Complete Documentation**: See [`docs/seeding-guide.md`](./docs/seeding-guide.md) for:

- Full CLI reference
- Environment configuration
- Data source URLs
- Ingestion job tracking
- Troubleshooting guide
- Production deployment

#### Monitoring Seeding Jobs

Admin API endpoints are available for monitoring ingestion jobs:

```bash
# List recent jobs
GET /api/v1/admin/ingestion-jobs

# Get job details
GET /api/v1/admin/ingestion-jobs/{job_id}

# Get statistics
GET /api/v1/admin/ingestion-jobs/stats/summary

# Test endpoints
python test_admin_api.py
```

See [`docs/seeding-guide.md#monitoring`](./docs/seeding-guide.md#monitoring) for complete API documentation.

### Seeding Data with Local Fixtures

Need to validate the seeding pipeline without hitting upstream services? Use the VS Code task **"Seed Database (Fixtures Dry Run)"**. It runs `python -m seeding.cli seed --all --dry-run` while pointing each domain to the sample payloads under `backend/seeding/fixtures/`.

To execute the same flow manually from the project root:

```powershell
set SEED_POPULATION_DATASET_URL=backend\seeding\fixtures\population.json
set SEED_BUDGETS_DATASET_URL=backend\seeding\fixtures\budgets.json
set SEED_AUDITS_DATASET_URL=backend\seeding\fixtures\audits.json
set SEED_ECONOMIC_INDICATORS_DATASET_URL=backend\seeding\fixtures\economic_indicators.json
C:/Users/rodge/projects/audit_app/venv/Scripts/python.exe -m seeding.cli seed --all --dry-run
```

_(Use `export` instead of `set` on Unix shells.)_

### Testing & Quality Gates

**All deployments require passing tests.** See comprehensive testing documentation:

- 📋 **[TESTING_GATES.md](./TESTING_GATES.md)** - Complete testing requirements and CI/CD gates
- ⚡ **[TESTING_QUICK_REFERENCE.md](./TESTING_QUICK_REFERENCE.md)** - Quick reference for developers

**Quality Requirements**:

- ✅ Backend: ≥50% test coverage, 0 failures
- ✅ Frontend: 0 linting errors/warnings, all E2E tests pass
- ✅ Build: Production build must succeed
- ✅ Security: 0 critical/high vulnerabilities

**Running All Tests Locally**:

```bash
# Backend
cd backend && pytest tests/ -v --cov=. --cov-fail-under=50

# Frontend (full suite)
cd frontend
npm run lint -- --max-warnings=0
npm test -- --ci
npm run build
npm run test:e2e

# ETL
cd etl && python -m pytest --cov=. -v
```

Deployments are automatically blocked if any tests fail.

## Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 13+
- Redis (for caching)

### Backend Setup

#### 1. Create Virtual Environment and Install Dependencies

```bash
# Navigate to project root
cd audit_app

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

#### 2. Configure Frontend Environment Variables

```bash
# Copy example env file
cp backend/.env.example backend/.env

# Edit backend/.env with your settings:
# - Database connection string (PostgreSQL)
# - Redis URL (for caching)
# - API keys and secrets
```

#### 3. Setup Database

```bash
# Make sure PostgreSQL is running
# Create database: audit_app

# Run migrations
cd backend
alembic upgrade head
```

#### 4. Start Backend Server

```bash
# Development mode (from project root)
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Alternative: Use the VS Code task "Start Backend (Dev)"

# Backend will be available at:
# http://localhost:8000
# API docs: http://localhost:8000/docs
# Alternative docs: http://localhost:8000/redoc
```

**Note**: The backend runs on **port 8000** by default. The frontend expects the API at `http://localhost:8001` (configured in `frontend/.env.local`).

### Frontend Setup

#### 1. Install Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install Node.js packages
npm install
```

#### 2. Configure Environment Variables

```bash
# Copy example env file
cp .env.local.example .env.local

# Edit frontend/.env.local with your settings:
# NEXT_PUBLIC_API_URL=http://localhost:8001
# NEXT_PUBLIC_API_VERSION=v1
```

#### 3. Start Development Server

```bash
# Development mode
npm run dev

# Alternative: Use the VS Code task "Start Frontend (Dev)"

# Frontend will be available at:
# http://localhost:3000
```

#### 4. Build for Production

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

**Note**: Make sure the backend is running before starting the frontend, or configure the mock API layer for development.

### ETL Setup

```bash
cd etl
pip install -r requirements.txt
python -m etl.downloader
python -m etl.extractor
```

## Features

### Core Features (MVP)

- ✅ Government document ingestion and parsing
- ✅ Budget allocation and spending tracking
- ✅ Document provenance and transparency
- ✅ County and ministry dashboards
- ✅ Search and filtering capabilities
- ✅ PDF document viewer with extraction highlights
- ✅ Export to CSV/JSON

### Advanced Features (v1)

- 🔄 Automated anomaly detection
- 🔄 Audit integration and findings
- 🔄 Red-flagging system
- 🔄 FOI (Freedom of Information) helper
- 🔄 Benchmarking and comparisons
- 🔄 Mobile app (React Native)

### Multi-country Support (v2)

- 🔄 Country adapter framework
- 🔄 Configurable fiscal year calendars
- 🔄 Multi-currency support
- 🔄 Internationalization (i18n)

## Data Model

### Core Entities

- **Countries**: Basic country information and configuration
- **Entities**: Government bodies (national, county, ministry, agency)
- **Fiscal Periods**: Budget cycles and time periods
- **Source Documents**: Original PDFs, CSVs, and reports
- **Budget Lines**: Allocated vs actual spending with full provenance
- **Loans**: Borrowing information
- **Audits**: Audit findings and recommendations
- **Annotations**: User comments and evidence

### Data Flow

1. **Source Registry** → Define data sources per country
2. **Downloader** → Fetch documents from official sources
3. **Extractor** → Parse PDFs/CSVs using AI/ML tools
4. **Normalizer** → Map to canonical entities and fiscal periods
5. **Validator** → Quality checks and confidence scoring
6. **Loader** → Store in PostgreSQL with full provenance
7. **Aggregator** → Pre-compute metrics for fast queries

## API Design

All endpoints return data with complete provenance information:

```json
{
  "value": 1000000,
  "currency": "KES",
  "provenance": [
    {
      "source_document_id": "123",
      "url": "https://treasury.go.ke/budget-2024.pdf",
      "page": 15,
      "snippet": "County Health Allocation: KES 1,000,000",
      "confidence": 0.95
    }
  ]
}
```

### Public Endpoints

- `GET /api/v1/countries` - List countries with summaries
- `GET /api/v1/entities` - Government entities with filters
- `GET /api/v1/entities/:id` - Detailed entity profile
- `GET /api/v1/documents/:id` - Document metadata and download
- `GET /api/v1/search` - Full-text search across all data

### Admin Endpoints

- `POST /api/v1/annotations` - Add comments to budget lines
- `POST /api/v1/documents/upload` - Manual document upload
- `POST /api/v1/verification/:id/approve` - QA approval

## Security & Legal

- **Provenance-first**: Every claim linked to authoritative sources
- **Defamation protection**: Facts + sources, no unsupported allegations
- **Authentication**: Strong auth for admin, 2FA for editors
- **Rate limiting**: Prevent abuse and DoS attacks
- **Data encryption**: At rest and in transit
- **Legal compliance**: FOI laws and local regulations

## Development

### Running Tests

```bash
# Backend tests
cd backend && python -m pytest

# Frontend tests
cd frontend && npm test

# ETL tests
cd etl && python -m pytest
```

### Database Migrations

```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

### Troubleshooting

#### Backend won't start

```bash
# Check Python version (requires 3.9+)
python --version

# Verify virtual environment is activated
which python  # Should point to venv/bin/python

# Install missing dependencies
pip install -r backend/requirements.txt

# Check PostgreSQL is running
psql -U postgres -l

# Verify database exists
psql -U postgres -c "SELECT datname FROM pg_database WHERE datname='audit_app';"
```

#### Frontend can't connect to backend

1. Verify backend is running: `curl http://localhost:8000/health`
2. Check `frontend/.env.local` has correct `NEXT_PUBLIC_API_URL`
3. Check browser console for CORS errors
4. Try clearing browser cache and restarting frontend

#### Port conflicts

```bash
# Backend default: 8000
# Frontend default: 3000

# Change backend port:
uvicorn main:app --reload --port 8001

# Change frontend port:
PORT=3001 npm run dev
```

### Deployment

```bash
# Build and deploy
docker-compose up -d
# or
./scripts/deploy.sh
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [docs/](./docs/)
- Issues: [GitHub Issues](https://github.com/yourusername/audit_app/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/audit_app/discussions)
