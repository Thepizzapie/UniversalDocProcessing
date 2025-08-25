# Document Extraction and Reconciliation (DER) Pipeline

> **⚠️ Work in Progress**: This project is under active development. Not all features may be fully functional at this time.

An automated document processing system that extracts, validates, and reconciles structured data from any document type using AI and machine learning technologies. The system leverages intelligent agents to handle diverse document formats and integrates with internal databases for streamlined data processing workflows.

## Project Structure

This repository contains two main components:

### 🔧 **DER Pipeline** (`der_pipeline/`)
Core backend API built with FastAPI that provides document processing capabilities. Standalone pipeline that can be deployed independently.

### 🎨 **Test Web Application** (`test_web_app/`)
React-based testing interface that provides document processing workflow management and debugging tools.

## Overview

The DER Pipeline handles the complete lifecycle of document processing for any document type a user needs processed, from initial ingestion through final approval and database integration. The system uses AI agents that can adapt to process any document format, whether invoices, receipts, contracts, forms, or custom business documents.

**Key AI Agent Capabilities:**
- **Universal Document Processing**: AI agents automatically adapt to extract data from any document type without predefined templates
- **Intelligent Field Extraction**: Agents identify and extract relevant fields based on document context and user-defined schemas
- **External Data Integration**: Agents fetch and validate data from external sources to enhance reconciliation accuracy
- **Database Integration**: Processed data can be seamlessly integrated into internal database systems
- **Adaptive Learning**: Agents improve extraction accuracy through processing experience and user corrections

The pipeline implements a five-stage workflow with intelligent agents handling extraction, human-in-the-loop validation, automated external data fetching, and AI-powered reconciliation for data accuracy and completeness.

## Architecture

### Core Components

**Backend API (FastAPI)**
- RESTful API endpoints for each pipeline stage
- SQLModel-based data persistence with SQLite
- Integration with OpenAI GPT models for intelligent processing
- CrewAI agents for universal document analysis and processing
- External data source integration capabilities
- Database export and integration endpoints

**Frontend Interface (React)**
- Interactive web interface for document management
- Real-time pipeline status monitoring
- Human review and correction capabilities
- AI debugging and analysis tools

**Intelligence Layer**
- AI agents capable of processing any document type without predefined templates
- RAG (Retrieval Augmented Generation) knowledge base for contextual processing
- Dynamic document type classification and adaptive field extraction
- AI-powered debugging and performance analysis
- Semantic search for reference data matching and external data integration
- Intelligent reconciliation agents for data validation and conflict resolution

### Pipeline Stages

1. **Ingestion**: AI agents analyze and process any document type automatically
2. **Human-in-the-Loop (HIL)**: Manual review and correction of agent-extracted data
3. **Fetch**: AI agents retrieve comparative data from external sources and APIs
4. **Reconciliation**: Intelligent agents compare, validate, and resolve data conflicts
5. **Finalization**: Final approval with automated export to internal database systems

## Document Types

While the AI agents can process any document type, the system includes optimized processing for common business document categories:

**Invoices**
- Vendor information and contact details
- Line item extraction with quantities and pricing
- Tax calculations and payment terms
- Invoice numbering and date validation

**Receipts**
- Merchant identification and transaction details
- Item-level purchase information
- Payment method and amount verification
- Receipt numbering and timestamp extraction

**Entry/Exit Logs**
- Personnel identification and access tracking
- Location and time-based validation
- Authorization verification
- Badge and vehicle information processing

## Key Features

### Universal AI Document Processing
AI agents use advanced language models including GPT-4o with vision capabilities to automatically process any document type without requiring predefined templates or schemas. The agents adapt to extract relevant structured data from text and image documents, learning to identify important fields based on document context and user requirements. Supports direct OCR processing of scanned documents and images through OpenAI's vision API, making it possible to process any document format a user needs.

### AI Agent Reconciliation & External Data Integration
Intelligent reconciliation agents automatically fetch and validate data from external sources and APIs to enhance accuracy. The agents can integrate with internal database systems and external data providers to cross-reference extracted information. A vector-based RAG knowledge repository stores reference data for improved reconciliation accuracy, allowing agents to learn from previous processing decisions and maintain context-aware reference documents for better matching.

### AI-Powered Debugging
Comprehensive debugging tools analyze each pipeline stage, providing insights into extraction quality, reconciliation mismatches, and performance bottlenecks. The system offers actionable recommendations for improving processing accuracy.

### Human-in-the-Loop Validation
When automatic extraction confidence falls below defined thresholds, documents are routed for human review. The interface provides intuitive correction tools with confidence scoring and field-level validation.

### Audit Trail
Complete processing history tracking with state transitions, user actions, and system decisions. All modifications are logged with timestamps and actor identification for compliance and quality assurance.

## Technology Stack

