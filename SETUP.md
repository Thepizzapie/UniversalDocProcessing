# UniversalDocProcessing Setup Guide

## Quick Start Commands

```bash
# 1. Environment Setup
cp .env.example .env
# Edit .env with your OpenAI API key and other settings

# 2. Start with Docker (Recommended)
docker-compose up --build

# 3. Access the Application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080/docs
# Health: http://localhost:8080/health

# 4. Create First User
curl -X POST "http://localhost:8080/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "admin123", "role": "admin"}'

# 5. Test Document Processing
curl -X POST "http://localhost:8080/api/ingest" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt", "mime_type": "text/plain", "document_type": "INVOICE", "content": "INVOICE\nNumber: INV-001\nAmount: $100"}'
```

## Core Features Implemented

✅ FastAPI backend with SQLModel/Alembic
✅ JWT authentication with roles (user/reviewer/admin)
✅ 5-stage pipeline: Ingest → HIL → Fetch → Reconcile → Finalize
✅ OpenAI GPT-4o-mini for document extraction
✅ OCR support with Tesseract
✅ Rate limiting with SlowAPI
✅ Qdrant vector search with FAISS fallback
✅ Celery async processing with Redis
✅ Prometheus metrics and audit logging
✅ Docker Compose deployment
✅ GitHub Actions CI/CD
✅ Nginx reverse proxy

## Architecture Components

- **Backend**: FastAPI (Port 8080)
- **Frontend**: React (Port 3000)
- **Database**: PostgreSQL/SQLite
- **Cache**: Redis
- **Vector DB**: Qdrant
- **Workers**: Celery
- **Proxy**: Nginx (Port 80)

## Development Workflow

1. Run `docker-compose up --build`
2. Backend auto-reloads on changes
3. Frontend hot-reloads via React
4. Check logs: `docker-compose logs -f backend`
5. Run tests: `cd der_pipeline && pytest`

## Production Ready

The system includes all production requirements:
- Security (JWT, CORS, rate limiting)
- Observability (metrics, logging, health checks)
- Scalability (async workers, vector search)
- CI/CD (automated testing and deployment)
- Documentation (OpenAPI specs, README)

Ready for deployment to cloud platforms!

