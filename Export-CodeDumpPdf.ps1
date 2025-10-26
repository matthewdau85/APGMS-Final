# Export-CodeDumpPdf.ps1
# Scans the folder this script is in (recursively), collects source/text files,
# and generates one or more PDFs of ~code dump back-to-back.
#
# Each PDF is capped at MaxPages pages. If you need more than MaxPages,
# it will automatically create CodeDump_part01.pdf, CodeDump_part02.pdf, etc.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\Export-CodeDumpPdf.ps1

param(
    [int]$MaxPages = 100,          # max pages per PDF file
    [int]$LinesPerPage = 75,       # ~75 lines per page at 8pt font
    [int]$MaxCols = 100,           # wrap code lines to this width
    [string]$BaseName = "CodeDump" # base filename, we'll append _partXX if needed
)

# -------------------------
# Helpers
# -------------------------

function Wrap-Line {
    param(
        [string]$Text,
        [int]$MaxCols
    )
    # Return list of lines wrapped to MaxCols columns.
    $result = @()
    if ($null -eq $Text) { return @("") }
    if ($Text.Length -eq 0) { return @("") }

    $start = 0
    while ($start -lt $Text.Length) {
        $len = [Math]::Min($MaxCols, $Text.Length - $start)
        $segment = $Text.Substring($start, $len)
        $result += $segment
        $start += $len
    }
    return ,$result
}

function Escape-PdfText {
    param(
        [string]$Line
    )
    # Make line safe for a PDF text object.
    # We also coerce to ASCII (non-ASCII => "?") so the minimal font works.
    if ($null -eq $Line) { $Line = "" }

    $bytes = [System.Text.Encoding]::ASCII.GetBytes($Line)
    $clean = [System.Text.Encoding]::ASCII.GetString($bytes)

    # Escape backslash, "(" and ")"
    $clean = $clean.Replace("\", "\\")
    $clean = $clean.Replace("(", "\(")
    $clean = $clean.Replace(")", "\)")

    return $clean
}

function Build-Pdf {
    param(
        [System.Collections.Generic.List[object]]$Pages, # list of string[] pageLines
        [string]$OutFile
    )

    # We emit a minimal valid PDF 1.4 with:
    # 1 0 obj -> Catalog
    # 2 0 obj -> Pages
    # 3 0 obj -> Font (Courier)
    # Then for each page:
    #   Page obj
    #   Content stream obj

    $numPages = $Pages.Count

    $pageObjects     = @()
    $contentObjects  = @()
    $kidsRefs        = @()

    for ($i = 0; $i -lt $numPages; $i++) {
        $pageObjNum    = 4 + (2 * $i)
        $contentObjNum = 5 + (2 * $i)

        $kidsRefs += ("{0} 0 R" -f $pageObjNum)

        # Build the PDF text stream for this page
        $sbPage = New-Object System.Text.StringBuilder
        [void]$sbPage.Append("BT`n")
        [void]$sbPage.Append("/F1 8 Tf`n")     # Courier 8pt
        [void]$sbPage.Append("9.5 TL`n")       # line spacing
        [void]$sbPage.Append("36 756 Td`n")    # start near top-left margin

        $pageLines = [string[]]$Pages[$i]
        foreach ($rawLine in $pageLines) {
            $esc = Escape-PdfText -Line $rawLine
            [void]$sbPage.Append("(" + $esc + ") Tj`nT*`n")
        }

        [void]$sbPage.Append("ET`n")

        $streamBody       = $sbPage.ToString()
        $streamBodyBytes  = [System.Text.Encoding]::ASCII.GetBytes($streamBody)
        $lenBytes         = $streamBodyBytes.Length

        $contentObjString = ("<< /Length {0} >>`nstream`n{1}endstream" -f $lenBytes, $streamBody)

        $pageObjString = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {0} 0 R /Resources << /Font << /F1 3 0 R >> >> >>" -f $contentObjNum

        $contentObjects += @{
            Num  = $contentObjNum
            Data = $contentObjString
        }
        $pageObjects += @{
            Num  = $pageObjNum
            Data = $pageObjString
        }
    }

    $kidsArray = "[ " + ($kidsRefs -join " ") + " ]"

    $obj1 = @{
        Num  = 1
        Data = "<< /Type /Catalog /Pages 2 0 R >>"
    }

    $obj2 = @{
        Num  = 2
        Data = "<< /Type /Pages /Kids " + $kidsArray + " /Count " + $numPages + " >>"
    }

    $obj3 = @{
        Num  = 3
        Data = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"
    }

    $allObjs = @($obj1, $obj2, $obj3) + ($pageObjects + $contentObjects | Sort-Object Num)
    $allObjs = $allObjs | Sort-Object Num

    $objectStrings = @()
    foreach ($o in $allObjs) {
        $objectStrings += ("{0} 0 obj`n{1}`nendobj`n" -f $o.Num, $o.Data)
    }

    $pdfHeader = "%PDF-1.4`n"
    $enc       = [System.Text.Encoding]::ASCII

    # compute xref offsets
    $offsets = @()
    $pos = $enc.GetByteCount($pdfHeader)

    foreach ($objStr in $objectStrings) {
        $offsets += $pos
        $pos += $enc.GetByteCount($objStr)
    }

    $startXref = $pos
    $totalObjects = $allObjs.Count + 1  # include object 0

    # xref table
    $xrefSb = New-Object System.Text.StringBuilder
    [void]$xrefSb.Append("xref`n")
    [void]$xrefSb.Append("0 $totalObjects`n")
    [void]$xrefSb.Append("0000000000 65535 f `n")
    foreach ($off in $offsets) {
        $offStr = $off.ToString("0000000000")
        [void]$xrefSb.Append("$offStr 00000 n `n")
    }

    $xrefSection = $xrefSb.ToString()

    # trailer
    $trailerSection = "trailer`n<< /Size $totalObjects /Root 1 0 R >>`nstartxref`n$startXref`n%%EOF`n"

    $pdfString = $pdfHeader + ($objectStrings -join "") + $xrefSection + $trailerSection
    $pdfBytes  = $enc.GetBytes($pdfString)

    [System.IO.File]::WriteAllBytes((Join-Path (Get-Location) $OutFile), $pdfBytes)
}

# -------------------------
# MAIN
# -------------------------

Write-Host "[1/4] Collecting files..."

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($baseDir)) {
    $baseDir = Get-Location
}

