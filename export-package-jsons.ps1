# Paths to the package.json files we care about
$paths = @(
  "C:\src\APGMS\package.json",
  "C:\src\APGMS\apps\phase1-demo\package.json",
  "C:\src\APGMS\packages\domain-policy\package.json",
  "C:\src\APGMS\packages\ledger\package.json",
  "C:\src\APGMS\services\api-gateway\package.json",
  "C:\src\APGMS\services\connectors\package.json",
  "C:\src\APGMS\shared\package.json"
)

# Output file
$outputFile = "C:\src\APGMS\all-package-jsons.txt"

# Delete existing output file if it exists
if (Test-Path $outputFile) {
    Remove-Item $outputFile -Force
}

foreach ($path in $paths) {
    if (Test-Path $path) {
        Add-Content -Path $outputFile -Value ("===== " + $path + " =====")
        Get-Content -Path $path | Add-Content -Path $outputFile
        Add-Content -Path $outputFile -Value ""  # blank line between files
    }
    else {
        Add-Content -Path $outputFile -Value ("===== " + $path + " (NOT FOUND) =====")
        Add-Content -Path $outputFile -Value ""
    }
}

Write-Host "Combined file written to $outputFile"
