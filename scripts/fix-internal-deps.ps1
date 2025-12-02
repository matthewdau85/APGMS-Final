# fix-internal-deps.ps1
# Normalises internal @apgms/* package dependencies and layering.

$packageFiles = @(
  "C:\src\APGMS\packages\domain-policy\package.json",
  "C:\src\APGMS\packages\ledger\package.json",
  "C:\src\APGMS\shared\package.json",
  "C:\src\APGMS\apps\phase1-demo\package.json",
  "C:\src\APGMS\services\api-gateway\package.json",
  "C:\src\APGMS\services\connectors\package.json"
)

foreach ($file in $packageFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "Skipping missing file: $file"
        continue
    }

    Write-Host "Processing $file ..."
    $jsonText = Get-Content $file -Raw
    $pkg = $jsonText | ConvertFrom-Json

    # Helper: ensure an object property exists and is a hashtable-like object
    function Ensure-MapProperty {
        param(
            [Parameter(Mandatory = $true)][object]$obj,
            [Parameter(Mandatory = $true)][string]$name
        )
        if (-not $obj.PSObject.Properties.Name.Contains($name)) {
            $obj | Add-Member -Name $name -Value (@{}) -MemberType NoteProperty
        } elseif (-not ($obj.$name)) {
            $obj.$name = @{}
        }
    }

    switch ($pkg.name) {

        "@apgms/shared" {
            # shared is the base layer: it must NOT depend on domain-policy or ledger.
            foreach ($propName in @("dependencies", "devDependencies")) {
                $prop = $pkg.$propName
                if ($prop) {
                    foreach ($bad in "@apgms/domain-policy", "@apgms/ledger") {
                        if ($prop.PSObject.Properties.Name -contains $bad) {
                            Write-Host "  Removing $bad from $propName in @apgms/shared"
                            $prop.PSObject.Properties.Remove($bad)
                        }
                    }
                }
            }
        }

        "@apgms/domain-policy" {
            # domain-policy sits above shared: depends on shared (runtime), not ledger.
            Ensure-MapProperty -obj $pkg -name "dependencies"
            Ensure-MapProperty -obj $pkg -name "devDependencies"

            # Move @apgms/shared into dependencies as workspace:*
            if ($pkg.devDependencies.PSObject.Properties.Name -contains "@apgms/shared") {
                Write-Host "  Moving @apgms/shared from devDependencies -> dependencies for @apgms/domain-policy"
                $pkg.dependencies."@apgms/shared" = "workspace:*"
                $pkg.devDependencies.PSObject.Properties.Remove("@apgms/shared")
            } elseif (-not $pkg.dependencies."@apgms/shared") {
                Write-Host "  Ensuring @apgms/shared dependency for @apgms/domain-policy"
                $pkg.dependencies."@apgms/shared" = "workspace:*"
            }

            # Ensure it does NOT depend on ledger
            foreach ($propName in @("dependencies", "devDependencies")) {
                $prop = $pkg.$propName
                if ($prop -and $prop.PSObject.Properties.Name -contains "@apgms/ledger") {
                    Write-Host "  Removing @apgms/ledger from $propName in @apgms/domain-policy"
                    $prop.PSObject.Properties.Remove("@apgms/ledger")
                }
            }
        }

        "@apgms/ledger" {
            # ledger depends on domain-policy + shared
            Ensure-MapProperty -obj $pkg -name "dependencies"

            Write-Host "  Ensuring @apgms/shared and @apgms/domain-policy dependencies for @apgms/ledger"
            $pkg.dependencies."@apgms/shared" = "workspace:*"
            $pkg.dependencies."@apgms/domain-policy" = "workspace:*"
        }

        "@apgms/phase1-demo" {
            # app depends on ledger + shared (and optionally others)
            Ensure-MapProperty -obj $pkg -name "dependencies"

            Write-Host "  Ensuring @apgms/shared and @apgms/ledger dependencies for @apgms/phase1-demo"
            $pkg.dependencies."@apgms/shared" = "workspace:*"
            $pkg.dependencies."@apgms/ledger" = "workspace:*"
        }

        "@apgms/api-gateway" {
            # normalise internal deps to workspace:*
            Ensure-MapProperty -obj $pkg -name "dependencies"
            foreach ($internal in "@apgms/shared", "@apgms/domain-policy", "@apgms/connectors") {
                if ($pkg.dependencies.PSObject.Properties.Name -contains $internal) {
                    Write-Host "  Normalising $internal version -> workspace:* in @apgms/api-gateway"
                    $pkg.dependencies.$internal = "workspace:*"
                }
            }
        }

        "@apgms/connectors" {
            # normalise internal deps to workspace:*
            Ensure-MapProperty -obj $pkg -name "dependencies"
            foreach ($internal in "@apgms/shared", "@apgms/domain-policy") {
                if ($pkg.dependencies.PSObject.Properties.Name -contains $internal) {
                    Write-Host "  Normalising $internal version -> workspace:* in @apgms/connectors"
                    $pkg.dependencies.$internal = "workspace:*"
                }
            }
        }

        default {
            Write-Host "  No special rules for package name $($pkg.name); leaving as-is."
        }
    }

    # Write back pretty JSON
    $pkg | ConvertTo-Json -Depth 20 | Set-Content -Path $file -Encoding UTF8
    Write-Host "  Updated $file for package $($pkg.name)"
}

Write-Host "All package.json files processed."
