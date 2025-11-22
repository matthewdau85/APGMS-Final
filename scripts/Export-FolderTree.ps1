# Export-FolderTree.ps1
# Generates a tree of the folder this script is in and writes it to folder-structure.txt

# 1. Get the directory where this script lives
$BasePath = Split-Path -Parent $MyInvocation.MyCommand.Path

# 2. Where to write the output
$OutFile = Join-Path $BasePath "folder-structure.txt"

Write-Host "Scanning $BasePath ..."
Write-Host "Writing to $OutFile ..."

# 3. Get all dirs/files under that base path
$items = Get-ChildItem -LiteralPath $BasePath -Recurse |
    Sort-Object FullName

# 4. Build a relative "tree" view
$result = foreach ($item in $items) {
    # turn C:\src\whatever\services\api-gateway\src\app.ts
    # into .\services\api-gateway\src\app.ts
    $rel = $item.FullName.Substring($BasePath.Length).TrimStart('\','/')
    if ($rel -eq "") { continue }

    # indent based on depth
    $parts = $rel -split "[\\/]"
    $indentLevel = $parts.Length - 1
    $indent = ("  " * $indentLevel) + "|- "

    $indent + $parts[-1]
}

# 5. Prepend the root folder name at the top
$header = @(
    "Root: $BasePath"
    "|"
    "|- (root)"
)

# 6. Write everything to file
$allLines = $header + $result
$allLines | Set-Content -Encoding UTF8 $OutFile

Write-Host "Done."
Write-Host "Preview:"
Write-Host "---------------------------------"
$allLines | Select-Object -First 40 | ForEach-Object { Write-Host $_ }
Write-Host "---------------------------------"
Write-Host "(Only first 40 lines shown above)"
