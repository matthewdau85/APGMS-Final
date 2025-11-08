Param(
    [Parameter(Mandatory = $true)][string]$Model,
    [string]$Version = "0.1.0"
)

# Placeholder promotion script. Replace with deployment automation once
# governance steps are finalised.
$packageRoot = Join-Path $PSScriptRoot '..'
$productionRoot = Join-Path (Join-Path $packageRoot 'model') 'production'
$liveRoot = Join-Path (Join-Path $packageRoot 'model') 'live'

$source = Join-Path (Join-Path $productionRoot $Model) $Version
$destination = Join-Path $liveRoot $Model

if (-not (Test-Path $source)) {
    throw "Source artifacts not found for $Model version $Version"
}

if (Test-Path $destination) {
    Remove-Item $destination -Force
}

New-Item -ItemType SymbolicLink -Path $destination -Target $source | Out-Null
Write-Host "Promoted $Model version $Version"
