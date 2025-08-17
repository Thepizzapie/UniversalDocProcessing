@echo off
echo Document AI Framework Setup for Windows
echo =====================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

echo Running setup script...
python setup.py

echo.
echo Setup completed! Press any key to continue...
pause >nul
