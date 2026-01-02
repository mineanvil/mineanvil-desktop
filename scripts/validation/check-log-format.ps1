# Check that logs are structured JSON and secret-free (read-only)
# Usage: .\scripts\validation\check-log-format.ps1 [instanceId] [logFile]

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

Write-Host "Checking log format: $LogFile" -ForegroundColor Cyan
Write-Host ""

$content = Get-Content $LogFile -ErrorAction SilentlyContinue
$jsonLines = 0
$nonJsonLines = 0
$secretPatterns = @("password", "token", "secret", "key", "auth", "credential")

$secretMatches = @()

foreach ($line in $content) {
    $lineTrimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($lineTrimmed)) {
        continue
    }
    
    try {
        $entry = $lineTrimmed | ConvertFrom-Json
        $jsonLines++
        
        # Check for secrets in log entry
        $entryJson = $lineTrimmed.ToLower()
        foreach ($pattern in $secretPatterns) {
            if ($entryJson -match $pattern) {
                $secretMatches += "Line contains potential secret pattern: $pattern"
            }
        }
    } catch {
        $nonJsonLines++
    }
}

Write-Host "Log Format Analysis:" -ForegroundColor Green
Write-Host "  JSON lines: $jsonLines" -ForegroundColor $(if ($jsonLines -gt 0) { "Green" } else { "Red" })
Write-Host "  Non-JSON lines: $nonJsonLines" -ForegroundColor $(if ($nonJsonLines -eq 0) { "Green" } else { "Yellow" })

if ($secretMatches.Count -gt 0) {
    Write-Host "`nPotential Secret Patterns Found:" -ForegroundColor Red
    $secretMatches | ForEach-Object {
        Write-Host "  ⚠ $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "`nNo secret patterns detected" -ForegroundColor Green
}

Write-Host "`nNote: This is a basic check. Manual review recommended." -ForegroundColor Yellow

