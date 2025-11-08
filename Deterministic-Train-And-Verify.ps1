param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$PythonPath,
    [Parameter(Mandatory = $true)]
    [double]$Threshold,
    [int]$Runs = 3
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ProjectRoot)) {
    throw "ProjectRoot '$ProjectRoot' does not exist."
}

Set-Location $ProjectRoot

$trainScript = Join-Path $ProjectRoot "src\train.py"
if (-not (Test-Path $trainScript)) {
    throw "train.py not found at $trainScript"
}

$outDir = Join-Path $ProjectRoot "artifacts\deterministic"
if (Test-Path $outDir) {
    Remove-Item $outDir -Recurse -Force
}
New-Item -ItemType Directory -Path $outDir | Out-Null

$hashes = @()
for ($run = 1; $run -le $Runs; $run++) {
    $modelPath = Join-Path $outDir ("model_run_{0}.joblib" -f $run)
    Write-Host "Run $run: training model to $modelPath"
    & $PythonPath $trainScript --out $modelPath --threshold $Threshold
    if ($LASTEXITCODE -ne 0) {
        throw "Training failed on run $run"
    }
    $hash = (Get-FileHash -Algorithm SHA256 -Path $modelPath).Hash
    Write-Host "Run $run hash: $hash"
    $hashes += $hash
}

$unique = $hashes | Sort-Object -Unique
if ($unique.Count -ne 1) {
    throw "Determinism check failed. Hashes differ: $($hashes -join ', ')"
}

Write-Host "PASS: Identical SHA-256 across $Runs runs." -ForegroundColor Green
