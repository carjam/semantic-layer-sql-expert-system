#Requires -Version 5.1
<#
.SYNOPSIS
  Runs sql/postgres/demo.sql end-to-end in an ephemeral PostgreSQL 16 container.

.DESCRIPTION
  No local psql required. Pulls postgres:16-alpine if missing, waits for readiness,
  copies the demo script in, runs it with ON_ERROR_STOP, then removes the container.
  Requires Docker (e.g. Docker Desktop on Windows).

.PARAMETER PostgresImage
  Image ref for the server container (default: postgres:16-alpine).
#>
param(
  [string]$PostgresImage = "postgres:16-alpine"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SqlPath = Join-Path $RepoRoot "sql\postgres\demo.sql"

if (-not (Test-Path -LiteralPath $SqlPath)) {
  Write-Error "Demo SQL not found: $SqlPath"
  exit 1
}

$pw = "semantic_demo_ephemeral"
$cid = docker run -d `
  -e "POSTGRES_PASSWORD=$pw" `
  -e "POSTGRES_DB=postgres" `
  $PostgresImage

if (-not $cid) {
  exit 1
}

try {
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    $out = docker exec $cid pg_isready -U postgres 2>&1
    if ("$out" -match "accepting") {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    Write-Error "PostgreSQL did not become ready within 60s (container $cid)."
    exit 1
  }

  docker cp -- $SqlPath "${cid}:/tmp/demo.sql"
  docker exec -e "PGPASSWORD=$pw" $cid `
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 `
    -c "SET client_min_messages TO WARNING" `
    -f /tmp/demo.sql
  exit $LASTEXITCODE
}
finally {
  docker rm -f $cid 2>$null | Out-Null
}
