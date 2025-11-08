param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$PythonPath,
    [Parameter(Mandatory = $true)]
    [string]$ModelPath,
    [Parameter(Mandatory = $true)]
    [string]$EvalTsv
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ProjectRoot)) {
    throw "ProjectRoot '$ProjectRoot' does not exist."
}

Set-Location $ProjectRoot

$scoreScript = Join-Path $ProjectRoot "src\score_tsv.py"
if (-not (Test-Path $scoreScript)) {
    throw "score_tsv.py not found at $scoreScript"
}

$reportDir = Join-Path $ProjectRoot "artifacts\nl"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$predsPath = Join-Path $reportDir "nl_preds.tsv"
$metricsPath = Join-Path $reportDir "nl_metrics.json"
$sweepPath = Join-Path $reportDir "nl_sweep.json"

Write-Host "Scoring NL eval set"
& $PythonPath $scoreScript $ModelPath $EvalTsv --profile nl --out $predsPath --metrics-out $metricsPath --sweep-out $sweepPath
if ($LASTEXITCODE -ne 0) {
    throw "NL evaluation failed"
}

Write-Host "Predictions saved to $predsPath"
Write-Host "Metrics saved to $metricsPath"
Write-Host "Sweep saved to $sweepPath"