**Backend Technologies**
- Python 3.8+ with FastAPI framework
- SQLModel for database operations and schema management
- LangChain for LLM integration and prompt engineering
- CrewAI for multi-agent document processing workflows
- OpenAI GPT models (GPT-4o) with vision capabilities for text and image processing
- Sentence Transformers for vector embeddings and semantic search

**Frontend Technologies**
- React 18 with modern hooks and functional components
- Tailwind CSS for responsive design and styling
- Axios for API communication
- Lucide React for consistent iconography
- React Router for client-side navigation

**Infrastructure**
- SQLite for development and testing environments
- RESTful API design with OpenAPI documentation
- Cross-origin resource sharing (CORS) support
- Structured logging with audit capabilities

## Quick Start

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- OpenAI API key for language model access

### 1. Start the DER Pipeline (Backend)
```bash
cd der_pipeline

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
echo "OPENAI_API_KEY=your_api_key_here" > .env

# Initialize the database
python -c "from app.db import create_tables; create_tables()"

# Start the API server
python -m app.main
```

### 2. Start the Test Web Application (Frontend)
```bash
cd test_web_app

# Install Node.js dependencies
npm install

# Start the development server
npm start
```

The test application will be available at `http://localhost:3000` with the API running on `http://localhost:8080`.

### 3. One-Command Startup (Optional)
```bash
# Start both components with a single command
python start.py
```

This will automatically start both the DER Pipeline API and Test Web Application.

## Component Documentation

For detailed setup and usage instructions:
- **DER Pipeline**: See `der_pipeline/README.md` for API documentation, deployment, and integration
- **Test Web App**: See `test_web_app/README.md` for UI features, development, and testing workflows

## Startup Scripts

The project includes convenient startup scripts:
- **`start.py`** - Master script that starts both components
- **`der_pipeline/start.py`** - Starts only the API backend
- **`test_web_app/start.js`** - Starts only the React frontend

## Usage

### Document Processing Workflow

1. **Upload Any Document Type**: Use the web interface to upload any document format - text files, images (JPG, PNG), PDFs, or custom business documents. AI agents automatically adapt to process the document without requiring predefined templates.

2. **Type Classification**: Select or allow automatic detection of document type to enable specialized processing workflows.

3. **Review Extractions**: Monitor automatic extraction results and provide corrections when confidence scores indicate potential issues.

4. **External Data Integration**: AI agents automatically fetch and validate data from configured external sources and APIs for comparative analysis.

5. **Agent Reconciliation**: Intelligent agents automatically compare, validate, and resolve data conflicts using AI-powered analysis and recommendations.

6. **Database Integration**: Final approval triggers automated export and integration with internal database systems, complete with audit trail documentation.

### Knowledge Base Management

The RAG interface allows:
- Adding reference documents for improved reconciliation accuracy
- Searching existing knowledge base entries using semantic similarity
- Tagging and categorizing reference data for efficient retrieval
- Seeding the system with sample data for testing and validation

### Debugging and Analysis

AI-powered debugging tools provide:
- Analysis of extraction quality and improvement opportunities
- Review of reconciliation mismatches and processing strategies
- Examination of human correction patterns for model training insights
- Monitoring of pipeline performance and processing bottlenecks

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for AI processing capabilities (supports GPT-4o vision)
- `DATABASE_URL`: SQLite database connection string  
- `DEBUG`: Enable debug logging and verbose output
- `CREWAI_ENABLED`: Toggle CrewAI agent processing
- `LLM_MODEL`: AI model selection (gpt-4o, gpt-5, gpt-5-nano)
- `LLM_TEMPERATURE`: AI response variability (0.0-1.0)

### Web-Based Configuration
The Settings page in the web interface provides:
- AI model selection and parameter configuration
- Custom extraction instructions per document type
- Custom field and schema definitions for JSON output
- Processing confidence threshold adjustment
- OpenAI API key management

### Processing Parameters
- Confidence thresholds for human review routing
- Reconciliation strategies (strict, loose, fuzzy matching)
- External API timeout and retry configurations
- Document type templates and validation rules

## API Documentation

The system provides comprehensive API documentation through OpenAPI specifications. Access the interactive documentation at `http://localhost:8080/docs` when the server is running.

Key endpoint categories:
- Document ingestion and management
- Human-in-the-loop operations
- External data fetching and integration
- Reconciliation and conflict resolution
- Reporting and audit trail access
- Knowledge base and debugging tools

## Development

The project follows standard software development practices with modular architecture and comprehensive testing. The codebase uses clear separation of concerns with dedicated modules for data models, business logic, API endpoints, and user interface components.

Development features include:
- Type hints and documentation for all public interfaces
- Unit tests for core business logic
- Integration tests for API endpoints
- Code formatting with industry-standard tools
- Comprehensive logging for debugging and monitoring
