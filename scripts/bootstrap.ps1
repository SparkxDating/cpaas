# Local bootstrap for Windows (requires Docker Desktop)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}

Write-Host "Starting infrastructure..."
docker compose up -d postgres redis minio minio-init mailhog

Write-Host "Installing dependencies..."
npm install

Write-Host "Generating Prisma client..."
npm run db:generate

Write-Host "Applying migrations..."
npm run db:migrate

Write-Host "Seeding..."
npm run db:seed

Write-Host "Building packages..."
npm run build -w @cpaas/common
npm run build -w @cpaas/logger
npm run build -w @cpaas/auth
npm run build -w @cpaas/events
npm run build -w @cpaas/database

Write-Host ""
Write-Host "Ready. Run: npm run dev"
Write-Host "API docs: http://localhost:3001/docs"
