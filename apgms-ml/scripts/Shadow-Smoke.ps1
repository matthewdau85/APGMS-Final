[CmdletBinding(DefaultParameterSetName = "ByPeriod")]
param(
    [Parameter(ParameterSetName = "ByPeriod", Mandatory = $true)]
    [string[]]$Period,

    [Parameter(ParameterSetName = "ByFiles", Mandatory = $true)]
    [hashtable]$Paths,

    [string]$Python = "python"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$surfaces = @("gstfree", "bas_conf", "paygw_var", "dups", "apportion")
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
$dataRoot = Join-Path $repoRoot "data"
$shadowRoot = Join-Path $dataRoot "shadow"
$modelRoot = Join-Path (Join-Path $repoRoot "model") "live"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

if (-not (Test-Path $modelRoot)) {
    throw "Live model directory '$modelRoot' was not found."
}

function Get-InputFile {
    param(
        [string]$Surface
    )

    if ($PSCmdlet.ParameterSetName -eq "ByFiles") {
        if (-not $Paths.ContainsKey($Surface)) {
            throw "Input paths missing entry for surface '$Surface'."
        }
        $resolved = Resolve-Path -Path $Paths[$Surface]
        return $resolved.Path
    }

    $surfaceDir = Join-Path $shadowRoot $Surface
    if (-not (Test-Path $surfaceDir)) {
        throw "Shadow data directory '$surfaceDir' was not found."
    }

    $candidates = @()
    foreach ($token in $Period) {
        $pattern = "*$token*.csv"
        $candidates += Get-ChildItem -Path $surfaceDir -Filter $pattern -File -ErrorAction SilentlyContinue
    }

    if (-not $candidates) {
        throw "No CSV input found for surface '$Surface' using period filter '$($Period -join ",")'."
    }

    $selected = $candidates | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    return $selected.FullName
}

$summaryRows = @()

foreach ($surface in $surfaces) {
    $inputPath = Get-InputFile -Surface $surface
    $modelPath = Join-Path $modelRoot ("$surface.joblib")
    if (-not (Test-Path $modelPath)) {
        throw "Live model for surface '$surface' was not found at '$modelPath'."
    }

    $scoreArgs = @($Python, "-m", "apgms_ml.shadow.score", "--surface", $surface, "--model", $modelPath, "--input", $inputPath, "--format", "json")
    Write-Host "[Shadow] $surface" -ForegroundColor Cyan
    Write-Host "  model: $modelPath" -ForegroundColor DarkGray
    Write-Host "  input: $inputPath" -ForegroundColor DarkGray

    $scoreOutput = & $scoreArgs[0] @($scoreArgs[1..($scoreArgs.Length - 1)])
    if ($LASTEXITCODE -ne 0) {
        throw "Shadow scoring for '$surface' failed with exit code $LASTEXITCODE."
    }

    $score = $null
    try {
        $score = $scoreOutput | ConvertFrom-Json
    }
    catch {
        throw "Failed to parse scoring output for '$surface' as JSON. Output:`n$scoreOutput"
    }

    if (-not $score) {
        throw "Scoring for '$surface' produced no data."
    }

    $records = @()
    if ($score.records) {
        $records = @($score.records)
    } elseif ($score.results) {
        $records = @($score.results)
    }

    if (-not $records) {
        throw "Scoring for '$surface' did not include any records."
    }

    $thresholdOrBands = if ($null -ne $score.threshold) {
        if ($score.threshold -is [double]) { "{0:N3}" -f [double]$score.threshold } else { "$($score.threshold)" }
    } elseif ($score.bands) {
        if ($score.bands -is [System.Collections.IEnumerable] -and -not ($score.bands -is [string])) {
            ($score.bands | ForEach-Object { "$_" }) -join "/"
        } else {
            "$($score.bands)"
        }
    } else {
        ""
    }

    $outputFile = Join-Path $repoRoot ("shadow_{0}_{1}.csv" -f $surface, $timestamp)
    $csvRows = foreach ($entry in $records) {
        $inputData = if ($entry.input) { $entry.input } elseif ($entry.inputs) { $entry.inputs } else { $null }
        $inputText = if ($null -ne $inputData) { ($inputData | ConvertTo-Json -Compress) } else { "" }
        $probability = if ($null -ne $entry.probability) { [double]$entry.probability } elseif ($null -ne $entry.score) { [double]$entry.score } else { $null }
        $bandValue = if ($entry.band) { "$($entry.band)" } elseif ($entry.segment) { "$($entry.segment)" } else { $null }
        $decisionValue = if ($entry.decision) { "$($entry.decision)" } elseif ($entry.action) { "$($entry.action)" } else { "" }
        $probOrBand = if ($null -ne $probability) { "{0:N4}" -f $probability } elseif ($bandValue) { $bandValue } else { "" }

        [pscustomobject]@{
            inputs     = $inputText
            "prob/band" = $probOrBand
            decision   = $decisionValue
            threshold  = $thresholdOrBands
        }
    }

    $csvRows | Export-Csv -Path $outputFile -NoTypeInformation -Encoding UTF8

    $bucketCounts = @{}
    foreach ($entry in $records) {
        $bucket = if ($entry.band) { "$($entry.band)" } elseif ($entry.segment) { "$($entry.segment)" } elseif ($entry.decision) { "$($entry.decision)" } elseif ($entry.action) { "$($entry.action)" } else { "unknown" }
        if (-not $bucketCounts.ContainsKey($bucket)) {
            $bucketCounts[$bucket] = 0
        }
        $bucketCounts[$bucket] += 1
    }

    $summaryRows += [pscustomobject]@{
        Surface = $surface
        Output  = $outputFile
        Buckets = ($bucketCounts.GetEnumerator() | Sort-Object Name | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value }) -join ", "
        Threshold = if ($thresholdOrBands) { $thresholdOrBands } else { "(n/a)" }
    }
}

if ($summaryRows) {
    Write-Host ""
    foreach ($row in $summaryRows) {
        Write-Host ("{0}: {1} | threshold/bands: {2}" -f $row.Surface, $row.Buckets, $row.Threshold)
        Write-Host ("  output => {0}" -f $row.Output) -ForegroundColor DarkGray
    }
}
