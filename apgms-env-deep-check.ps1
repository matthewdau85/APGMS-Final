param(
    [string]$RootPath = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

# --- Helpers --------------------------------------------------------------

function New-CheckResult {
    param(
        [string]$Category,
        [string]$Name,
        [string]$Status,
        [string]$Details
    )
    [pscustomobject]@{
        Category = $Category
        Name     = $Name
        Status   = $Status
        Details  = $Details
    }
}

function Load-EnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw ".env file not found at: $Path"
    }

    $map = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line) { return }
        if ($line.StartsWith("#")) { return }
        if ($line -notmatch "=") { return }

        $parts = $line -split "=", 2
        $key = $parts[0].Trim()
        $value = $parts[1]

        if ($key) {
            $map[$key] = $value
        }
    }
    return $map
}

function Check-Base64Key32 {
    param(
        [string]$Category,
        [string]$Name,
        [string]$Value
    )

    try {
        $bytes = [System.Convert]::FromBase64String($Value.Trim())
    }
    catch {
        return New-CheckResult -Category $Category -Name $Name -Status "ERROR" -Details "Not valid base64."
    }

    if ($bytes.Length -ne 32) {
        return New-CheckResult -Category $Category -Name $Name -Status "ERROR" -Details "Base64 decodes to $($bytes.Length) bytes (expected 32)."
    }

    return New-CheckResult -Category $Category -Name $Name -Status "OK" -Details "Valid base64, 32 bytes."
}

function Check-Json {
    param(
        [string]$Category,
        [string]$Name,
        [string]$Value
    )

    try {
        $parsed = $Value | ConvertFrom-Json
        return ,(New-CheckResult -Category $Category -Name $Name -Status "OK" -Details "Valid JSON.", $parsed)
    }
    catch {
        return ,(New-CheckResult -Category $Category -Name $Name -Status "ERROR" -Details "Invalid JSON: $($_.Exception.Message)", $null)
    }
}

function Write-CategoryTable {
    param(
        [string]$Title,
        [object[]]$Checks
    )

    Write-Host ""
    Write-Host "=== $Title ==="
    if ($Checks -and $Checks.Count -gt 0) {
        $Checks | Select-Object Name, Status, Details | Format-Table -AutoSize
    } else {
        Write-Host "(no checks)"
    }
}

# --- Main -----------------------------------------------------------------

$envPath = Join-Path $RootPath ".env"

Write-Host "=== Environment file ==="
Write-Host "Root: $RootPath"
Write-Host "Env:  $envPath"

$allChecks = @()

try {
    $envMap = Load-EnvFile -Path $envPath
    $allChecks += New-CheckResult -Category "Env" -Name "Env file" -Status "OK" -Details ".env loaded with $($envMap.Keys.Count) keys."
}
catch {
    $allChecks += New-CheckResult -Category "Env" -Name "Env file" -Status "ERROR" -Details $_.Exception.Message
    Write-CategoryTable -Title "Summary" -Checks $allChecks
    exit 1
}

# --- Database URLs --------------------------------------------------------

$dbChecks = @()

foreach ($name in @("DATABASE_URL", "SHADOW_DATABASE_URL")) {
    if ($envMap.ContainsKey($name) -and $envMap[$name]) {
        $val = $envMap[$name].Trim()
        if ($val -match '^postgresql://[^:@]+:[^@]+@[^/]+/\S+\?schema=\S+$') {
            $dbChecks += New-CheckResult -Category "Database" -Name $name -Status "OK" -Details "Looks like a PostgreSQL URL."
        } else {
            $dbChecks += New-CheckResult -Category "Database" -Name $name -Status "WARN" -Details "Set, but does not look like 'postgresql://user:pass@host/db?schema=public'. Value: $val"
        }
    } else {
        $dbChecks += New-CheckResult -Category "Database" -Name $name -Status "ERROR" -Details "$name is missing or empty."
    }
}
$allChecks += $dbChecks

