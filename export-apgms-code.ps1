# export-apgms-code.ps1
# Scan the entire repo (all folders) and dump all code files into one text file.
# Exclusions:
# - node_modules
# - .git
# - dist
# - the output file itself (combined-code-export.txt)

# Detect repo root as the folder this script lives in
$root = $PSScriptRoot
if (-not $root) {
    # Fallback for older PowerShell versions
    $root = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$output = Join-Path $root 'combined-code-export.txt'

Write-Host "Repo root detected as: $root"
Write-Host "Output file will be:   $output"
Write-Host ""

# File extensions we consider "code/text"
$codeExtensions = @(
    '.ts', '.tsx',
    '.js', '.jsx',
    '.mjs', '.cjs',
    '.json',
    '.prisma',
    '.sql',
    '.yml', '.yaml',
    '.md',
    '.ps1',
    '.html', '.css'
)

$allFiles = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $full = $_.FullName
        ($full -notmatch '\\node_modules\\') -and
        ($full -notmatch '\\\.git\\') -and
        ($full -notmatch '\\dist\\') -and
        ($full -ne $output) -and
        ($codeExtensions -contains $_.Extension.ToLower())
    } |
    Select-Object -ExpandProperty FullName |
    Sort-Object -Unique

# Start the output file
"Code export generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" |
    Set-Content -Path $output -Encoding UTF8

foreach ($file in $allFiles) {
    Add-Content -Path $output -Value '============================================================'
    Add-Content -Path $output -Value "FILE: $file"
    Add-Content -Path $output -Value '============================================================'
    Get-Content -Path $file -Raw | Add-Content -Path $output
    Add-Content -Path $output -Value ''
    Add-Content -Path $output -Value ''
}

Write-Host ""
Write-Host "Exported $($allFiles.Count) files to:"
Write-Host "  $output"
