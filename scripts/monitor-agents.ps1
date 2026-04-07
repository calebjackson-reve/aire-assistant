# AIRE Agent Monitor — Real-time Dashboard
# Usage: powershell -ExecutionPolicy Bypass -File scripts/monitor-agents.ps1

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$skillspec = Join-Path $root "SKILLSPEC.md"
$errorsFile = Join-Path $root ".claude\ERRORS.md"
$blockersFile = Join-Path $root ".claude\BLOCKERS.md"

function Parse-AgentStatus {
    param([string]$content)

    $agents = @()
    $agentDefs = @(
        @{ Name = "Agent 1: Infrastructure & Data"; StartMarker = "### AGENT 1:"; EndMarker = "---" },
        @{ Name = "Agent 2: Transaction Coordinator"; StartMarker = "### AGENT 2:"; EndMarker = "---" },
        @{ Name = "Agent 3: Document Intelligence"; StartMarker = "### AGENT 3:"; EndMarker = "---" },
        @{ Name = "Agent 4: Monitoring Dashboard"; StartMarker = "### AGENT 4:"; EndMarker = "===" }
    )

    foreach ($def in $agentDefs) {
        $startIdx = $content.IndexOf($def.StartMarker)
        if ($startIdx -lt 0) { continue }

        $section = $content.Substring($startIdx)
        $endIdx = $section.IndexOf($def.EndMarker, 10)
        if ($endIdx -gt 0) { $section = $section.Substring(0, $endIdx) }

        $done = ([regex]::Matches($section, [regex]::Escape([char]0x2713))).Count
        $pending = ([regex]::Matches($section, [regex]::Escape([char]0x23F3))).Count
        $total = $done + $pending

        $statusMatch = [regex]::Match($section, "Phase (\d+)/(\d+)")
        if ($statusMatch.Success) {
            $currentPhase = [int]$statusMatch.Groups[1].Value
            $totalPhases = [int]$statusMatch.Groups[2].Value
        } else {
            $currentPhase = $done
            $totalPhases = $total
        }

        if ($currentPhase -ge $totalPhases -and $totalPhases -gt 0) {
            $status = "COMPLETE"
        } elseif ($currentPhase -gt 0) {
            $status = "BUILDING"
        } else {
            $status = "PENDING"
        }

        $agents += @{
            Name = $def.Name
            Done = $currentPhase
            Total = $totalPhases
            Status = $status
        }
    }

    return $agents
}

function Get-StatusIcon {
    param([string]$status)
    switch ($status) {
        "COMPLETE" { return @{ Icon = "[DONE]"; Color = "Green" } }
        "BUILDING" { return @{ Icon = "[....]"; Color = "Yellow" } }
        "PENDING"  { return @{ Icon = "[ -- ]"; Color = "DarkGray" } }
        default    { return @{ Icon = "[ ?? ]"; Color = "Red" } }
    }
}

function Draw-ProgressBar {
    param([int]$done, [int]$total, [int]$width = 20)
    if ($total -eq 0) { return "[" + (" " * $width) + "]" }
    $filled = [math]::Floor(($done / $total) * $width)
    $empty = $width - $filled
    return "[" + ("#" * $filled) + ("-" * $empty) + "]"
}

while ($true) {
    Clear-Host

    # Header
    Write-Host ""
    Write-Host "  =================================================================" -ForegroundColor Cyan
    Write-Host "    AIRE INTELLIGENCE — AGENT MONITOR" -ForegroundColor Cyan
    Write-Host "  =================================================================" -ForegroundColor Cyan
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "    $ts  |  Refresh: 10s  |  Ctrl+C to exit" -ForegroundColor DarkGray
    Write-Host "  =================================================================" -ForegroundColor Cyan
    Write-Host ""

    # Parse SKILLSPEC
    if (Test-Path $skillspec) {
        $content = Get-Content $skillspec -Raw
        $agents = Parse-AgentStatus $content

        # Overall progress
        $totalDone = ($agents | Measure-Object -Property Done -Sum).Sum
        $totalAll = ($agents | Measure-Object -Property Total -Sum).Sum
        $pct = if ($totalAll -gt 0) { [math]::Round(($totalDone / $totalAll) * 100) } else { 0 }
        $overallBar = Draw-ProgressBar $totalDone $totalAll 30

        Write-Host "    OVERALL PROGRESS: $totalDone/$totalAll phases ($pct%)" -ForegroundColor White
        Write-Host "    $overallBar" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  -----------------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host ""

        # Agent rows
        foreach ($agent in $agents) {
            $si = Get-StatusIcon $agent.Status
            $bar = Draw-ProgressBar $agent.Done $agent.Total 15
            $phaseText = "$($agent.Done)/$($agent.Total)"

            Write-Host -NoNewline "    "
            Write-Host -NoNewline $si.Icon -ForegroundColor $si.Color
            Write-Host -NoNewline "  $($agent.Name)" -ForegroundColor White
            Write-Host ""
            Write-Host -NoNewline "           $bar " -ForegroundColor $si.Color
            Write-Host "$phaseText  ($($agent.Status))" -ForegroundColor DarkGray
            Write-Host ""
        }
    } else {
        Write-Host "    Waiting for SKILLSPEC.md..." -ForegroundColor Yellow
    }

    # Errors
    Write-Host "  -----------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "    ERRORS" -ForegroundColor Red
    Write-Host "  -----------------------------------------------------------------" -ForegroundColor DarkGray

    if (Test-Path $errorsFile) {
        $errors = Get-Content $errorsFile -Tail 10
        $hasErrors = $false
        foreach ($line in $errors) {
            if ($line -match "^#|^$|No active errors") { continue }
            Write-Host "    $line" -ForegroundColor Red
            $hasErrors = $true
        }
        if (-not $hasErrors) {
            Write-Host "    None" -ForegroundColor Green
        }
    } else {
        Write-Host "    No error log found" -ForegroundColor DarkGray
    }

    # Blockers
    Write-Host ""
    Write-Host "  -----------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "    BLOCKERS" -ForegroundColor Yellow
    Write-Host "  -----------------------------------------------------------------" -ForegroundColor DarkGray

    if (Test-Path $blockersFile) {
        $blockers = Get-Content $blockersFile -Tail 10
        $hasBlockers = $false
        foreach ($line in $blockers) {
            if ($line -match "^#|^$|^## ") { continue }
            Write-Host "    $line" -ForegroundColor Yellow
            $hasBlockers = $true
        }
        if (-not $hasBlockers) {
            Write-Host "    None" -ForegroundColor Green
        }
    } else {
        Write-Host "    No blockers log found" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "  =================================================================" -ForegroundColor DarkGray
    Write-Host ""

    Start-Sleep -Seconds 10
}