# --- CORS -----------------------------------------------------------------

$corsChecks = @()

if ($envMap.ContainsKey("CORS_ALLOWED_ORIGINS") -and $envMap["CORS_ALLOWED_ORIGINS"]) {
    $corsVal = $envMap["CORS_ALLOWED_ORIGINS"]
    $origins = $corsVal -split ","
    $trimmed = $origins | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if ($trimmed.Count -eq 0) {
        $corsChecks += New-CheckResult -Category "CORS" -Name "CORS_ALLOWED_ORIGINS" -Status "ERROR" -Details "No origins configured."
    } else {
        $details = "Configured origins: " + ($trimmed -join ", ")
        $corsChecks += New-CheckResult -Category "CORS" -Name "CORS_ALLOWED_ORIGINS" -Status "OK" -Details $details
    }
} else {
    $corsChecks += New-CheckResult -Category "CORS" -Name "CORS_ALLOWED_ORIGINS" -Status "ERROR" -Details "CORS_ALLOWED_ORIGINS is missing or empty."
}
$allChecks += $corsChecks

# --- Auth / JWT -----------------------------------------------------------

$authChecks = @()

foreach ($name in @("AUTH_AUDIENCE", "AUTH_ISSUER", "AUTH_DEV_SECRET")) {
    if ($envMap.ContainsKey($name) -and $envMap[$name]) {
        $authChecks += New-CheckResult -Category "Auth" -Name $name -Status "OK" -Details "Set."
    } else {
        $authChecks += New-CheckResult -Category "Auth" -Name $name -Status "ERROR" -Details "$name is missing or empty."
    }
}

if ($envMap.ContainsKey("AUTH_JWKS") -and $envMap["AUTH_JWKS"]) {
    $authJwksRaw = $envMap["AUTH_JWKS"]
    $jwksResult, $jwksParsed = Check-Json -Category "Auth" -Name "AUTH_JWKS" -Value $authJwksRaw
    $authChecks += $jwksResult
    if ($jwksParsed) {
        $keys = @($jwksParsed.keys)
        if (-not $keys -or $keys.Count -eq 0) {
            $authChecks += New-CheckResult -Category "Auth" -Name "AUTH_JWKS.keys" -Status "WARN" -Details "No keys in JWKS."
        } else {
            $kidList = ($keys | ForEach-Object { $_.kid }) -join ", "
            $authChecks += New-CheckResult -Category "Auth" -Name "AUTH_JWKS.keys" -Status "OK" -Details "Found $($keys.Count) key(s): $kidList"
        }
    }
} else {
    $authChecks += New-CheckResult -Category "Auth" -Name "AUTH_JWKS" -Status "ERROR" -Details "AUTH_JWKS is missing or empty."
}
$allChecks += $authChecks

# --- PII keys and salts ---------------------------------------------------

$piiChecks = @()

$piiKeysParsed = $null
if ($envMap.ContainsKey("PII_KEYS") -and $envMap["PII_KEYS"]) {
    $r, $piiKeysParsed = Check-Json -Category "PII" -Name "PII_KEYS" -Value $envMap["PII_KEYS"]
    $piiChecks += $r
} else {
    $piiChecks += New-CheckResult -Category "PII" -Name "PII_KEYS" -Status "ERROR" -Details "PII_KEYS is missing or empty."
}

$piiSaltsParsed = $null
if ($envMap.ContainsKey("PII_SALTS") -and $envMap["PII_SALTS"]) {
    $r, $piiSaltsParsed = Check-Json -Category "PII" -Name "PII_SALTS" -Value $envMap["PII_SALTS"]
    $piiChecks += $r
} else {
    $piiChecks += New-CheckResult -Category "PII" -Name "PII_SALTS" -Status "ERROR" -Details "PII_SALTS is missing or empty."
}

