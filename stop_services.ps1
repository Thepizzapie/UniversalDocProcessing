# UDP - Parser Services Stop Script
# This script stops both the Docker backend and React frontend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  UDP - Parser Services Shutdown" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop Docker container
Write-Host "[1/3] Stopping Docker container..." -ForegroundColor Yellow
$container = docker ps -q -f name=doc-ai
if ($container) {
    docker stop doc-ai
    docker rm doc-ai
    Write-Host "  - Docker container stopped" -ForegroundColor Green
} else {
    Write-Host "  - No Docker container running" -ForegroundColor Gray
}

# Kill port 8080
Write-Host "[2/3] Freeing port 8080..." -ForegroundColor Yellow
$port8080 = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($port8080) {
    $processId = $port8080.OwningProcess
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "  - Port 8080 freed" -ForegroundColor Green
} else {
    Write-Host "  - Port 8080 already free" -ForegroundColor Gray
}

# Kill port 3000
Write-Host "[3/3] Freeing port 3000..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    $processId = $port3000.OwningProcess
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "  - Port 3000 freed" -ForegroundColor Green
} else {
    Write-Host "  - Port 3000 already free" -ForegroundColor Gray
}

# Clean up Node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "All services stopped!" -ForegroundColor Green
Write-Host ""
