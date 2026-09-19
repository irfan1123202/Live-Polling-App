# ============================================================
# PulsePoll - Real-Time Live Polling Engine
# Full-Stack Startup Script
# Usage: .\start.ps1 [backend|frontend|both]
# ============================================================

param(
    [string]$Mode = "both"
)

# --- Go Environment ---
$env:GOROOT = "C:\Program Files\Go"
$env:PATH   = "C:\Program Files\Go\bin;" + $env:PATH
$GoExe      = "C:\Program Files\Go\bin\go.exe"

$ProjectRoot = "c:\Users\Irfan\Downloads\HCL Project"
$BackendDir  = "$ProjectRoot\backend"
$FrontendDir = "$ProjectRoot\frontend"

function Start-Backend {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor DarkCyan
    Write-Host "  Starting Go + Gin Backend (Port 8080)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor DarkCyan
    Write-Host "  API Base  : http://localhost:8080/api" -ForegroundColor Cyan
    Write-Host "  Health    : http://localhost:8080/api/health" -ForegroundColor Cyan
    Write-Host "  WebSocket : ws://localhost:8080/api/polls/:id/live" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [MongoDB] Using Atlas URI from .env" -ForegroundColor Yellow
    Write-Host "  [Redis]   Connecting to localhost:6379" -ForegroundColor Yellow
    Write-Host "            (Start Redis if not running: docker run -d -p 6379:6379 redis:alpine)" -ForegroundColor DarkYellow
    Write-Host ""
    Set-Location $BackendDir
    & $GoExe run ./cmd/server
}

function Start-Frontend {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor DarkMagenta
    Write-Host "  Starting React + Vite Frontend (:5173)" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor DarkMagenta
    Write-Host "  App URL : http://localhost:5173" -ForegroundColor Cyan
    Write-Host ""

    $NodeExe = Get-Command node -ErrorAction SilentlyContinue
    if (-not $NodeExe) {
        Write-Host "[ERROR] Node.js not found in PATH." -ForegroundColor Red
        Write-Host "        Please install Node.js from https://nodejs.org" -ForegroundColor Yellow
        return
    }

    Set-Location $FrontendDir

    if (-not (Test-Path "$FrontendDir\node_modules")) {
        Write-Host "  Installing npm dependencies..." -ForegroundColor Yellow
        npm install
    }

    npm run dev
}

# ---- Main ----
Write-Host ""
Write-Host "  ██████╗ ██╗   ██╗██╗     ███████╗███████╗██████╗  ██████╗ ██╗     ██╗     " -ForegroundColor Magenta
Write-Host "  ██╔══██╗██║   ██║██║     ██╔════╝██╔════╝██╔══██╗██╔═══██╗██║     ██║     " -ForegroundColor Magenta
Write-Host "  ██████╔╝██║   ██║██║     ███████╗█████╗  ██████╔╝██║   ██║██║     ██║     " -ForegroundColor Magenta
Write-Host "  ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  ██╔═══╝ ██║   ██║██║     ██║     " -ForegroundColor Magenta
Write-Host "  ██║     ╚██████╔╝███████╗███████║███████╗██║     ╚██████╔╝███████╗███████╗" -ForegroundColor Magenta
Write-Host ""
Write-Host "  GUVI / HCL Internship • Real-Time Live Polling Engine" -ForegroundColor DarkGray
Write-Host "  Stack: React | Go+Gin | MongoDB Atlas | Redis Pub/Sub | WebSockets" -ForegroundColor DarkGray
Write-Host ""

switch ($Mode.ToLower()) {
    "backend"  { Start-Backend }
    "frontend" { Start-Frontend }
    "both" {
        # Start backend in new PowerShell window, then start frontend in current window
        Write-Host "  Starting both Backend and Frontend..." -ForegroundColor Green
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$PSCommandPath' -Mode backend" -WindowStyle Normal
        Start-Sleep -Seconds 2
        Start-Frontend
    }
    default {
        Write-Host "Usage: .\start.ps1 [backend|frontend|both]" -ForegroundColor Yellow
    }
}
