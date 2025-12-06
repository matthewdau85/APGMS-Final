Param(
    [string]$RootPath = "C:\src\APGMS",
    [string]$OutputPath = ""
)

if (-not (Test-Path $RootPath)) {
    Write-Error "RootPath '$RootPath' does not exist."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $RootPath "apgms-security-readiness-report.txt"
}

# Fresh file
"APGMS Security & Privacy Readiness Scan" | Out-File -FilePath $OutputPath -Encoding utf8
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

function Search-Files {
    param(
        [string]$BasePath,
        [string[]]$IncludePatterns,
        [string[]]$SearchPatterns
    )

    if (-not (Test-Path $BasePath)) {
        "Base path not found: $BasePath" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        return @()
    }

    $files = Get-ChildItem -Path $BasePath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            foreach ($inc in $IncludePatterns) {
                if ($_.FullName -like $inc) { return $true }
            }
            return $false
        }

    if (-not $files) {
        "No files matched include patterns under $BasePath." | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        return @()
    }

    $results = @()

    foreach ($pattern in $SearchPatterns) {
        "" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        "---- Pattern: $pattern ----" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

        $matches = $files | Select-String -Pattern $pattern -SimpleMatch -ErrorAction SilentlyContinue

        if (-not $matches) {
            "No matches." | Out-File -FilePath $OutputPath -Encoding utf8 -Append
            continue
        }

        foreach ($m in $matches) {
            $relPath = $m.Path.Replace($RootPath, "").TrimStart("\","/")
            $line = "$relPath`:$($m.LineNumber): $($m.Line.Trim())"
            $line | Out-File -FilePath $OutputPath -Encoding utf8 -Append
            $results += $line
        }
    }

    return $results
}

# Small helper to map routes -> whether tests with 401/403 exist
function Analyze-RouteTestCoverage {
    param(
        [hashtable]$RoutePatterns,
        [string]$TestsBasePath
    )

    Write-Section "SUMMARY: Sensitive route test coverage (401/403/org-scoping heuristic)"

    if (-not (Test-Path $TestsBasePath)) {
        "Tests base path not found: $TestsBasePath" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        return
    }

    $testFiles = Get-ChildItem -Path $TestsBasePath -Recurse -File -Include *.ts,*.tsx,*.js -ErrorAction SilentlyContinue

    foreach ($key in $RoutePatterns.Keys) {
        $routePath = $RoutePatterns[$key]
        "Route: $routePath" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

        $routeMatches = $testFiles | Select-String -Pattern $routePath -SimpleMatch -ErrorAction SilentlyContinue
        if (-not $routeMatches) {
            "  - No tests mentioning this route were found." | Out-File -FilePath $OutputPath -Encoding utf8 -Append
            continue
        }

        $has401 = $false
        $has403 = $false

        foreach ($match in $routeMatches) {
            $line = $match.Line
            if ($line -match "401") { $has401 = $true }
            if ($line -match "403") { $has403 = $true }
        }

        "  - Tests mentioning route: $($routeMatches.Count)" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        "  - Has 401 expectation (unauthenticated)?: $has401" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        "  - Has 403 expectation (wrong org/role)?: $has403" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
        "" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
    }
}

# 0. Pre-flight notes (static, for you to do manually)
Write-Section "0. Pre-flight (manual commands to run outside this script)"

@(
    "From a PowerShell prompt:",
    "  cd C:\src\APGMS",
    "  corepack enable",
    "  pnpm install --frozen-lockfile",
    "  pnpm -C shared prisma:generate",
    "  pnpm --filter @apgms/api-gateway test",
    "",
    "Run these yourself and check they pass before changing security-critical code."
) | Out-File -FilePath $OutputPath -Encoding utf8 -Append

# 1.1 AuthN/Z coverage on sensitive routes
Write-Section "1.1 Sensitive routes: definitions, auth guards, org scoping"

$routesPath = Join-Path $RootPath "services\api-gateway\src\routes"

"Route definitions (looking for key paths: bank-lines, connectors, regulator, admin, users)" |
    Out-File -FilePath $OutputPath -Encoding utf8 -Append

$routesInclude = @(
    "*services\api-gateway\src\routes*"
)

# FIXED: use simple strings, no weird escaping
$routesSearch = @(
    '/bank-lines',
    '/connectors',
    '/regulator',
    '/admin',
    '/users',
    '/admin/export',
    '/admin/delete',
    '/pii'
)

Search-Files -BasePath $routesPath -IncludePatterns $routesInclude -SearchPatterns $routesSearch | Out-Null

"Auth guards and principal helpers (requireAuth, requireAdmin, regulator helpers, authHook)" |
    Out-File -FilePath $OutputPath -Encoding utf8 -Append

$authSearch = @(
    'requireAuth',
    'requireAdmin',
    'requireRegulator',
    'authGuard',
    'authorize',
    'ensurePrincipal',
    'adminDataAuth',
    'addHook("preHandler"'
)

