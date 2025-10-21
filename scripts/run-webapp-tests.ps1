param(
  [int]$Port = 5173,
  [string]$BaseUrl,
  [switch]$StartApi
)

$ErrorActionPreference = 'Stop'

# --- Paths ---
$repo = (Resolve-Path ".").Path
$web  = Join-Path $repo "webapp"
$api  = Join-Path $repo "services\api-gateway"
$configPath = Join-Path $web "playwright.config.ts"
$pkgPath    = Join-Path $web "package.json"

if (-not (Test-Path $web)) { throw "Can't find webapp folder at $web" }
if (-not (Test-Path $pkgPath)) { throw "Can't find $pkgPath" }

# --- Env for Playwright/Vite ---
if (-not $BaseUrl -or [string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = "http://localhost:$Port"
}
$env:WEBAPP_PORT = "$Port"
$env:WEBAPP_BASE_URL = $BaseUrl

Write-Host ("WEBAPP_PORT=" + $env:WEBAPP_PORT)
Write-Host ("WEBAPP_BASE_URL=" + $env:WEBAPP_BASE_URL)

# --- Helpers ---
function Ensure-Script {
  param([object]$Pkg,[string]$Name,[string]$Value)
  if (-not $Pkg.scripts.PSObject.Properties[$Name]) {
    $Pkg.scripts | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
  } elseif (-not $Pkg.scripts.$Name -or [string]::IsNullOrWhiteSpace([string]$Pkg.scripts.$Name)) {
    $Pkg.scripts.$Name = $Value
  }
}

function Remove-Bom {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
    [System.IO.File]::WriteAllBytes($Path, $bytes[3..($bytes.Length-1)])
    Write-Host ("Stripped BOM from " + $Path)
  }
}

function ShellExe { if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' } }

function Get-HealthOk {
  try {
    $r = Invoke-WebRequest http://localhost:3000/health -TimeoutSec 3
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

# --- 1) Write playwright.config.ts ---
$configLines = @(
"import { defineConfig, devices } from '@playwright/test';",
"" ,
"const PORT = Number(process.env.WEBAPP_PORT || 5173);",
"const BASE_URL = process.env.WEBAPP_BASE_URL || `http://localhost:${PORT}`;",
"" ,
"export default defineConfig({",
"  testDir: './tests',",
"  use: {",
"    baseURL: BASE_URL,",
"    trace: 'on-first-retry',",
"  },",
"  webServer: [",
"    {",
"      command: process.env.CI ? `pnpm preview --port ${PORT}` : `pnpm dev --port ${PORT}`,",
"      url: BASE_URL,",
"      reuseExistingServer: !process.env.CI,",
"      timeout: 120000,",
"      stdout: 'pipe',",
"      stderr: 'pipe',",
"    },",
"  ],",
"  projects: [",
"    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },",
"  ],",
"});"
)
Set-Content -Path $configPath -Value $configLines -Encoding UTF8
Write-Host ("Wrote " + $configPath)

# --- 2) Ensure package.json has scripts ---
$pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
if (-not $pkgJson.PSObject.Properties['scripts']) {
  $scriptsObj = New-Object psobject
  $pkgJson | Add-Member -MemberType NoteProperty -Name scripts -Value $scriptsObj
}
Ensure-Script $pkgJson 'dev'     'vite'
Ensure-Script $pkgJson 'build'   'vite build'
Ensure-Script $pkgJson 'preview' 'vite preview'
($pkgJson | ConvertTo-Json -Depth 100) | Set-Content -Path $pkgPath -Encoding UTF8
Write-Host ("Updated scripts in " + $pkgPath)

# --- 3) Strip BOMs from common config files ---
$maybeBom = @(
  (Join-Path $web 'postcss.config.json'),
  (Join-Path $web 'postcss.config.cjs'),
  (Join-Path $web 'postcss.config.js'),
  (Join-Path $web 'tsconfig.json'),
  (Join-Path $web 'vite.config.ts'),
  (Join-Path $web 'vite.config.js')
) | Where-Object { $_ -ne $null }
foreach ($p in $maybeBom) { Remove-Bom -Path $p }

# --- 4) Install deps + Playwright browsers ---
Push-Location $repo
try {
  Write-Host "Enabling corepack..."
  try { corepack enable | Out-Null } catch { Write-Warning ("corepack enable failed (continuing): " + $_.Exception.Message) }

  Write-Host "Installing workspace deps (pnpm install --frozen-lockfile)..."
  pnpm install --frozen-lockfile

  Write-Host "Approving postinstall builds (prisma engines, esbuild)..."
  pnpm approve-builds prisma @prisma/engines esbuild

  Write-Host "Installing Playwright browsers (and OS deps if supported)..."
  pnpm exec playwright install --with-deps
}
finally { Pop-Location }

# --- 5) Start API (only if not already healthy) ---
$apiProc = $null
if ($StartApi) {
  if (Get-HealthOk) {
    Write-Host "API already responding on :3000 ? not starting another."
  } else {
    Write-Host "Starting API (dev)..."
    Push-Location $api
    try {
      $apiProc = Start-Process -PassThru -NoNewWindow (ShellExe) -ArgumentList '-NoLogo','-NoProfile','-Command','pnpm dev'
      Write-Host "Waiting for http://localhost:3000/health ..."
      $deadline = (Get-Date).AddSeconds(30)
      while ((Get-Date) -lt $deadline) {
        if (Get-HealthOk) { break }
        Start-Sleep -Milliseconds 500
      }
      if (-not (Get-HealthOk)) { Write-Warning "API health did not return 200 within 30s; tests may fail." }
    } finally {
      Pop-Location
    }
  }
}

# --- 6) Build then Test ---
Push-Location $repo
try {
  Write-Host ""
  Write-Host "Building packages (pnpm -r build)..."
  pnpm -r build

  Write-Host ""
  Write-Host "Running tests (pnpm -r test)..."
  pnpm -r test
}
finally {
  Pop-Location
  if ($apiProc) {
    Write-Host "Stopping API..."
    try { Stop-Process -Id $apiProc.Id -Force } catch {}
  }
}

Write-Host ""
Write-Host "Done."
