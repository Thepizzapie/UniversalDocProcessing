# DER Pipeline Test Web Application

A comprehensive React-based testing interface for the Document Extraction and Reconciliation (DER) Pipeline. This web application provides an intuitive interface for testing, debugging, and managing document processing workflows.

## Overview

The Test Web Application is designed to interact with the DER Pipeline API, providing a user-friendly interface for:
- Processing documents through the complete pipeline
- Managing RAG knowledge base entries
- AI-powered debugging and analysis
- System health monitoring
- Pipeline performance review

## Features

### Document Processing Interface
- **Document Upload**: Support for file uploads and URL ingestion
- **Document Type Selection**: Specialized processing for different document types
- **Pipeline Monitoring**: Real-time status tracking through all 5 stages
- **Human-in-the-Loop**: Interactive correction and validation interface

### RAG Knowledge Management
- **Reference Document Upload**: Add knowledge base entries for improved reconciliation
- **Semantic Search**: Find relevant reference documents using AI-powered search
- **Document Organization**: Tag-based categorization and filtering
- **Sample Data Management**: Easy seeding of test reference data

### AI Debugging Tools
- **Stage-Specific Analysis**: Debug extraction, reconciliation, HIL, and performance
- **Intelligent Recommendations**: AI-powered suggestions for improvement
- **Visual Confidence Indicators**: Quality scoring and validation insights
- **Debug History**: Track analysis sessions and recommendations

### System Monitoring
- **Health Dashboard**: API and AI service status monitoring
- **Performance Metrics**: Pipeline timing and bottleneck analysis
- **Error Tracking**: Comprehensive error logging and reporting

## Architecture

### Technology Stack
- **React 18**: Modern functional components with hooks
- **React Router**: Client-side navigation and routing
- **Tailwind CSS**: Utility-first styling framework
- **Axios**: HTTP client for API communication
- **Lucide React**: Consistent icon library

### Component Structure
```
test_web_app/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── DebugPanel.js       # AI debugging interface
│   │   ├── Navbar.js           # Navigation component
│   │   ├── PipelineStatus.js   # Status visualization
│   │   └── RagManager.js       # RAG management component
│   ├── pages/
│   │   ├── Dashboard.js        # Main overview page
│   │   ├── DocumentDetail.js   # Individual document view
│   │   ├── DocumentUpload.js   # Document processing upload
│   │   ├── RagUpload.js        # Knowledge base upload
│   │   ├── RagManager.js       # Reference management
│   │   └── SystemHealth.js     # System monitoring
│   ├── services/
│   │   └── api.js              # API integration layer
│   ├── App.js                  # Main application component
│   ├── index.js               # Application entry point
│   └── index.css              # Global styles
├── package.json               # Dependencies and scripts
├── tailwind.config.js         # Tailwind configuration
└── README.md                  # This file
```

## Installation

### Prerequisites
- Node.js 16+
- npm or yarn
- Running DER Pipeline API (see `../der_pipeline/README.md`)

### Setup
```bash
cd test_web_app

# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:3000`.

### Configuration
The app expects the DER Pipeline API to be running at `http://localhost:8080`. To change this:

1. Update the `baseURL` in `src/services/api.js`
2. Or set environment variables in `.env`:
```bash
REACT_APP_API_BASE_URL=http://your-api-server:8080
```

## Usage Guide

### Document Processing Workflow

1. **Navigate to Process Documents** (`/upload`)
2. **Select Document Type**: Choose from Invoice, Receipt, Entry/Exit Log, or Unknown
3. **Upload Document**: Use file upload or provide a URL
4. **Monitor Pipeline**: Watch the document progress through all 5 stages
5. **Review and Correct**: Use HIL interface for manual validation when needed
6. **Debug Issues**: Use AI debugging tools for quality analysis

### RAG Knowledge Base Management

1. **Navigate to RAG Knowledge** (`/rag-upload`)
2. **Select Document Type**: Choose the appropriate category
3. **Add Reference Data**: Provide JSON reference data with descriptions and tags
4. **Use Templates**: Load pre-built templates for common document types
5. **Manage References**: Browse and search existing knowledge base entries

### AI Debugging Workflow

1. **Open Document Detail**: View any processed document
2. **Access Debug Tab**: Switch to the AI Debug section
3. **Run Analysis**: Click quick analysis buttons for different pipeline stages
4. **Review Results**: Examine AI recommendations and confidence scores
5. **Track History**: Review previous debug sessions and improvements

### System Health Monitoring

1. **Navigate to System Health** (`/health`)
2. **Check API Status**: Verify backend connectivity
3. **Monitor AI Services**: Ensure OpenAI integration is working
4. **Test Functionality**: Run quick extraction tests
5. **Review Performance**: Monitor response times and error rates

## API Integration

The web application communicates with the DER Pipeline API through a comprehensive service layer:

### Core Services
- **Document Processing**: Upload, HIL, fetch, reconcile, finalize operations
- **RAG Management**: Create, search, and manage reference documents
- **AI Debugging**: Stage-specific analysis and recommendations
- **System Health**: API and AI service monitoring

### Error Handling
- Automatic retry for transient failures
- User-friendly error messages
- Detailed logging for debugging
- Graceful degradation for offline scenarios

## Development

### Adding New Features

1. **Create Components**: Add new React components in `src/components/`
2. **Add Routes**: Update `App.js` with new route definitions
3. **Extend API Service**: Add new endpoints in `src/services/api.js`
4. **Update Navigation**: Modify `Navbar.js` for new pages

### Styling Guidelines

- Use Tailwind utility classes for consistent styling
- Follow existing color scheme (blue primary, gray neutrals)
- Maintain responsive design patterns
- Use Lucide React icons for consistency

### State Management

The application uses React's built-in state management:
- `useState` for local component state
- `useEffect` for side effects and API calls
- Props for component communication
- Context API for global state (if needed)

## Testing

### Manual Testing Workflows

1. **Document Processing**: Test complete pipeline with different document types
2. **RAG Functionality**: Add references and verify search functionality
3. **AI Debugging**: Validate analysis quality and recommendations
4. **Error Scenarios**: Test error handling and recovery

### Browser Compatibility
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (responsive design)

## Deployment

### Development Build
```bash
npm start
```

### Production Build
```bash
npm run build
```

The build artifacts will be in the `build/` directory, ready for static hosting.

### Hosting Options
- **Static Hosting**: Netlify, Vercel, GitHub Pages
- **Server Hosting**: Nginx, Apache with build artifacts
- **Container Deployment**: Docker with Node.js or static server

### Environment Configuration
Create `.env` files for different environments:
```bash
# .env.production
REACT_APP_API_BASE_URL=https://your-production-api.com
REACT_APP_ENV=production
```

## Troubleshooting

### Common Issues

**API Connection Failed**
- Verify DER Pipeline is running on correct port
- Check CORS configuration in backend
- Update API base URL in configuration

**Build Failures**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version compatibility
- Verify all dependencies are compatible

**Styling Issues**
- Ensure Tailwind CSS is properly configured
- Check for conflicting CSS rules
- Verify PostCSS configuration

## Contributing

This test application serves as both a functional testing tool and a reference implementation for DER Pipeline integration. Contributions should focus on:

- Improving user experience and interface design
- Adding comprehensive testing scenarios
- Enhancing debugging and monitoring capabilities
- Expanding documentation and examples

## Support

For questions about the test web application:
- Review the component documentation
- Check the API service integration examples
- Test with the provided sample data and workflows
- Refer to the DER Pipeline API documentation

## License

This project is licensed under the MIT License.