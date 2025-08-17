#!/usr/bin/env python3
"""
Setup script for the Document AI Framework.

This script helps users get started quickly by:
1. Checking Python version compatibility
2. Installing dependencies
3. Setting up configuration
4. Validating the installation
"""

import shutil
import subprocess
import sys
from pathlib import Path


def check_python_version():
    """Check if Python version is compatible."""
    if sys.version_info < (3, 8):
        print("❌ Error: Python 3.8 or higher is required")
        print(f"   Current version: {sys.version}")
        sys.exit(1)
    print(f"✅ Python version: {sys.version.split()[0]}")


def install_dependencies():
    """Install Python dependencies."""
    print("\n📦 Installing Python dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        sys.exit(1)


def setup_environment():
    """Set up environment configuration."""
    print("\n⚙️  Setting up environment configuration...")

    env_file = Path(".env")
    env_example = Path("env.example")

    if env_file.exists():
        print("✅ .env file already exists")
        return

    if env_example.exists():
        shutil.copy(env_example, env_file)
        print("✅ Created .env from template")
        print("📝 Please edit .env and add your OPENAI_API_KEY")
    else:
        # Create a basic .env file
        with open(env_file, "w") as f:
            f.write("# Document AI Framework Configuration\n")
            f.write("# Add your OpenAI API key below:\n")
            f.write("OPENAI_API_KEY=sk-your-openai-api-key-here\n")
            f.write("MODEL_NAME=gpt-4o\n")
        print("✅ Created basic .env file")
        print("📝 Please edit .env and add your OPENAI_API_KEY")


def validate_installation():
    """Validate that the framework is properly installed."""
    print("\n🔍 Validating installation...")

    try:
        # Test import
        sys.path.insert(0, str(Path.cwd()))
        from document_processing.config import get_config

        get_config()  # Test that config can be loaded
        print("✅ Framework modules import successfully")

        # Check for required dependencies
        missing = []
        try:
            # Test package availability using importlib
            import importlib.util

            packages = ["fastapi", "langchain_openai", "pdf2image", "pytesseract", "uvicorn"]
            for pkg in packages:
                if importlib.util.find_spec(pkg) is None:
                    missing.append(pkg)

            if not missing:
                print("✅ All required packages are available")
        except ImportError as e:
            missing.append(str(e))

        if missing:
            print("⚠️  Some optional dependencies are missing:")
            for m in missing:
                print(f"   - {m}")

        # Check OCR tools
        if shutil.which("tesseract"):
            print("✅ Tesseract OCR is available")
        else:
            print("⚠️  Tesseract OCR not found in PATH")
            print("   For full functionality, install Tesseract or use Docker")

        print("\n🎉 Installation validation completed!")

    except Exception as e:
        print(f"❌ Validation failed: {e}")
        sys.exit(1)


def print_next_steps():
    """Print next steps for the user."""
    print("\n" + "=" * 60)
    print("🚀 NEXT STEPS")
    print("=" * 60)
    print()
    print("1. Edit .env file and add your OpenAI API key:")
    print("   OPENAI_API_KEY=sk-your-actual-key-here")
    print()
    print("2. Start the API service:")
    print("   python main.py")
    print()
    print("3. Or start the demo web app:")
    print("   SET SERVICE_TYPE=demo && python main.py")
    print()
    print("4. Test with Docker (includes all dependencies):")
    print("   docker build -t doc-ai .")
    print("   docker run -p 8080:8080 -e OPENAI_API_KEY=your-key doc-ai")
    print()
    print("📚 For more information, see README.md")
    print("=" * 60)


def main():
    """Main setup function."""
    print("🔧 Document AI Framework Setup")
    print("=" * 40)

    check_python_version()
    install_dependencies()
    setup_environment()
    validate_installation()
    print_next_steps()


if __name__ == "__main__":
    main()
