# UDP - Parser Services Startup Script
# This script starts both the Docker backend and React frontend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  UDP - Parser Services Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill any existing services
Write-Host "[1/4] Stopping existing services..." -ForegroundColor Yellow

# Stop and remove Docker container if it exists
$container = docker ps -a -q -f name=doc-ai
if ($container) {
    Write-Host "  - Stopping Docker container 'doc-ai'..." -ForegroundColor Gray
    docker stop doc-ai 2>$null
    docker rm doc-ai 2>$null
    Write-Host "  - Docker container stopped" -ForegroundColor Green
} else {
    Write-Host "  - No Docker container running" -ForegroundColor Gray
}

# Kill any process on port 8080 (backend)
Write-Host "  - Checking port 8080..." -ForegroundColor Gray
$port8080 = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($port8080) {
    $processId = $port8080.OwningProcess
    Write-Host "  - Killing process on port 8080 (PID: $processId)..." -ForegroundColor Gray
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "  - Port 8080 freed" -ForegroundColor Green
} else {
    Write-Host "  - Port 8080 is free" -ForegroundColor Gray
}

# Kill any process on port 3000 (frontend)
Write-Host "  - Checking port 3000..." -ForegroundColor Gray
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    $processId = $port3000.OwningProcess
    Write-Host "  - Killing process on port 3000 (PID: $processId)..." -ForegroundColor Gray
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "  - Port 3000 freed" -ForegroundColor Green
} else {
    Write-Host "  - Port 3000 is free" -ForegroundColor Gray
}

# Kill any node processes (extra safety)
Write-Host "  - Cleaning up Node.js processes..." -ForegroundColor Gray
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  - Node.js processes cleaned" -ForegroundColor Green

Write-Host ""

# Step 2: Start Docker Backend
Write-Host "[2/4] Starting Docker backend..." -ForegroundColor Yellow

# Check if image exists
$imageExists = docker images -q doc-ai
if (-not $imageExists) {
    Write-Host "  - Docker image 'doc-ai' not found. Building..." -ForegroundColor Gray
    Set-Location "d:\UDP - Parser"
    docker build -t doc-ai .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Docker build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  - Docker image built successfully" -ForegroundColor Green
} else {
    Write-Host "  - Docker image 'doc-ai' found" -ForegroundColor Gray
}

# Start container
Write-Host "  - Starting Docker container..." -ForegroundColor Gray
$apiKey = "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"
docker run -d -p 8080:8080 -e OPENAI_API_KEY=$apiKey --name doc-ai doc-ai

if ($LASTEXITCODE -eq 0) {
    Write-Host "  - Docker container started successfully" -ForegroundColor Green
    Write-Host "  - Backend API: http://localhost:8080" -ForegroundColor Cyan
} else {
    Write-Host "  ERROR: Failed to start Docker container!" -ForegroundColor Red
    exit 1
}

# Wait for backend to be ready
Write-Host "  - Waiting for backend to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Check if backend is responding
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/docs" -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "  - Backend is ready!" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Backend may still be starting up..." -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Start React Frontend
Write-Host "[3/4] Starting React frontend..." -ForegroundColor Yellow

Set-Location "d:\UDP - Parser\web-app"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "  - node_modules not found. Running npm install..." -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: npm install failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  - Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  - Dependencies already installed" -ForegroundColor Gray
}

# Start dev server in new window
Write-Host "  - Starting development server..." -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\UDP - Parser\web-app'; npm run dev"

Write-Host "  - Frontend starting in new window..." -ForegroundColor Green
Write-Host "  - Frontend UI: http://localhost:3000" -ForegroundColor Cyan

Write-Host ""

# Step 4: Summary
Write-Host "[4/4] Services started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Services Running:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend API:  http://localhost:8080" -ForegroundColor White
Write-Host "  Frontend UI:  http://localhost:3000" -ForegroundColor White
Write-Host "  API Docs:     http://localhost:8080/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Docker Logs:  docker logs -f doc-ai" -ForegroundColor Gray
Write-Host "  Stop All:     .\stop_services.ps1" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Opening browser in 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"
