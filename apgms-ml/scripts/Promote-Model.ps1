[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("gstfree", "bas_conf", "paygw_var", "dups", "apportion")]
    [string]$Surface,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ModelPath,

    [double]$Threshold,

    [string[]]$Bands
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $ModelPath)) {
    throw "Model artifact '$ModelPath' was not found."
}

if (-not $PSBoundParameters.ContainsKey("Threshold") -and (-not $Bands -or $Bands.Count -eq 0)) {
    throw "Specify -Threshold or -Bands to describe the promotion criteria."
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
$productionRoot = Join-Path (Join-Path $repoRoot "model") "production"
$liveRoot = Join-Path (Join-Path $repoRoot "model") "live"

foreach ($path in @($productionRoot, $liveRoot)) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
    }
}

$shortSha = "nogit"
$fullSha = ""
try {
    $shortShaResult = (& git rev-parse --short HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $shortShaResult) {
        $shortSha = $shortShaResult.Trim()
    }
}
catch {
    # ignore
}

try {
    $fullShaResult = (& git rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $fullShaResult) {
        $fullSha = $fullShaResult.Trim()
    }
}
catch {
    # ignore
}

$today = Get-Date -Format "yyyy-MM-dd"
$versionedName = "model_{0}_{1}_{2}.joblib" -f $Surface, $today, $shortSha
$versionedPath = Join-Path $productionRoot $versionedName

Copy-Item -Path $ModelPath -Destination $versionedPath -Force

$hash = (Get-FileHash -Path $versionedPath -Algorithm SHA256).Hash.ToLowerInvariant()

$thresholdValue = if ($PSBoundParameters.ContainsKey("Threshold")) {
    "{0:G}" -f $Threshold
} elseif ($Bands) {
    ($Bands | ForEach-Object { $_.ToString() }) -join "/"
} else {
    ""
}

$createdUtc = (Get-Date).ToUniversalTime().ToString("o")
$manifestName = "manifest_{0}_{1}.txt" -f $Surface, (Get-Date -Format "yyyyMMdd_HHmmss")
$manifestPath = Join-Path $productionRoot $manifestName

$modelRelative = try {
    [System.IO.Path]::GetRelativePath($repoRoot, (Resolve-Path $versionedPath).Path)
} catch {
    $versionedPath
}

$manifestContent = @(
    "model_file=$modelRelative",
    "sha256=$hash",
    "threshold_or_bands=$thresholdValue",
    "created_utc=$createdUtc"
)
if ($fullSha) {
    $manifestContent += "repo_sha=$fullSha"
}

Set-Content -Path $manifestPath -Value $manifestContent

$livePath = Join-Path $liveRoot ("$Surface.joblib")
if (Test-Path $livePath) {
    Remove-Item -Path $livePath -Force
}

try {
    New-Item -ItemType HardLink -Path $livePath -Target $versionedPath | Out-Null
}
catch {
    # fallback to copy if hardlink unsupported
    Copy-Item -Path $versionedPath -Destination $livePath -Force
}

Write-Host "Promoted model stored at $versionedPath"
Write-Host "Manifest: $manifestPath"
if ($thresholdValue) {
    Write-Host "Threshold/Bands: $thresholdValue"
} else {
    Write-Host "Threshold/Bands: (not specified)"
}