# skip obvious binaries so we don't blast garbage into the PDF
$binaryExtPattern = '^\.(exe|dll|so|bin|png|jpg|jpeg|gif|ico|pdf|zip|7z|gz|tar|mp4|mp3|wav|ogg|avi|mov|class|jar|ttf|otf|woff|woff2|psd|xls|xlsx|doc|docx|ppt|pptx)$'

$files = Get-ChildItem -Path $baseDir -Recurse -File | Where-Object {
    $_.Extension -notmatch $binaryExtPattern
}

Write-Host "[2/4] Reading and wrapping file contents..."

# Collect all wrapped lines from all files into one giant list
$allLines = New-Object System.Collections.Generic.List[string]

foreach ($f in $files) {
    $relPath = Resolve-Path -Relative $f.FullName

    $allLines.Add("===== BEGIN FILE: $relPath =====")

    $rawText = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
    if ($null -eq $rawText) { $rawText = "" }

    $rawLines = $rawText -split "(`r`n|`n|`r)"

    foreach ($ln in $rawLines) {
        $wrappedLines = Wrap-Line -Text $ln -MaxCols $MaxCols
        foreach ($w in $wrappedLines) {
            $allLines.Add($w)
        }
    }

    $allLines.Add("") # spacer after file
}

Write-Host "[3/4] Paginating ALL pages (no cap yet)..."

# Turn that big line list into a list of pages,
# where each page is an array of up to $LinesPerPage lines.
$allPages = New-Object System.Collections.Generic.List[object]
$currentPage = New-Object System.Collections.Generic.List[string]

foreach ($line in $allLines) {
    if ($currentPage.Count -ge $LinesPerPage) {
        $allPages.Add($currentPage.ToArray())
        $currentPage = New-Object System.Collections.Generic.List[string]
    }
    $currentPage.Add($line)
}

# add last partially-filled page
if ($currentPage.Count -gt 0) {
    $allPages.Add($currentPage.ToArray())
}

$totalPages = $allPages.Count
Write-Host ("    -> Total logical pages: {0}" -f $totalPages)

if ($totalPages -eq 0) {
    # edge case: nothing to print at all
    $emptyPage = @("<< no printable text found >>")
    $allPages.Add($emptyPage)
    $totalPages = 1
}

Write-Host "[4/4] Building PDF file(s)..."

# Now chunk pages into batches of up to $MaxPages each.
# Example: if totalPages=230 and MaxPages=100:
#   batch 1 -> pages 0..99
#   batch 2 -> pages 100..199
#   batch 3 -> pages 200..229
#
# We'll name:
#   CodeDump.pdf            (if only 1 batch)
#   CodeDump_part01.pdf     (first batch)
#   CodeDump_part02.pdf     (second batch)
#   ...

$batchCount = [Math]::Ceiling($totalPages / $MaxPages)
Write-Host ("    -> Will generate {0} PDF file(s)." -f $batchCount)

for ($b = 0; $b -lt $batchCount; $b++) {
    $startPage = $b * $MaxPages
    $endPage   = [Math]::Min($startPage + $MaxPages, $totalPages) - 1

    $subset = New-Object System.Collections.Generic.List[object]
    for ($p = $startPage; $p -le $endPage; $p++) {
        $subset.Add([string[]]$allPages[$p])
    }

    if ($batchCount -eq 1) {
        # single file case
        $outName = "$BaseName.pdf"
    } else {
        $partNum = ($b+1).ToString("00")
        $outName = "{0}_part{1}.pdf" -f $BaseName, $partNum
    }

    Write-Host ("    -> Writing pages {0} to {1} into {2}" -f ($startPage+1), ($endPage+1), $outName)

    Build-Pdf -Pages $subset -OutFile $outName
}

Write-Host "Done."
Write-Host ("Generated {0} PDF file(s) in {1}" -f $batchCount, (Get-Location).Path)
Write-Host "Each file holds up to $MaxPages pages of code."
