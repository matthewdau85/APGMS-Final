# scripts\apply-reword-plan.ps1
param(
  [string]$Csv = "artifacts\commit_reword_suggestions.csv",
  [switch]$DryRun
)

# Resolve git.exe (avoid function-name collisions)
try {
  $script:GitExe = (Get-Command git.exe -ErrorAction Stop).Path
} catch {
  Write-Error "git not found in PATH."; exit 1
}

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

if (-not (Test-Path $Csv)) {
  Write-Error "Missing $Csv. Run the audit + generate suggestions first."
  exit 1
}

$rows = Import-Csv -Path $Csv
if (-not $rows -or $rows.Count -eq 0) {
  Write-Host "No rows in $Csv"; exit 0
}

$recs = @()
foreach ($r in $rows) {
  $hash = Coalesce $r @("hash","Hash")
  $short = Coalesce $r @("short","Short")
  $cur = Coalesce $r @("current_subject","Current_Subject","subject","Subject")
  $sugg = Coalesce $r @("suggested_subject","Suggested_Subject")
  $flags = Coalesce $r @("flags","Flags")

  if ($hash -eq "" -or $sugg -eq "") { continue }

  $hash = $hash.Trim()
  if ($short -ne "") { $short = $short.Trim() } else { $short = $hash.Substring(0,[Math]::Min(7,$hash.Length)) }
  $sugg = TitleCaseFirst($sugg.Trim())
  if ($sugg -match '\.$') { $sugg = $sugg -replace '\.$','' }

  $recs += [pscustomobject]@{
    hash = $hash
    short = $short
    current_subject = $cur
    suggested_subject = $sugg
    flags = $flags
  }
}

if ($recs.Count -eq 0) {
  Write-Host "No valid suggestions found."; exit 0
}

$outDir = "artifacts"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$planTxt = Join-Path $outDir "commit_reword_plan.txt"
$todoTxt = Join-Path $outDir "rebase_todo_example.txt"

# Pretty plan
"" | Out-File $planTxt -Encoding utf8
foreach ($x in ($recs | Sort-Object short)) {
  Add-Content -Path $planTxt -Value ("{0} - {1}" -f $x.short, $x.suggested_subject)
  if ($x.flags)          { Add-Content -Path $planTxt -Value ("    flags: {0}" -f $x.flags) }
  if ($x.current_subject){ Add-Content -Path $planTxt -Value ("    was : {0}" -f $x.current_subject) }
}

# Rebase-todo example (template only)
"" | Out-File $todoTxt -Encoding utf8
foreach ($x in ($recs | Sort-Object short)) {
  Add-Content -Path $todoTxt -Value ("reword {0} {1}" -f $x.short, $x.suggested_subject)
}

# Console preview
Write-Host ""
Write-Host "Commits to reword (hash - new subject):"
foreach ($x in ($recs | Sort-Object short)) {
  Write-Host ("{0} - {1}" -f $x.short, $x.suggested_subject)
}

Write-Host ""
Write-Host "Wrote $planTxt"
Write-Host "Wrote $todoTxt"

if ($DryRun) {
  Write-Host ""
  Write-Host "(DRY RUN) No history changed."
  exit 0
}

Write-Host ""
Write-Host "Safety first: this script does not rewrite history."
Write-Host "Use interactive rebase to apply the rewording with Notepad."
