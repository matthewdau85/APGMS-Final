[CmdletBinding()]
param(
    [string]$Python = "python"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
$dataRoot = Join-Path $repoRoot "data"
$candidateRoot = Join-Path (Join-Path $repoRoot "model") "candidates"

if (-not (Test-Path $dataRoot)) {
    throw "Data directory '$dataRoot' was not found."
}

if (-not (Test-Path $candidateRoot)) {
    New-Item -ItemType Directory -Path $candidateRoot | Out-Null
}

$trainDefinitions = @(
    @{ Surface = "gstfree"; TrainerModule = "apgms_ml.trainers.gstfree.train"; EvaluatorModule = "apgms_ml.trainers.gstfree.evaluate" },
    @{ Surface = "bas_conf"; TrainerModule = "apgms_ml.trainers.bas_conf.train"; EvaluatorModule = "apgms_ml.trainers.bas_conf.evaluate" },
    @{ Surface = "paygw_var"; TrainerModule = "apgms_ml.trainers.paygw_var.train"; EvaluatorModule = "apgms_ml.trainers.paygw_var.evaluate" },
    @{ Surface = "dups"; TrainerModule = "apgms_ml.trainers.dups.train"; EvaluatorModule = "apgms_ml.trainers.dups.evaluate" },
    @{ Surface = "apportion"; TrainerModule = "apgms_ml.trainers.apportion.train"; EvaluatorModule = "apgms_ml.trainers.apportion.evaluate" }
)

$results = @()

foreach ($definition in $trainDefinitions) {
    $surface = $definition.Surface
    $dataDir = Join-Path $dataRoot $surface
    if (-not (Test-Path $dataDir)) {
        throw "Expected data directory '$dataDir' for surface '$surface'."
    }

    $modelOutput = Join-Path $candidateRoot ("$surface.joblib")

    $trainArgs = @($Python, "-m", $definition.TrainerModule, "--data-dir", $dataDir, "--output-model", $modelOutput)
    Write-Host "[Train] $surface -> $modelOutput" -ForegroundColor Cyan
    $trainOutput = & $trainArgs[0] @($trainArgs[1..($trainArgs.Length - 1)])
    if ($LASTEXITCODE -ne 0) {
        throw "Training for '$surface' failed with exit code $LASTEXITCODE."
    }
    if ($trainOutput) {
        $trainOutput | ForEach-Object { Write-Host "  $_" }
    }

    $evalArgs = @($Python, "-m", $definition.EvaluatorModule, "--data-dir", $dataDir, "--model", $modelOutput, "--format", "json")
    Write-Host "[Eval] $surface" -ForegroundColor Yellow
    $evalOutput = & $evalArgs[0] @($evalArgs[1..($evalArgs.Length - 1)])
    if ($LASTEXITCODE -ne 0) {
        throw "Evaluation for '$surface' failed with exit code $LASTEXITCODE."
    }

    $metrics = $null
    try {
        $metrics = $evalOutput | ConvertFrom-Json
    }
    catch {
        throw "Failed to parse evaluation output for '$surface' as JSON. Output:`n$evalOutput"
    }

    if (-not $metrics) {
        throw "Evaluation for '$surface' returned no metrics."
    }

    $auc = if ($null -ne $metrics.auc) { [double]$metrics.auc } elseif ($metrics.metrics -and $null -ne $metrics.metrics.auc) { [double]$metrics.metrics.auc } else { $null }
    $f1 = if ($null -ne $metrics.f1) { [double]$metrics.f1 } elseif ($metrics.metrics -and $null -ne $metrics.metrics.f1) { [double]$metrics.metrics.f1 } else { $null }
    $threshold = if ($null -ne $metrics.threshold) { $metrics.threshold } elseif ($metrics.metrics -and $null -ne $metrics.metrics.threshold) { $metrics.metrics.threshold } else { $null }
    $bands = if ($null -ne $metrics.bands) { $metrics.bands } elseif ($metrics.metrics -and $null -ne $metrics.metrics.bands) { $metrics.metrics.bands } else { $null }
    $passed = if ($null -ne $metrics.passed) { [bool]$metrics.passed } elseif ($metrics.status -eq "pass") { $true } elseif ($metrics.status -eq "fail") { $false } else { $null }

    $metricText = if ($null -ne $auc) { "AUC={0:N3}" -f $auc } elseif ($null -ne $f1) { "F1={0:N3}" -f $f1 } else { "-" }
    $thresholdText = if ($null -ne $threshold) {
        if ($threshold -is [double]) { "{0:N3}" -f [double]$threshold } else { "$threshold" }
    } elseif ($bands) {
        if ($bands -is [System.Collections.IEnumerable] -and -not ($bands -is [string])) {
            ($bands | ForEach-Object { "$_" }) -join "/"
        } else {
            "$bands"
        }
    } else {
        "-"
    }
    $statusText = if ($passed -eq $false) { "FAIL" } else { "PASS" }

    $results += [pscustomobject]@{
        Model = $surface
        Metric = $metricText
        Threshold = $thresholdText
        Status = $statusText
    }
}

if ($results.Count -gt 0) {
    Write-Host ""
    ($results | Format-Table -AutoSize | Out-String).TrimEnd() | Write-Host
}
