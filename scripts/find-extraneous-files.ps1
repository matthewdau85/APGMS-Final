param(
    [string]$RootPath   = "C:\src\APGMS",
    [string]$OutputPath = ""
)

# Resolve root and output paths
$root = Resolve-Path $RootPath
if (-not $OutputPath) {
    $OutputPath = Join-Path $root.Path "extraneous-files-report.txt"
}

Write-Host "Scanning root: $($root.Path)"
Write-Host "Report will be written to: $OutputPath"
Write-Host ""

# Directories to ignore completely
$excludeDirs = @(
    "\.git\",
    "\node_modules\",
    "\.pnpm-store\",
    "\dist\",
    "\build\",
    "\coverage\",
    "\.turbo\",
    "\.next\",
    "\scan-output\"
)

# File names we always keep (infra / config / entrypoints)
$alwaysKeepNames = @(
    "package.json",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "tsconfig.json",
    "tsconfig.base.json",
    "jsconfig.json",
    "docker-compose.yml",
    "Dockerfile",
    ".gitignore",
    ".gitattributes",
    ".env",
    ".env.example",
    "index.html",
    "vite.config.ts",
    "vite.config.mts",
    "next.config.js",
    "next.config.mjs",
    "README.md",
    "LICENSE",
    "LICENSE.md"
)

# Extensions considered "text/code" for search
$textExtensions = @(
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".yml", ".yaml", ".prisma",
    ".sql", ".ps1", ".psm1", ".sh", ".bat", ".cmd",
    ".html", ".css", ".scss", ".txt"
)

# Get all files under root, excluding unwanted directories
$allFiles = Get-ChildItem -Path $root.Path -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $full = $_.FullName
        foreach ($pat in $excludeDirs) {
            if ($full -like "*$pat*") {
                return $false
            }
        }
        return $true
    }

# Only treat these as "searchable text files"
$codeFiles = $allFiles | Where-Object {
    ($alwaysKeepNames -contains $_.Name) -or
    ($textExtensions -contains $_.Extension.ToLower())
}

Write-Host "Total files (after directory filters): $($allFiles.Count)"
Write-Host "Text/code files considered for analysis: $($codeFiles.Count)"
Write-Host ""

$extraneous = New-Object System.Collections.Generic.List[System.IO.FileInfo]
$total = $codeFiles.Count
$index = 0

foreach ($file in $codeFiles) {
    $index++
    $percent = if ($total -gt 0) { [int](($index / [double]$total) * 100) } else { 0 }

    Write-Progress -Activity "Scanning references" `
                   -Status ("Checking {0} of {1}: {2}" -f $index, $total, $file.Name) `
                   -PercentComplete $percent

    # Never mark "always keep" files as extraneous
    if ($alwaysKeepNames -contains $file.Name) {
        continue
    }

    # Build list of other files to search in
    $searchIn = $codeFiles |
        Where-Object { $_.FullName -ne $file.FullName } |
        Select-Object -ExpandProperty FullName

    if (-not $searchIn -or $searchIn.Count -eq 0) {
        # Degenerate case: only one file in repo
        $extraneous.Add($file) | Out-Null
        continue
    }

    # Simple heuristic: if this file's name appears in any other file, we treat it as "referenced"
    $pattern = $file.Name

    $isReferenced = Select-String -Path $searchIn -Pattern $pattern -SimpleMatch -Quiet -ErrorAction SilentlyContinue

    if (-not $isReferenced) {
        $extraneous.Add($file) | Out-Null
    }
}

Write-Progress -Activity "Scanning references" -Completed

# Build report content
$lines = @()
$lines += "APGMS extraneous file scan"
$lines += "Root: $($root.Path)"
$lines += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lines += ""
$lines += "Heuristic:"
$lines += "  A file is considered 'extraneous' if its file name does not appear in any other"
$lines += "  text/code file under this tree (excluding node_modules, .git, dist, etc.) and is"
$lines += "  not in the always-keep list (e.g., package.json, docker-compose.yml)."
$lines += ""
$lines += "Caveats:"
$lines += "  - Some files may be used implicitly by tools (e.g. entrypoints, convention-based"
$lines += "    names) and still show up here. Review manually before deleting."
$lines += "  - Dynamic imports or runtime discovery will not be detected."
$lines += ""
$lines += "Total text/code files scanned: $total"
$lines += "Extraneous candidates: $($extraneous.Count)"
$lines += ""
$lines += "List of candidate extraneous files:"
$lines += "-----------------------------------"

foreach ($file in $extraneous) {
    $rel = $file.FullName.Substring($root.Path.Length).TrimStart('\','/')
    $lines += $rel
}

# Write report
Set-Content -Path $OutputPath -Value $lines -Encoding UTF8

Write-Host ""
Write-Host "Scan complete."
Write-Host "Extraneous candidate files: $($extraneous.Count)"
Write-Host "Report written to: $OutputPath"
