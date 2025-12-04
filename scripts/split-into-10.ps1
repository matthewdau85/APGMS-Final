# Path to the original file
$inputFile = "C:\src\apgms-final\combined-code-export.txt"

# Read all lines
$lines = Get-Content -Path $inputFile -ErrorAction Stop

# Number of chunks
$chunks = 20

# Calculate lines per chunk
$total = $lines.Count
$perChunk = [math]::Ceiling($total / $chunks)

# Folder and base name
$folder = Split-Path $inputFile -Parent
$base   = Split-Path $inputFile -LeafBase

Write-Host "Splitting $total lines into $chunks chunks of approx $perChunk lines each."

for ($i = 0; $i -lt $chunks; $i++) {
    $start = $i * $perChunk
    $end   = [math]::Min($start + $perChunk - 1, $total - 1)

    if ($start -ge $total) { break }  # stop if no more lines

    $chunkLines = $lines[$start..$end]

    $outFile = Join-Path $folder ("$base.part{0}.txt" -f ($i + 1))

    Set-Content -Path $outFile -Value $chunkLines -Encoding UTF8

    Write-Host "Created: $outFile  ($($chunkLines.Count) lines)"
}

Write-Host "Done."
