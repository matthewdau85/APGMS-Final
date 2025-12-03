Param(
    [switch]$SkipDockerShutdown
)

$ErrorActionPreference = 'Stop'
$InformationPreference = 'Continue'

$repoRoot = $PSScriptRoot
Set-Location $repoRoot

function Require-Tool {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required tool: $Name"
    }
}

Require-Tool node
Require-Tool corepack
Require-Tool docker
Require-Tool git
Require-Tool curl

Write-Host "Activating pnpm via Corepack" -ForegroundColor Cyan
corepack enable
corepack prepare pnpm@9 --activate

Write-Host "Installing workspace dependencies" -ForegroundColor Cyan
# pnpm install --frozen-lockfile --force --reporter=append-only

Write-Host "Installing Playwright browsers" -ForegroundColor Cyan
pnpm exec playwright install

if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/apgms?schema=public' }
if (-not $env:SHADOW_DATABASE_URL) { $env:SHADOW_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/apgms_shadow?schema=public' }
if (-not $env:CORS_ALLOWED_ORIGINS) { $env:CORS_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173' }
if (-not $env:AUTH_AUDIENCE) { $env:AUTH_AUDIENCE = 'urn:apgms:local' }
if (-not $env:AUTH_ISSUER) { $env:AUTH_ISSUER = 'urn:apgms:issuer' }
if (-not $env:AUTH_DEV_SECRET) { $env:AUTH_DEV_SECRET = 'local-dev-shared-secret-change-me' }
$authJwksDefault = '{"keys":[{"kid":"local","alg":"RS256","kty":"RSA","n":"test-modulus","e":"AQAB"}]}'
if (-not $env:AUTH_JWKS) { $env:AUTH_JWKS = $authJwksDefault }
if (-not $env:ENCRYPTION_MASTER_KEY) { $env:ENCRYPTION_MASTER_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }
if (-not $env:API_RATE_LIMIT_MAX) { $env:API_RATE_LIMIT_MAX = '120' }
if (-not $env:API_RATE_LIMIT_WINDOW) { $env:API_RATE_LIMIT_WINDOW = '1 minute' }
if (-not $env:AUTH_FAILURE_THRESHOLD) { $env:AUTH_FAILURE_THRESHOLD = '5' }
if (-not $env:WEBAUTHN_RP_ID) { $env:WEBAUTHN_RP_ID = 'localhost' }
if (-not $env:WEBAUTHN_RP_NAME) { $env:WEBAUTHN_RP_NAME = 'APGMS Admin' }
if (-not $env:WEBAUTHN_ORIGIN) { $env:WEBAUTHN_ORIGIN = 'http://localhost:5173' }
if (-not $env:REGULATOR_ACCESS_CODE) { $env:REGULATOR_ACCESS_CODE = 'regulator-dev-code' }
if (-not $env:REGULATOR_JWT_AUDIENCE) { $env:REGULATOR_JWT_AUDIENCE = 'urn:apgms:regulator' }
if (-not $env:REGULATOR_SESSION_TTL_MINUTES) { $env:REGULATOR_SESSION_TTL_MINUTES = '60' }
if (-not $env:BANKING_PROVIDER) { $env:BANKING_PROVIDER = 'mock' }
if (-not $env:BANKING_MAX_READ_TRANSACTIONS) { $env:BANKING_MAX_READ_TRANSACTIONS = '1000' }
if (-not $env:BANKING_MAX_WRITE_CENTS) { $env:BANKING_MAX_WRITE_CENTS = '5000000' }
if (-not $env:REDIS_URL) { $env:REDIS_URL = 'redis://localhost:6379' }
if (-not $env:REDIS_HOST) { $env:REDIS_HOST = 'localhost' }
if (-not $env:REDIS_PORT) { $env:REDIS_PORT = '6379' }
if (-not $env:TAX_ENGINE_URL) { $env:TAX_ENGINE_URL = 'http://localhost:8000' }

Write-Host "Starting docker dependencies (db, redis, tax-engine)" -ForegroundColor Cyan
docker compose up -d db redis tax-engine

Write-Host "Waiting for Postgres to accept connections" -ForegroundColor Cyan
$pgReady = $false
for ($i = 0; $i -lt 30; $i++) {
    docker exec apgms-db pg_isready -U postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $pgReady) { throw "Postgres was not ready after 60s" }

Write-Host "Applying Prisma migrations" -ForegroundColor Cyan
pnpm -w exec prisma migrate deploy

Write-Host "Booting API gateway in background" -ForegroundColor Cyan

$apiLog = Join-Path $repoRoot 'artifacts/api-gateway.log'
$apiErr = Join-Path $repoRoot 'artifacts/api-gateway.err.log'
New-Item -ItemType Directory -Force -Path (Split-Path $apiLog) | Out-Null

$apiProcess = Start-Process -FilePath 'pnpm.cmd' `
  -ArgumentList @('--filter','@apgms/api-gateway','dev','--workspace-root') `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $apiLog `
  -RedirectStandardError  $apiErr `
  -PassThru



try {
    Write-Host "Waiting for API readiness endpoint" -ForegroundColor Cyan
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/ready' -TimeoutSec 5 | Out-Null
            $ready = $true
            break
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    if (-not $ready) { throw "API gateway did not report ready" }

    Write-Host "Running workspace build" -ForegroundColor Cyan
    pnpm -r build

    Write-Host "Running lint" -ForegroundColor Cyan
    pnpm -r lint
    if ($LASTEXITCODE -ne 0) { Write-Warning "lint failed; continuing to keep sweep running" }

    Write-Host "Running type checks" -ForegroundColor Cyan
    pnpm -r typecheck

    Write-Host "Running unit tests with coverage" -ForegroundColor Cyan
    pnpm test -- --coverage

    Write-Host "Running Playwright UI tests" -ForegroundColor Cyan
    pnpm exec playwright test

    Write-Host "Running regulator smoke against live API" -ForegroundColor Cyan
    pnpm smoke:regulator

    Write-Host "Running k6 smoke test against API gateway" -ForegroundColor Cyan
    pnpm k6:smoke -- --env BASE_URL=http://localhost:3000

    Write-Host "Running security and compliance checks" -ForegroundColor Cyan
    pnpm audit --audit-level=high
    pnpm exec gitleaks detect --no-color --redact --exit-code 1
    # pnpm sbom
    pnpm -w exec prisma migrate status

    Write-Host "Checking for merge conflicts" -ForegroundColor Cyan
    git grep -n '<<<<<<<\|=======\|>>>>>>>' -- ':!*.lock'
}
finally {
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Write-Host "Stopping API gateway (pid=$($apiProcess.Id))" -ForegroundColor Cyan
        Stop-Process -Id $apiProcess.Id -Force
        $apiProcess.WaitForExit() | Out-Null
    }

    if (-not $SkipDockerShutdown) {
        Write-Host "Shutting down docker compose dependencies" -ForegroundColor Cyan
        docker compose down --remove-orphans
    }
}

Write-Host "Tests complete. API logs captured at $apiLog" -ForegroundColor Green