param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$PythonPath,
    [Parameter(Mandatory = $true)]
    [double]$Threshold,
    [Parameter(Mandatory = $true)]
    [string]$Stamp
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ProjectRoot)) {
    throw "ProjectRoot '$ProjectRoot' does not exist."
}

Set-Location $ProjectRoot

$trainScript = Join-Path $ProjectRoot "src\train.py"
$probeScript = Join-Path $ProjectRoot "src\quick_probe.py"

$modelRoot = Join-Path $ProjectRoot "model"
$releaseRoot = Join-Path $modelRoot "releases"
$releaseDir = Join-Path $releaseRoot $Stamp
$liveLink = Join-Path $modelRoot "live"

New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

$modelPath = Join-Path $releaseDir "model.joblib"
Write-Host "Training release $Stamp -> $modelPath"
& $PythonPath $trainScript --out $modelPath --threshold $Threshold
if ($LASTEXITCODE -ne 0) {
    throw "Training failed for release $Stamp"
}

$hash = (Get-FileHash -Path $modelPath -Algorithm SHA256).Hash
$manifest = [ordered]@{
    stamp      = $Stamp
    model      = "model.joblib"
    threshold  = [double]$Threshold
    sha256     = $hash
}
$manifestPath = Join-Path $releaseDir "manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Out-File -FilePath $manifestPath -Encoding utf8
Write-Host "Manifest written to $manifestPath"

Write-Host "Running smoke probe"
$probeResult = & $PythonPath $probeScript "What is GST?" "Goods and Services Tax" --model $modelPath
Write-Host $probeResult

if (Test-Path $liveLink) {
    Remove-Item $liveLink -Force
}
cmd /c "mklink /J `"$liveLink`" `"$releaseDir`"" | Out-Null
Write-Host "Live pointer updated -> $liveLink" -ForegroundColor Green
