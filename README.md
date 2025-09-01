# UniversalDocProcessing

AI-powered document processing system with intelligent extraction, custom document types, human-in-the-loop validation, and automated reconciliation capabilities.

## 🚀 Current Status

**Phase 1 - Core Infrastructure**: ✅ Complete
- FastAPI backend with SQLModel/Alembic
- JWT authentication with role-based access control  
- 5-stage pipeline architecture (ingest → HIL → fetch → reconcile → finalize)
- React frontend with modern UI/UX

**Phase 2 - Document Processing**: 🚧 In Progress  
- ✅ Custom document type creator with visual schema builder
- ✅ GPT-4 Vision integration for direct image processing (no OCR)
- ✅ Human-in-the-Loop (HIL) correction interface
- 🚧 Advanced extraction processing with CrewAI agents
- 🚧 HIL validation and approval workflow

**Phase 3 - Intelligence & Automation**: 📋 Next
- RAG system for reference data matching
- Automated reconciliation with external systems
- AI-powered debugging and recommendations

## ✨ Key Features

- **🎯 Custom Document Types**: Visual schema builder for any document format
- **🤖 GPT-4 Vision Processing**: Direct image-to-data extraction without OCR
- **👥 Human-in-the-Loop**: Interactive correction and validation interface  
- **🔄 5-Stage Pipeline**: Comprehensive processing workflow with audit trails
- **🏢 Multi-Tenant**: Isolated processing per organization
- **🛡️ Enterprise Security**: JWT authentication, rate limiting, CORS protection
- **📊 Real-time Monitoring**: Pipeline status tracking and system health

## 🏗️ Architecture

### Backend (FastAPI)
- **Database**: SQLModel with SQLite/PostgreSQL + Alembic migrations
- **Authentication**: JWT with role-based access control (user/reviewer/admin)
- **AI Integration**: GPT-4 Vision for direct image processing [[memory:7768133]]
- **Pipeline**: 5-stage processing with state management
- **Security**: Rate limiting, CORS, input validation
- **Monitoring**: Comprehensive audit logging with correlation IDs

### Frontend (React)
- **Document Upload**: File and URL ingestion with type selection
- **Custom Types**: Visual schema builder with AI assistance
- **HIL Interface**: Interactive correction and validation workflows
- **Monitoring**: Real-time pipeline status and system health
- **Settings**: Dynamic configuration management

### Key Components
- **Custom Document Types**: Tenant-specific schema definitions
- **Extraction Engine**: GPT-4 Vision with confidence scoring
- **HIL System**: Human validation with approval workflows
- **Audit System**: Complete processing history and correlation tracking

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 16+
- OpenAI API key (GPT-4 Vision access recommended)

### Setup
```bash
# 1. Backend Setup
cd der_pipeline
pip install -r requirements.txt

# 2. Configuration
# Create .env file or use runtime config via /api/config
export OPENAI_API_KEY="your-api-key-here"
export LLM_MODEL="gpt-4o"  # or gpt-4o-mini for cost optimization

# 3. Start Backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

# 4. Frontend Setup (separate terminal)
cd test_web_app
npm install
npm start
```

### 🌐 Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Documentation**: http://localhost:8080/docs
- **Health Check**: http://localhost:8080/health

### 🔧 Configuration
Configure via web UI at `/settings` or environment variables:
- `OPENAI_API_KEY` - Required for AI processing
- `LLM_MODEL` - AI model selection (gpt-4o, gpt-4o-mini)
- `JWT_SECRET` - Authentication secret (change default!)
- `CREWAI_ENABLED` - Enable advanced AI agents

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

## 🎯 Next Steps & Roadmap

### Immediate Priorities (Current Sprint)
1. **Complete HIL Workflow** 
   - Finish validation and approval logic
   - Add confidence-based auto-approval
   - Implement reviewer assignment and notifications

2. **RAG System Implementation**
   - Vector database integration (Qdrant)
   - Reference document matching
   - Semantic search for validation data

3. **Reconciliation Engine**
   - External system connectors (QuickBooks, Xero, SFTP)
   - Automated matching algorithms
   - Conflict resolution workflows

### Phase 3 Enhancements
- **AI Debugging Tools**: Intelligent analysis and recommendations
- **Performance Optimization**: Caching, async processing, batch operations  
- **Advanced Analytics**: Processing metrics, accuracy tracking, cost analysis
- **Enterprise Features**: SSO integration, advanced RBAC, compliance reporting

### Potential Refinements
- **Model Optimization**: Fine-tuning for specific document types
- **Multi-language Support**: International document processing
- **API Integrations**: Webhook notifications, external validation services
- **Mobile Interface**: Native apps for field document capture
- **Blockchain Integration**: Immutable audit trails and document verification

## 🔒 Security Notes

⚠️ **Important**: This project handles sensitive document data
- Change default JWT secret in production
- Use environment variables for API keys (never commit secrets)
- Enable HTTPS in production deployments
- Regularly rotate API keys and credentials
- Monitor access logs and audit trails

## 📞 Support & Development

For development questions or contributions:
- Review the `/docs` API documentation
- Check system health at `/health` endpoint
- Enable debug mode for detailed logging
- Use the web UI's debug panel for AI analysis

## License

Private project - All rights reserved