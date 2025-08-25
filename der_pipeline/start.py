#!/usr/bin/env python3
"""
DER Pipeline Startup Script

Quick startup script for the Document Extraction and Reconciliation Pipeline.
"""

import os
import sys
from pathlib import Path

def main():
    """Start the DER Pipeline API server."""
    
    # Ensure we're in the correct directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print("🚀 Starting DER Pipeline API Server...")
    print(f"📁 Working directory: {os.getcwd()}")
    
    # Check for .env file
    if not os.path.exists('.env'):
        print("⚠️  No .env file found. Please create one with your OPENAI_API_KEY")
        print("   Example: echo 'OPENAI_API_KEY=your_key_here' > .env")
        return 1
    
    # Check for database
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from app.db import create_tables
        print("📊 Initializing database...")
        create_tables()
        print("✅ Database ready")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return 1
    
    # Start the server
    try:
        from app.config import settings
        print(f"🌐 Starting FastAPI server on http://{settings.host}:{settings.port}")
        print(f"📚 API Documentation: http://{settings.host}:{settings.port}/docs")
        print(f"🔍 Health Check: http://{settings.host}:{settings.port}/health")
        print("\nPress Ctrl+C to stop the server\n")

        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from app.main import app
        import uvicorn
        from app.config import settings
        uvicorn.run(app, host=settings.host, port=settings.port, log_level="info")
        
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
        return 0
    except Exception as e:
        print(f"❌ Server startup failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
