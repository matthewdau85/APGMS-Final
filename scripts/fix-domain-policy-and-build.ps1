# fix-domain-policy-and-build.ps1
# -------------------------------------------------------------------
# 1) Add .js to relative imports in packages/domain-policy/src
# 2) Remove duplicate interface/type declarations in AU tax files
# 3) Run pnpm -r build
# -------------------------------------------------------------------

$ErrorActionPreference = "Stop"

$root = "C:\src\APGMS-Final"
$domainSrc = Join-Path $root "packages\domain-policy\src"

Write-Host "Repo root: $root"
Write-Host "Domain-policy src: $domainSrc"
Write-Host ""

# -------------------------------------------------------------------
# Helper: add .js extension to relative imports if missing
# -------------------------------------------------------------------
function Fix-RelativeImports {
    param(
        [string]$filePath
    )

    $text = Get-Content $filePath -Raw
    $pattern = 'from\s+"(\.{1,2}\/[^"]+)"'

    $newText = [System.Text.RegularExpressions.Regex]::Replace(
        $text,
        $pattern,
        {
            param($m)
            $path = $m.Groups[1].Value

            # If it already ends with .js/.mjs/.cjs/.json, leave it alone
            if ($path -match '\.(js|mjs|cjs|json)$') {
                return $m.Value
            }

            # Otherwise, append .js
            return 'from "' + $path + '.js"'
        }
    )

    if ($newText -ne $text) {
        Write-Host "  [imports] Updated: $filePath"
        Set-Content -LiteralPath $filePath -Value $newText -Encoding UTF8
    }
}

# -------------------------------------------------------------------
# Helper: remove a single interface block by name
# -------------------------------------------------------------------
function Remove-InterfaceBlock {
    param(
        [string]$filePath,
        [string]$interfaceName
    )

    if (-not (Test-Path $filePath)) {
        Write-Host "  [warn] Interface target not found: $filePath"
        return
    }

    $text = Get-Content $filePath -Raw

    # Non-greedy match: "interface Name ... }" (first occurrence only)
    $regex = "interface\s+$interfaceName[\s\S]*?\r?\n}\s*"

    if ($text -notmatch $regex) {
        Write-Host "  [info] No local interface '$interfaceName' found in $filePath"
        return
    }

    $newText = [System.Text.RegularExpressions.Regex]::Replace(
        $text,
        $regex,
        "",
        1
    )

    if ($newText -ne $text) {
        Write-Host "  [interfaces] Removed local interface '$interfaceName' from $filePath"
        Set-Content -LiteralPath $filePath -Value $newText -Encoding UTF8
    }
}

# -------------------------------------------------------------------
# Helper: remove a single type alias by name
# -------------------------------------------------------------------
function Remove-TypeAlias {
    param(
        [string]$filePath,
        [string]$typeName
    )

    if (-not (Test-Path $filePath)) {
        Write-Host "  [warn] Type alias target not found: $filePath"
        return
    }

    $text = Get-Content $filePath -Raw

    # Non-greedy match: "type Name = ... ;" (first occurrence only)
    $regex = "type\s+$typeName\s*=\s*[\s\S]*?;\s*"

    if ($text -notmatch $regex) {
        Write-Host "  [info] No local type alias '$typeName' found in $filePath"
        return
    }

    $newText = [System.Text.RegularExpressions.Regex]::Replace(
        $text,
        $regex,
        "",
        1
    )

    if ($newText -ne $text) {
        Write-Host "  [types] Removed local type alias '$typeName' from $filePath"
        Set-Content -LiteralPath $filePath -Value $newText -Encoding UTF8
    }
}

# -------------------------------------------------------------------
# STEP 1: Fix all relative imports under packages/domain-policy/src
# -------------------------------------------------------------------
Write-Host "STEP 1: Fixing relative imports to add .js where needed..."
Get-ChildItem -Path $domainSrc -Recurse -Filter *.ts | ForEach-Object {
    Fix-RelativeImports -filePath $_.FullName
}
Write-Host "STEP 1 complete."
Write-Host ""

# -------------------------------------------------------------------
# STEP 2: Remove duplicate local interfaces/types in AU-tax files
# -------------------------------------------------------------------
Write-Host "STEP 2: Removing duplicate interfaces/types in AU-tax files..."

$gstEngine      = Join-Path $domainSrc "au-tax\gst-engine.ts"
$paygwEngine    = Join-Path $domainSrc "au-tax\paygw-engine.ts"
$prismaRepo     = Join-Path $domainSrc "au-tax\prisma-repository.ts"

# These were previously defined locally; now they come from ./types.js
Remove-InterfaceBlock -filePath $gstEngine   -interfaceName "GstConfig"
Remove-InterfaceBlock -filePath $paygwEngine -interfaceName "PaygwConfig"

# If you ever had a local TaxObligationType alias here, kill it.
Remove-TypeAlias     -filePath $prismaRepo   -typeName "TaxObligationType"

Write-Host "STEP 2 complete."
Write-Host ""

# -------------------------------------------------------------------
# STEP 3: Run pnpm -r build
# -------------------------------------------------------------------
Write-Host "STEP 3: Running pnpm -r build ..."
Set-Location $root

pnpm -r build

Write-Host ""
Write-Host "Script finished."
