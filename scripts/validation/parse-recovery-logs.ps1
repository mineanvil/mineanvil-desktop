# Parse logs for recovery decision paths (read-only)
# Usage: .\scripts\validation\parse-recovery-logs.ps1 [instanceId] [logFile]

param(
    [string]$InstanceId = "default",
    [string]$LogFile = $null
)

$appData = $env:APPDATA
$logsPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs"

if ($null -eq $LogFile) {
    # Find most recent log file
    $logFiles = Get-ChildItem -Path $logsPath -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($logFiles.Count -eq 0) {
        Write-Host "No log files found in: $logsPath" -ForegroundColor Red
        exit 1
    }
    $LogFile = $logFiles[0].FullName
}

Write-Host "Parsing log file: $LogFile" -ForegroundColor Cyan
Write-Host ""

# Parse JSON log entries
$recoveryEntries = @()
$content = Get-Content $LogFile -ErrorAction SilentlyContinue

foreach ($line in $content) {
    try {
        $entry = $line | ConvertFrom-Json
        if ($entry.area -eq "install.deterministic" -or $entry.area -eq "install.planner") {
            if ($entry.message -match "staging|recovery|resuming|quarantine|snapshot") {
                $recoveryEntries += $entry
            }
        }
    } catch {
        # Skip non-JSON lines
    }
}

if ($recoveryEntries.Count -eq 0) {
    Write-Host "No recovery-related log entries found" -ForegroundColor Yellow
    exit 0
}

Write-Host "Recovery Decision Path:" -ForegroundColor Green
Write-Host ""

foreach ($entry in $recoveryEntries) {
    $timestamp = if ($entry.ts) { $entry.ts } else { "N/A" }
    $level = $entry.level.ToUpper()
    $color = switch ($level) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "INFO" { "Cyan" }
        "DEBUG" { "Gray" }
        default { "White" }
    }
    
    Write-Host "[$timestamp] [$level] $($entry.message)" -ForegroundColor $color
    if ($entry.meta) {
        $entry.meta.PSObject.Properties | ForEach-Object {
            Write-Host "  $($_.Name): $($_.Value)" -ForegroundColor Gray
        }
    }
}

Write-Host "`nTotal recovery entries: $($recoveryEntries.Count)" -ForegroundColor Cyan

