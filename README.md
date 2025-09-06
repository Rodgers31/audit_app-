# Government Financial Transparency Audit Application

A comprehensive platform for transparent, auditable publication of government allocations, spending, borrowing, and audits with extensible multi-country support.

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

```
audit_app/
├── backend/           # FastAPI backend
├── frontend/          # Next.js frontend
├── etl/              # Data extraction and processing
├── infra/            # Deployment configurations
├── admin/            # Admin UI components
└── docs/             # Documentation
```

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 13+
- Redis (for caching)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Configure your .env file
alembic upgrade head
uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Configure your .env.local file
npm run dev
```

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
