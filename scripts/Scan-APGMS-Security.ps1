Param(
    [string]$RootPath = "C:\src\APGMS",
    [string]$OutputPath = ""
)

if (-not (Test-Path $RootPath)) {
    Write-Error "RootPath '$RootPath' does not exist."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $RootPath "apgms-security-audit.txt"
}

# Ensure we start with a fresh file
"APGMS Security & Privacy Scan Report" | Out-File -FilePath $OutputPath -Encoding utf8
"Root: $RootPath" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
"Generated: $(Get-Date -Format s)" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
"" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

function Write-Section {
    param(
        [string]$Title
    )
    "" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
    "============================================================" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
    $Title | Out-File -FilePath $OutputPath -Encoding utf8 -Append
    "============================================================" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
}

function Search-And-Write {
    param(
        [string]$Label,
        [string]$BasePath,
        [string[]]$IncludePatterns,
        [string[]]$SearchPatterns
    )

    if (-not (Test-Path $BasePath)) {
        "[$Label] BasePath not found: $BasePath" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        return
    }

    "[$Label] BasePath: $BasePath" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

    $files = Get-ChildItem -Path $BasePath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            foreach ($inc in $IncludePatterns) {
                if ($_.FullName -like $inc) { return $true }
            }
            return $false
        }

    if (-not $files) {
        "No files matched include patterns." | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        return
    }

    foreach ($pattern in $SearchPatterns) {
        "" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        "---- Pattern: $pattern ----" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

        $matches = $files | Select-String -Pattern $pattern -SimpleMatch -ErrorAction SilentlyContinue

        if (-not $matches) {
            "No matches." | Out-File -FilePath $OutputPath -Encoding utf8 -Append
            continue
        }

        foreach ($m in $matches) {
            # Format: relative path:lineNumber: line text
            $relPath = $m.Path.Replace($RootPath, "").TrimStart("\")
            "$relPath`:$($m.LineNumber): $($m.Line.Trim())" |
                Out-File -FilePath $OutputPath -Encoding utf8 -Append
        }
    }
}

# 1.1 Sensitive routes and AuthN/Z / validation coverage
Write-Section "1.1 Sensitive routes & AuthN/Z/Validation"

$routesPath = Join-Path $RootPath "services\api-gateway\src\routes"

# Sensitive route patterns
$routeIncludePatterns = @(
    "*bank*",
    "*connect*",
    "*tfn*",
    "*pii*",
    "*regulat*",
    "*admin*",
    "*dashboard*"
)

# What to search for inside these files
$routeSearchPatterns = @(
    "bank-lines",
    "connectors",
    "regulator",
    "admin",
    "dashboard",
    "requireAuth",
    "requireAdmin",
    "requireRegulator",
    "authGuard",
    "authorize",
    "orgId",
    "organisationId",
    "tenantId",
    "zod",
    "schema",
    "parseWithSchema",
    "validate"
)

Search-And-Write -Label "Sensitive Routes and Guards" -BasePath $routesPath -IncludePatterns $routeIncludePatterns -SearchPatterns $routeSearchPatterns

# 1.1 Tests for sensitive routes
Write-Section "1.1 Tests covering AuthN/Z and validation (api-gateway tests)"

$testsPath = Join-Path $RootPath "services\api-gateway\test"

$testIncludePatterns = @(
    "*.ts",
    "*.tsx",
    "*.js"
)

$testSearchPatterns = @(
    "bank-lines",
    "connectors",
    "regulator",
    "admin",
    "dashboard",
    "401",
    "403",
    "Idempotency-Key",
    "Idempotent-Replay",
    "orgId",
    "organisationId"
)

Search-And-Write -Label "AuthN/Z and Status Code Tests" -BasePath $testsPath -IncludePatterns $testIncludePatterns -SearchPatterns $testSearchPatterns

# 1.2 PII/TFN handling and logSafe
Write-Section "1.2 PII/TFN handling and PII-safe logging"

$piiBasePath = $RootPath

$piiIncludePatterns = @(
    "*services\api-gateway\src*",
    "*shared*",
    "*packages*"
)

$piiSearchPatterns = @(
    "TFN",
    "tfn",
    "ABN",
    "abn",
    "PII",
    "pii",
    "logSafe",
    "logger",
    "log.",
    "HMAC",
    "aes-256-gcm",
    "ENCRYPTION_MASTER_KEY",
    "tokenize",
    "redact"
)

Search-And-Write -Label "PII/TFN Code and Logging" -BasePath $piiBasePath -IncludePatterns $piiIncludePatterns -SearchPatterns $piiSearchPatterns

# 1.2 Tests for PII/log redaction and TFN decrypt/export
Write-Section "1.2 Tests for PII redaction and TFN decrypt/export"

$piiTestsBasePath = Join-Path $RootPath "services\api-gateway\test"

$piiTestsIncludePatterns = @(
    "*.ts",
    "*.tsx",
    "*.js"
)

$piiTestsSearchPatterns = @(
    "TFN",
    "tfn",
    "ABN",
    "abn",
    "logSafe",
    "logger",
    "PII_REDACTED",
    "decrypt",
    "export",
    "audit",
    "Prometheus",
    "metric"
)

Search-And-Write -Label "PII/TFN Tests" -BasePath $piiTestsBasePath -IncludePatterns $piiTestsIncludePatterns -SearchPatterns $piiTestsSearchPatterns

# 1.3 Security headers & CORS
Write-Section "1.3 Security headers & CORS"

$secHeadersBasePath = Join-Path $RootPath "services\api-gateway\test"

$secHeadersIncludePatterns = @(
    "*security*",
    "*.ts",
    "*.js"
)

$secHeadersSearchPatterns = @(
    "Content-Security-Policy",
    "default-src",
    "frame-ancestors",
    "object-src",
    "referrer-policy",
    "Referrer-Policy",
    "helmet",
    "CORS",
    "cors",
    "Access-Control-Allow-Origin"
)

Search-And-Write -Label "Security Header and CORS Tests" -BasePath $secHeadersBasePath -IncludePatterns $secHeadersIncludePatterns -SearchPatterns $secHeadersSearchPatterns

# 1.4 Idempotency
Write-Section "1.4 Idempotency"

$idemBasePath = $RootPath

$idemIncludePatterns = @(
    "*services\api-gateway\src*",
    "*services\api-gateway\test*"
)

$idemSearchPatterns = @(
    "Idempotency-Key",
    "Idempotent-Replay",
    "409",
    "Conflict",
    "idempotent"
)

Search-And-Write -Label "Idempotency Code and Tests" -BasePath $idemBasePath -IncludePatterns $idemIncludePatterns -SearchPatterns $idemSearchPatterns

"" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
"Scan complete." | Out-File -FilePath $OutputPath -Encoding utf8 -Append
"Report written to: $OutputPath" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

Write-Host "Scan complete. Report written to: $OutputPath"
