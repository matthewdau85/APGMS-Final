param(
    [Parameter(Mandatory = $true)]
    [string]$PredictionsPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PredictionsPath)) {
    throw "Predictions file '$PredictionsPath' not found."
}

$rows = Import-Csv -Path $PredictionsPath -Delimiter "`t"
if ($rows.Count -eq 0) {
    Write-Host "No rows found." -ForegroundColor Yellow
    return
}

function Resolve-QuestionText {
    param($Row)
    if ($Row.question) { return $Row.question }
    if ($Row.question_variant) { return $Row.question_variant }
    return ""
}

$falsePositives = $rows | Where-Object { $_.label -eq '0' -and $_.decision -eq 'keep' }
$falseNegatives = $rows | Where-Object { $_.label -eq '1' -and $_.decision -eq 'drop' }

Write-Host "False Positives:`n" -ForegroundColor Yellow
foreach ($row in $falsePositives) {
    $questionText = Resolve-QuestionText $row
    Write-Host "[FP] $questionText => $($row.answer) (score=$($row.score))"
}

Write-Host "`nFalse Negatives:`n" -ForegroundColor Yellow
foreach ($row in $falseNegatives) {
    $questionText = Resolve-QuestionText $row
    Write-Host "[FN] $questionText => $($row.answer) (score=$($row.score))"
}