Search-Files -BasePath $routesPath -IncludePatterns $routesInclude -SearchPatterns $authSearch | Out-Null

"Org scoping in Prisma queries (orgId/organisationId/tenantId in where clauses)" |
    Out-File -FilePath $OutputPath -Encoding utf8 -Append

$orgSearch = @(
    'orgId',
    'organisationId',
    'tenantId',
    'where: { orgId',
    'where: { organisationId',
    'where: { tenantId'
)

Search-Files -BasePath $routesPath -IncludePatterns $routesInclude -SearchPatterns $orgSearch | Out-Null

# 1.1 Tests for AuthN/Z coverage
Write-Section "1.1 AuthN/Z tests: 401/403 and org-scoped expectations"

$testsPath = Join-Path $RootPath "services\api-gateway\test"

"Tests mentioning sensitive routes and status codes 401/403" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

$testInclude = @("*.ts","*.tsx","*.js")
$testSearch = @(
    '/bank-lines',
    '/connectors',
    '/regulator',
    '/admin',
    '/users',
    '401',
    '403',
    'unauthorized',
    'forbidden'
)

Search-Files -BasePath $testsPath -IncludePatterns $testInclude -SearchPatterns $testSearch | Out-Null

# Heuristic summary: does each sensitive route have tests with 401/403?
$routePatterns = @{
    "bankLines" = "/bank-lines"
    "connectors" = "/connectors"
    "regulator" = "/regulator"
    "admin" = "/admin"
    "users" = "/users"
}

Analyze-RouteTestCoverage -RoutePatterns $routePatterns -TestsBasePath $testsPath

# 1.2 PII/TFN handling – code and tests
Write-Section "1.2 PII/TFN handling: logging, redaction and tests"

"Code references to TFN/ABN/PII/logging" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

$piiBase = $RootPath
$piiInclude = @(
    "*services\api-gateway\src*",
    "*shared*",
    "*packages*"
)

$piiSearch = @(
    'TFN',
    'tfn',
    'ABN',
    'abn',
    'PII',
    'pii',
    'security-log',
    'logSafe',
    'audit',
    'auditLogger',
    'secLog',
    'logger',
    'HMAC',
    'aes-256-gcm',
    'ENCRYPTION_MASTER_KEY',
    'tokenize',
    'redact'
)

Search-Files -BasePath $piiBase -IncludePatterns $piiInclude -SearchPatterns $piiSearch | Out-Null

"Tests around TFN/PII logging, admin decrypt/export, audit and metrics" |
    Out-File -FilePath $OutputPath -Encoding utf8 -Append

$piiTestsBase = $testsPath
$piiTestsInclude = @("*.ts","*.tsx","*.js")
$piiTestsSearch = @(
    'TFN',
    'tfn',
    'ABN',
    'abn',
    'PII',
    'pii',
    'logSafe',
    'security-log',
    'audit',
    'admin.pii',
    'decrypt',
    'export',
    'Prometheus',
    'metric'
)

Search-Files -BasePath $piiTestsBase -IncludePatterns $piiTestsInclude -SearchPatterns $piiTestsSearch | Out-Null

# 1.3 Security headers & CORS
Write-Section "1.3 Security headers & CORS: CSP, referrer-policy, allowlist tests"

$secTestsBase = $testsPath
$secTestsInclude = @("*.ts","*.tsx","*.js")
$secTestsSearch = @(
    'Content-Security-Policy',
    'default-src',
    'frame-ancestors',
    'object-src',
    'Referrer-Policy',
    'referrer-policy',
    'no-referrer',
    'strict-origin-when-cross-origin',
    'helmet',
    'CORS',
    'cors',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Expose-Headers'
)

Search-Files -BasePath $secTestsBase -IncludePatterns $secTestsInclude -SearchPatterns $secTestsSearch | Out-Null

# 1.4 Idempotency: headers, conflicts, tests
Write-Section "1.4 Idempotency: Idempotency-Key, Idempotent-Replay, 409 conflict"

$idemBase = $RootPath
$idemInclude = @(
    "*services\api-gateway\src*",
    "*services\api-gateway\test*"
)

$idemSearch = @(
    'Idempotency-Key',
    'Idempotent-Replay',
    'idempotent-replay',
    'idempotency',
    '409',
    'Conflict'
)

Search-Files -BasePath $idemBase -IncludePatterns $idemInclude -SearchPatterns $idemSearch | Out-Null

"" | Out-File -FilePath $OutputPath -Encoding utf8 -Append
"Scan complete." | Out-File -FilePath $OutputPath -Encoding utf8 -Append
"Report written to: $OutputPath" | Out-File -FilePath $OutputPath -Encoding utf8 -Append

Write-Host "Scan complete. Report written to: $OutputPath"
