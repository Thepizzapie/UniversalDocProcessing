# UniversalDocProcessing

AI-powered document processing system with type-specific extraction, authentication, and reconciliation capabilities.

## Features

- **Document Processing**: Extract structured data from invoices, receipts, entry/exit logs, and unknown document types
- **Authentication**: JWT-based user management with role-based access control
- **AI Integration**: CrewAI agents with OpenAI GPT models for intelligent extraction
- **Pipeline Workflow**: 5-stage processing (ingest → HIL → fetch → reconcile → finalize)
- **Dynamic Configuration**: Runtime settings reload without server restart
- **Audit Trail**: Complete processing history with correlation IDs
- **RAG System**: Knowledge base with Qdrant/FAISS fallback

## Architecture

### Backend (FastAPI)
- SQLModel with SQLite/PostgreSQL support
- Alembic database migrations
- Rate limiting and CORS
- Comprehensive audit logging
- Multi-connector fetch system

### Frontend (React)
- Document upload with type selection
- Human-in-the-loop correction interface
- Pipeline status monitoring
- Settings management

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 16+
- OpenAI API key

### Setup
```bash
# Backend
cd der_pipeline
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your OpenAI API key
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

# Frontend (separate terminal)
cd test_web_app
npm install
npm start
```

### Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs

## Development

### Project Structure
```
├── der_pipeline/          # FastAPI backend
│   ├── app/
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── agents/        # CrewAI agents
│   │   └── adapters/      # External integrations
│   └── alembic/           # Database migrations
├── test_web_app/          # React frontend
└── .github/workflows/     # CI/CD
```

### Key Commands
```bash
# Format code
make fmt

# Run tests
make test

# Start backend
make dev-backend

# Start frontend
make dev-frontend
```

## Configuration

### Environment Variables
- `OPENAI_API_KEY` - Required for AI processing
- `DATABASE_URL` - SQLite database path
- `POSTGRES_URL` - PostgreSQL connection (optional)
- `REDIS_URL` - Redis for Celery tasks
- `QDRANT_URL` - Vector database
- `JWT_SECRET` - Authentication secret
- `CREWAI_ENABLED` - Enable/disable CrewAI agents
- `LLM_MODEL` - AI model selection
- `RATE_LIMIT_PER_MINUTE` - API rate limiting

### Document Types
The system supports specialized extraction for:
- **Invoice**: vendor_name, invoice_date, total_amount, line_items
- **Receipt**: merchant_name, transaction_date, payment_method, items
- **Entry/Exit Log**: person_name, location, entry_time, badge_number
- **Unknown**: General business document fields with auto-detection

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user info

### Document Processing
- `POST /api/ingest/upload` - Upload document
- `GET /api/hil/{id}` - Get extraction results
- `POST /api/hil/{id}` - Submit corrections
- `POST /api/fetch/{id}` - Fetch external data
- `POST /api/reconcile/{id}` - Compare data
- `POST /api/finalize/{id}` - Approve document

### Management
- `GET /api/health` - System health
- `GET /api/config` - Configuration
- `GET /api/reports/{id}` - Document report
- `GET /api/rag/documents/{type}` - Knowledge base

## Docker Deployment

```bash
# Start full stack
docker-compose up --build

# Services will be available at:
# - Frontend: http://localhost:80
# - Backend: http://localhost:8080
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - Qdrant: http://localhost:6333
```

## License

Private project - All rights reserved