if ($envMap.ContainsKey("PII_ACTIVE_KEY") -and $envMap["PII_ACTIVE_KEY"]) {
    $activeKid = $envMap["PII_ACTIVE_KEY"].Trim()
    if ($piiKeysParsed) {
        $keysArr = @($piiKeysParsed)
        $match = $keysArr | Where-Object { $_.kid -eq $activeKid }
        if ($null -eq $match) {
            $piiChecks += New-CheckResult -Category "PII" -Name "PII_ACTIVE_KEY" -Status "ERROR" -Details "No entry in PII_KEYS with kid='$activeKid'."
        } else {
            $piiChecks += New-CheckResult -Category "PII" -Name "PII_ACTIVE_KEY" -Status "OK" -Details "Matches an entry in PII_KEYS."
            if ($match.material) {
                $piiChecks += Check-Base64Key32 -Category "PII" -Name "PII_KEYS.material (kid=$activeKid)" -Value $match.material
            } else {
                $piiChecks += New-CheckResult -Category "PII" -Name "PII_KEYS.material" -Status "ERROR" -Details "Active key entry has no 'material'."
            }
        }
    }
} else {
    $piiChecks += New-CheckResult -Category "PII" -Name "PII_ACTIVE_KEY" -Status "ERROR" -Details "PII_ACTIVE_KEY is missing or empty."
}

if ($envMap.ContainsKey("PII_ACTIVE_SALT") -and $envMap["PII_ACTIVE_SALT"]) {
    $activeSid = $envMap["PII_ACTIVE_SALT"].Trim()
    if ($piiSaltsParsed) {
        $saltsArr = @($piiSaltsParsed)
        $match = $saltsArr | Where-Object { $_.sid -eq $activeSid }
        if ($null -eq $match) {
            $piiChecks += New-CheckResult -Category "PII" -Name "PII_ACTIVE_SALT" -Status "ERROR" -Details "No entry in PII_SALTS with sid='$activeSid'."
        } else {
            $piiChecks += New-CheckResult -Category "PII" -Name "PII_ACTIVE_SALT" -Status "OK" -Details "Matches an entry in PII_SALTS."
            if ($match.secret) {
                $piiChecks += Check-Base64Key32 -Category "PII" -Name "PII_SALTS.secret (sid=$activeSid)" -Value $match.secret
            } else {
                $piiChecks += New-CheckResult -Category "PII" -Name "PII_SALTS.secret" -Status "ERROR" -Details "Active salt entry has no 'secret'."
            }
        }
    }
} else {
    $piiChecks += New-CheckResult -Category "PII" -Name "PII_ACTIVE_SALT" -Status "ERROR" -Details "PII_ACTIVE_SALT is missing or empty."
}

$allChecks += $piiChecks

# --- Master encryption key ------------------------------------------------

$masterChecks = @()

if ($envMap.ContainsKey("ENCRYPTION_MASTER_KEY") -and $envMap["ENCRYPTION_MASTER_KEY"]) {
    $masterChecks += Check-Base64Key32 -Category "Encryption" -Name "ENCRYPTION_MASTER_KEY" -Value $envMap["ENCRYPTION_MASTER_KEY"]
} else {
    $masterChecks += New-CheckResult -Category "Encryption" -Name "ENCRYPTION_MASTER_KEY" -Status "ERROR" -Details "ENCRYPTION_MASTER_KEY is missing or empty."
}

$allChecks += $masterChecks

# --- Regulator settings ---------------------------------------------------

$regChecks = @()

foreach ($name in @("REGULATOR_ACCESS_CODE", "REGULATOR_JWT_AUDIENCE")) {
    if ($envMap.ContainsKey($name) -and $envMap[$name]) {
        $regChecks += New-CheckResult -Category "Regulator" -Name $name -Status "OK" -Details "Set."
    } else {
        $regChecks += New-CheckResult -Category "Regulator" -Name $name -Status "ERROR" -Details "$name is missing or empty."
    }
}

