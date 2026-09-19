# Auto-configure Go Environment Variables (Go 1.27.1 at C:\Program Files\Go)
$env:GOROOT = "C:\Program Files\Go"
$env:PATH = "C:\Program Files\Go\bin;" + $env:PATH

Write-Host "🚀 Launching Real-Time Live Polling Engine (Go + Gin + MongoDB + Redis)..." -ForegroundColor Green
Write-Host "   Backend: http://localhost:8080" -ForegroundColor Cyan
Write-Host "   Health:  http://localhost:8080/api/health" -ForegroundColor Cyan

Set-Location "c:\Users\Irfan\Downloads\HCL Project\backend"
& "C:\Program Files\Go\bin\go.exe" run ./cmd/server
