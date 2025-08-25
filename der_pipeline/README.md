# DER Pipeline - Document Extraction and Reconciliation API

The core backend API for the Document Extraction and Reconciliation (DER) pipeline. A FastAPI application that provides intelligent document processing capabilities.

## Overview

The DER Pipeline is a comprehensive document processing system that automates the extraction, validation, and reconciliation of structured data from business documents using AI and machine learning technologies.

## Features

- **5-Stage Processing Pipeline**: Ingest → HIL → Fetch → Reconcile → Finalize
- **AI-Powered Extraction**: Uses OpenAI GPT models for intelligent data extraction
- **Document Type Classification**: Specialized processing for Invoices, Receipts, and Entry/Exit Logs
- **RAG Knowledge Base**: Vector-based reference system for improved reconciliation accuracy
- **Human-in-the-Loop Validation**: Manual review and correction capabilities
- **AI Debugging Tools**: Intelligent analysis and recommendations for each pipeline stage
- **Comprehensive API**: RESTful endpoints with OpenAPI documentation

## Architecture

### Core Components

- **FastAPI Application**: High-performance API with automatic documentation
- **CrewAI Agents**: Specialized AI agents for document processing tasks
- **RAG System**: Vector search and semantic matching for reference data
- **SQLModel Database**: Type-safe database operations with SQLite
- **AI Services**: OpenAI integration with intelligent prompt engineering

### Pipeline Stages

1. **Ingestion**: Document upload and initial processing
2. **Human-in-the-Loop (HIL)**: Manual review and correction
3. **Fetch**: External data retrieval for validation
4. **Reconciliation**: AI-powered comparison and conflict resolution
5. **Finalization**: Final approval with complete audit trail

## Installation

### Prerequisites
- Python 3.8+
- OpenAI API key

### Setup
```bash
cd der_pipeline

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
echo "OPENAI_API_KEY=your_api_key_here" > .env

# Initialize database
python -c "from app.db import create_tables; create_tables()"

# Start the API server
python -m app.main
```

The API will be available at `http://localhost:8080` with interactive documentation at `http://localhost:8080/docs`.

## API Endpoints

### Core Pipeline
- `POST /api/ingest` - Upload and process documents
- `GET/POST /api/hil/{document_id}` - Human-in-the-loop operations
- `POST /api/fetch/{document_id}` - External data fetching
- `POST /api/reconcile/{document_id}` - Data reconciliation
- `POST /api/finalize/{document_id}` - Final processing decisions

### Document Management
- `GET /api/reports/documents` - List all documents
- `GET /api/reports/{document_id}` - Get detailed document report
- `GET /api/document-types/templates` - Get document type templates
- `PUT /api/document-types/{document_id}/type` - Update document type

### RAG System
- `POST /api/rag/documents` - Add reference documents
- `GET /api/rag/documents/{document_type}` - Get references by type
- `POST /api/rag/search` - Semantic search
- `POST /api/rag/seed-sample-data` - Load sample reference data

### AI Debugging
- `POST /api/debug/extraction/{document_id}` - Debug extraction issues
- `POST /api/debug/reconciliation/{document_id}` - Debug reconciliation
- `POST /api/debug/hil/{document_id}` - Analyze HIL feedback
- `POST /api/debug/performance/{document_id}` - Performance analysis

### System Health
- `GET /api/health` - API health check
- `GET /api/ai-health` - AI services status
- `POST /api/ai-health/test` - Test AI extraction

## Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional
DATABASE_URL=sqlite:///./app.db
DEBUG=false
CREWAI_ENABLED=true
OCR_ENABLED=false
```

### Processing Configuration
- **Confidence Thresholds**: Automatic vs. manual review routing
- **Reconciliation Strategies**: STRICT, LOOSE, FUZZY matching
- **Document Templates**: Type-specific field validation
- **AI Model Settings**: Temperature, token limits, timeouts

## Document Types

### Invoices
- Vendor information and tax IDs
- Line items with quantities and pricing
- Payment terms and due dates
- Currency and regional formatting

### Receipts
- Merchant identification
- Transaction details and timestamps
- Payment methods and amounts
- Item-level purchase information

### Entry/Exit Logs
- Personnel identification
- Access control and authorization
- Time-based validation
- Security protocols and badge information

## AI Capabilities

### Intelligent Extraction
- Context-aware field identification
- Document type classification
- Confidence scoring for quality assessment
- Error detection and correction suggestions

### RAG-Enhanced Reconciliation
- Vector similarity matching
- Historical pattern recognition
- Reference data integration
- Contextual validation rules

### AI Debugging
- Extraction quality analysis
- Reconciliation mismatch detection
- Performance bottleneck identification
- Actionable improvement recommendations

## Development

### Project Structure
```
der_pipeline/
├── app/
│   ├── adapters/         # External integrations
│   ├── agents/           # CrewAI processing agents
│   ├── routers/          # API route definitions
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   ├── config.py         # Configuration management
│   ├── db.py             # Database setup
│   ├── models.py         # Data models
│   ├── schemas.py        # API schemas
│   └── main.py           # Application entry point
├── requirements.txt      # Python dependencies
├── pyproject.toml        # Project configuration
└── README.md            # This file
```

### Adding New Document Types
1. Update `DocumentType` enum in `enums.py`
2. Create type-specific schema in `schemas.py`
3. Add template in `document_types.py` router
4. Update agent prompts for specialized processing

### Extending AI Capabilities
1. Add new CrewAI agents in `agents/` directory
2. Create specialized tools and prompts
3. Update service layer integration
4. Add corresponding API endpoints

## Testing

The DER Pipeline includes comprehensive testing capabilities:

- **Unit Tests**: Core business logic validation
- **Integration Tests**: API endpoint testing
- **Performance Tests**: Load and stress testing
- **AI Quality Tests**: Model accuracy validation

## Production Deployment

### Database
- Migrate from SQLite to PostgreSQL for production
- Configure connection pooling and optimization
- Set up backup and recovery procedures

### Scaling
- Deploy with container orchestration (Docker/Kubernetes)
- Configure load balancing and auto-scaling
- Implement monitoring and alerting

### Security
- API authentication and authorization
- Rate limiting and request validation
- Secure storage of API keys and credentials
- Data encryption in transit and at rest

## Support

For technical questions, feature requests, or integration support:
- Review the API documentation at `/docs`
- Check the comprehensive test suite examples
- Refer to the configuration options and environment variables

## License

This project is licensed under the MIT License.