if ($envMap.ContainsKey("REGULATOR_SESSION_TTL_MINUTES") -and $envMap["REGULATOR_SESSION_TTL_MINUTES"]) {
    $ttlRaw = $envMap["REGULATOR_SESSION_TTL_MINUTES"].Trim()
    $outInt = 0
    if ([int]::TryParse($ttlRaw, [ref]$outInt)) {
        $regChecks += New-CheckResult -Category "Regulator" -Name "REGULATOR_SESSION_TTL_MINUTES" -Status "OK" -Details "Parses as integer: $ttlRaw"
    } else {
        $regChecks += New-CheckResult -Category "Regulator" -Name "REGULATOR_SESSION_TTL_MINUTES" -Status "ERROR" -Details "Not a valid integer: $ttlRaw"
    }
} else {
    $regChecks += New-CheckResult -Category "Regulator" -Name "REGULATOR_SESSION_TTL_MINUTES" -Status "ERROR" -Details "REGULATOR_SESSION_TTL_MINUTES is missing or empty."
}

$allChecks += $regChecks

# --- TAX_ENGINE_URL -------------------------------------------------------

$taxChecks = @()

if ($envMap.ContainsKey("TAX_ENGINE_URL") -and $envMap["TAX_ENGINE_URL"]) {
    $raw = $envMap["TAX_ENGINE_URL"]
    $val = $raw.Trim()

    if ($val -match '^https?://') {
        $afterScheme = ($val -split '://', 2)[1]
        $hostName = ($afterScheme -split '/', 2)[0]
        $details = "Looks like a URL. Host: $hostName. Use 'tax-engine' when gateway runs in Docker; 'localhost' when running via pnpm dev in WSL."
        $taxChecks += New-CheckResult -Category "TaxEngine" -Name "TAX_ENGINE_URL" -Status "OK" -Details $details
    } else {
        $taxChecks += New-CheckResult -Category "TaxEngine" -Name "TAX_ENGINE_URL" -Status "WARN" -Details "Set, but does not start with 'http://' or 'https://': $val"
    }
} else {
    $taxChecks += New-CheckResult -Category "TaxEngine" -Name "TAX_ENGINE_URL" -Status "ERROR" -Details "TAX_ENGINE_URL is missing or empty."
}

$allChecks += $taxChecks

# --- Print by section -----------------------------------------------------

Write-CategoryTable -Title "Environment file" -Checks ($allChecks | Where-Object { $_.Category -eq "Env" })
Write-CategoryTable -Title "Database URLs"   -Checks ($allChecks | Where-Object { $_.Category -eq "Database" })
Write-CategoryTable -Title "CORS"            -Checks ($allChecks | Where-Object { $_.Category -eq "CORS" })
Write-CategoryTable -Title "Auth / JWT"      -Checks ($allChecks | Where-Object { $_.Category -eq "Auth" })
Write-CategoryTable -Title "PII keys/salts"  -Checks ($allChecks | Where-Object { $_.Category -eq "PII" })
Write-CategoryTable -Title "Master key"      -Checks ($allChecks | Where-Object { $_.Category -eq "Encryption" })
Write-CategoryTable -Title "Regulator"       -Checks ($allChecks | Where-Object { $_.Category -eq "Regulator" })
Write-CategoryTable -Title "Tax engine URL"  -Checks ($allChecks | Where-Object { $_.Category -eq "TaxEngine" })

# --- Summary --------------------------------------------------------------

Write-Host ""
Write-Host "=== Summary ==="
$allChecks | Select-Object Category, Name, Status, Details | Format-Table -AutoSize

$errors = $allChecks | Where-Object { $_.Status -eq "ERROR" }
$warnings = $allChecks | Where-Object { $_.Status -eq "WARN" }

Write-Host ""
if ($errors.Count -eq 0) {
    Write-Host "Env validation: OK (no errors). Warnings: $($warnings.Count)."
    exit 0
} else {
    Write-Host "Env validation: $($errors.Count) error(s), $($warnings.Count) warning(s)."
    exit 1
}
