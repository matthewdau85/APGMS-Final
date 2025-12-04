Param(
    [string]$OutputFile = "apgms-review-pack.txt",
    [string]$MissingFileReport = "apgms-review-missing.txt"
)

# Resolve repo root to the folder where the script lives
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Repo root: $repoRoot"

# List of *paths relative to repo root* that we want to collect
# Files OR directories. Directories will be walked recursively.
$targets = @(
    # --- API gateway core ---
    "services/api-gateway/package.json",
    "services/api-gateway/src/app.ts",
    "services/api-gateway/src/config.ts",

    # --- API routes ---
    "services/api-gateway/src/routes/onboarding.ts",
    "services/api-gateway/src/routes/forecast.ts",
    "services/api-gateway/src/routes/compliance-monitor.ts",

    # --- API helpers & services ---
    "services/api-gateway/src/lib/errors.ts",
    "services/api-gateway/src/lib/retry.ts",
    "services/api-gateway/src/lib/secrets.ts",
    "services/api-gateway/src/services",

    # --- DB / Prisma ---
    "services/api-gateway/db/schema.prisma",
    "services/api-gateway/db/migrations",

    # --- Webapp / GUI ---
    "webapp/package.json",
    "webapp/src/App.tsx",
    "webapp/src/router.tsx",
    "webapp/src/pages/OnboardingWizard.tsx",
    "webapp/src/routes"
)

# Resolve full paths
$targets = $targets | ForEach-Object { Join-Path $repoRoot $_ }

# Clear old outputs if they exist
$fullOutputPath = Join-Path $repoRoot $OutputFile
$missingReportPath = Join-Path $repoRoot $MissingFileReport

if (Test-Path $fullOutputPath) {
    Remove-Item $fullOutputPath -Force
}
if (Test-Path $missingReportPath) {
    Remove-Item $missingReportPath -Force
}

$missing = @()

function Add-FileToOutput {
    param(
        [string]$FilePath
    )

    $relativePath = Resolve-Path $FilePath -Relative

    # Header
    "===== FILE: $relativePath =====" | Out-File -FilePath $fullOutputPath -Encoding utf8 -Append
    "" | Out-File -FilePath $fullOutputPath -Encoding utf8 -Append

    # Content
    try {
        Get-Content $FilePath -Raw | Out-File -FilePath $fullOutputPath -Encoding utf8 -Append
    } catch {
        "# ERROR: Failed to read file $relativePath : $($_.Exception.Message)" |
            Out-File -FilePath $fullOutputPath -Encoding utf8 -Append
    }

    "" | Out-File -FilePath $fullOutputPath -Encoding utf8 -Append
}

foreach ($target in $targets) {
    if (-not (Test-Path $target)) {
        $rel = $target.Replace($repoRoot + [System.IO.Path]::DirectorySeparatorChar, "")
        Write-Warning "Missing: $rel"
        $missing += $rel
        continue
    }

    $item = Get-Item $target

    if ($item.PSIsContainer) {
        # Directory – walk all files recursively
        Write-Host "Collecting from directory: $($item.FullName)"
        Get-ChildItem $item.FullName -Recurse -File | ForEach-Object {
            Add-FileToOutput -FilePath $_.FullName
        }
    } else {
        # Single file
        Write-Host "Collecting file: $($item.FullName)"
        Add-FileToOutput -FilePath $item.FullName
    }
}

# Write missing report if any
if ($missing.Count -gt 0) {
    "The following expected files/directories were NOT found:" | Out-File -FilePath $missingReportPath -Encoding utf8
    "" | Out-File -FilePath $missingReportPath -Encoding utf8 -Append
    $missing | Out-File -FilePath $missingReportPath -Encoding utf8 -Append

    Write-Host ""
    Write-Host "Some items were missing. See: $missingReportPath" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "All target files/directories were found." -ForegroundColor Green
}

Write-Host ""
Write-Host "Review pack written to: $fullOutputPath" -ForegroundColor Cyan
