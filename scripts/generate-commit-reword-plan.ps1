# scripts\generate-commit-reword-plan.ps1
# Reads artifacts\commit_audit.csv and produces:
# - artifacts\commit_reword_suggestions.csv
# - artifacts\commit_reword_plan.txt
param(
  [string]$CsvPath = "artifacts\commit_audit.csv",
  [int]$MaxSubject = 72
)

function Coalesce($obj, [string[]]$names) {
  foreach ($n in $names) {
    if ($obj.PSObject.Properties.Match($n).Count -gt 0) {
      $v = $obj.$n
      if ($null -ne $v -and "$v".Trim() -ne "") { return "$v" }
    }
  }
  return ""
}

function TitleCaseFirst([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return $s }
  $t = $s.Trim()
  if ($t.Length -eq 0) { return $t }
  $first = $t.Substring(0,1).ToUpper()
  if ($t.Length -gt 1) { return ($first + $t.Substring(1)) }
  return $first
}

function BuildSubject([string]$prefix, [string]$scope, [string]$rest, [int]$maxLen) {
  $p = $prefix
  if ($scope -and $scope.Trim() -ne "") {
    if ($p -and $p -notmatch '\($') { $p = "$p($scope)" } else { $p = "$prefix($scope)" }
  }
  if ($p) { $p = "$($p): " }  # NOTE: wrap in $() to avoid $p: parsing
  $subj = "$p$rest"
  if ($subj.Length -gt $maxLen) { $subj = $subj.Substring(0, $maxLen).TrimEnd() }
  return $subj
}

function GuessPrefixFromRow($row) {
  $pfx = Coalesce $row @("prefix","Prefix")
  if ($pfx -ne "") { return $pfx.Trim() }

  $inf = (Coalesce $row @("inferred_type","Inferred_Type")).ToLower()
  switch -regex ($inf) {
    '^docs$'          { return 'docs' }
    '^test$'          { return 'test' }
    '^feat\+test$'    { return 'feat' }
    '^feat\(db\)$'    { return 'feat' }
    '^chore\(db\)$'   { return 'chore' }
    '^chore\(deps\)$' { return 'chore' }
    '^ci$'            { return 'ci' }
    '^refactor$'      { return 'refactor' }
    '^feat$'          { return 'feat' }
    default           { return 'chore' }
  }
}

function GuessScopeFromRow($row) {
  $sc = Coalesce $row @("scope","Scope")
  if ($sc -ne "") { return $sc.Trim() }
  $dir = (Coalesce $row @("dominant_dir","Dominant_Dir")).Trim()
  if ($dir -and $dir -ne "." -and $dir -ne "docs") { return $dir }
  return ""
}

function NeedsRewrite([string]$flagsList) {
  if ($null -eq $flagsList) { $flagsList = "" }
  $needles = @(
    'subject-not-capitalized',
    'subject>72',
    'docs-claimed-mismatch',
    'test-claimed-mismatch',
    'deps-looks-like-chore',
    'code-additions-look-like-feat',
    'code-changes-look-like-refactor',
    'scope-mismatch',
    'needs-body(>=150 LOC)',
    'possible-breaking-missing-marker'
  )
  foreach ($n in $needles) {
    if ($flagsList -match [regex]::Escape($n)) { return $true }
  }
  return $false
}

if (-not (Test-Path $CsvPath)) {
  Write-Error "Missing $CsvPath. Run your audit script first."
  exit 1
}

$df = Import-Csv -Path $CsvPath
if (-not $df -or $df.Count -eq 0) {
  Write-Host "No rows in $CsvPath"
  exit 0
}

$recs = @()
foreach ($row in $df) {
  $flagsText = Coalesce $row @("flags","Flags")
  if (-not (NeedsRewrite $flagsText)) { continue }

  $prefix = GuessPrefixFromRow $row
  $scope  = GuessScopeFromRow  $row

  $rest = Coalesce $row @("subject","Subject")
  if ($rest -match '^[a-z]+(\([^)]+\))?:\s*(?<r>.*)$') { $rest = $Matches['r'] }
  $rest = TitleCaseFirst($rest)
  if ($rest -match '\.$') { $rest = $rest -replace '\.$','' }

  if ($flagsText -match 'code-additions-look-like-feat' -and $prefix -notmatch '^(feat|fix)') {
    $prefix = 'feat'
  }
  if ($flagsText -match 'code-changes-look-like-refactor' -and $prefix -notmatch '^(refactor|chore)') {
    $prefix = 'refactor'
  }
  if ($flagsText -match 'deps-looks-like-chore' -and $prefix -notmatch '^chore') {
    $prefix = 'chore'
  }

  $suggestedSubject = BuildSubject $prefix $scope $rest $MaxSubject

  $recs += [pscustomobject]@{
    hash              = Coalesce $row @("hash","Hash")
    short             = Coalesce $row @("short","Short")
    current_subject   = Coalesce $row @("subject","Subject")
    suggested_subject = $suggestedSubject
    flags             = $flagsText
  }
}

$outDir = "artifacts"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$csvOut = Join-Path $outDir "commit_reword_suggestions.csv"
$txtOut = Join-Path $outDir "commit_reword_plan.txt"

$recs | Sort-Object -Property hash | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $csvOut

"" | Out-File $txtOut -Encoding utf8
foreach ($r in ($recs | Sort-Object -Property short)) {
  Add-Content -Path $txtOut -Value ("{0} - {1}" -f $r.short, $r.suggested_subject)
  if ($r.flags) { Add-Content -Path $txtOut -Value ("    flags: {0}" -f $r.flags) }
  if ($r.current_subject) { Add-Content -Path $txtOut -Value ("    was : {0}" -f $r.current_subject) }
}

Write-Host "Wrote $csvOut"
Write-Host "Wrote $txtOut"
