Write-Host "=== OS ==="
[System.Environment]::OSVersion.VersionString
Write-Host ""

Write-Host "=== Node & PNPM ==="
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host -NoNewline "node: "
    node -v
} else {
    Write-Host "node: NOT FOUND"
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host -NoNewline "npm: "
    npm -v
} else {
    Write-Host "npm: NOT FOUND"
}

if (Get-Command corepack -ErrorAction SilentlyContinue) {
    Write-Host -NoNewline "corepack: "
    try {
        corepack --version
    } catch {
        Write-Host "present but failed to report version"
    }
} else {
    Write-Host "corepack: NOT FOUND"
}

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host -NoNewline "pnpm: "
    pnpm -v
} else {
    Write-Host "pnpm: NOT FOUND"
}
Write-Host ""

Write-Host "=== Docker ==="
if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        docker --version
    } catch {
        Write-Host "docker present but failed to report version"
    }
    try {
        docker compose version
    } catch {
        Write-Host "docker compose subcommand not available"
    }
} else {
    Write-Host "docker: NOT FOUND"
}
Write-Host ""

Write-Host "=== PostgreSQL via Docker (db/apgms-postgres) ==="
if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        # Show containers whose name contains "db" or "apgms-postgres"
        docker ps --filter "name=db" --format "table {{.Names}}\t{{.Status}}"
        docker ps --filter "name=apgms-postgres" --format "table {{.Names}}\t{{.Status}}"
    } catch {
        Write-Host "error querying docker ps"
    }
} else {
    Write-Host "docker not available; cannot check containers"
}
Write-Host ""

Write-Host "=== psql client (optional) ==="
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host -NoNewline "psql: "
    try {
        psql --version
    } catch {
        Write-Host "present but failed to report version"
    }
} else {
    Write-Host "psql: NOT FOUND"
}
Write-Host ""

Write-Host "=== Playwright (via WSL pnpm) ==="
try {
    wsl bash -lc 'export NVM_DIR="/home/matth/.nvm"; if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh"; fi; cd /mnt/c/src/APGMS && pnpm exec playwright --version'
} catch {
    Write-Host "Could not query Playwright in WSL"
}
Write-Host ""

Write-Host "=== Current directory ==="
Get-Location
