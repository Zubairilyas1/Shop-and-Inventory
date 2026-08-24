param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"

if ($DatabaseUrl -match "postgres(?:ql)?\+?\w*://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(\w+)") {
    $user = $Matches[1]
    $password = $Matches[2]
    $hostName = $Matches[3]
    $port = if ($Matches[4]) { $Matches[4] } else { "5432" }
    $database = $Matches[5]
} else {
    Write-Error "Could not parse DATABASE_URL. Expected postgres://user:pass@host:port/dbname"
    exit 1
}

$backupDir = Join-Path $PSScriptRoot "..\backups"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupDir "${database}_backup_${timestamp}.dump"

$env:PGPASSWORD = $password
& pg_dump -h $hostName -p $port -U $user -Fc -f $backupFile $database
Remove-Item Env:\PGPASSWORD

if (Test-Path $backupFile) {
    Write-Output "Backup created: $backupFile"
} else {
    Write-Error "pg_dump failed to create backup."
    exit 1
}

Get-ChildItem -Path $backupDir -Filter "${database}_backup_*.dump" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Verbose
