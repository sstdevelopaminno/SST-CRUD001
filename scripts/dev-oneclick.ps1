param(
  [int]$Port = 3000,
  [string]$LoginPath = '/en/login',
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectRoot

function Get-PortPids([int]$TargetPort) {
  $pids = @()
  $lines = netstat -ano | Select-String 'TCP' | ForEach-Object { $_.Line.Trim() }

  foreach ($line in $lines) {
    $parts = $line -split '\s+'
    if ($parts.Length -lt 5) { continue }

    $local = $parts[1]
    $state = $parts[3]
    $procId = $parts[4]

    if ($state -ne 'LISTENING') { continue }
    if ($procId -notmatch '^\d+$') { continue }

    $localPort = $null
    if ($local -match ':(\d+)$') {
      $localPort = [int]$Matches[1]
    }

    if ($null -ne $localPort -and $localPort -eq $TargetPort) {
      $pids += [int]$procId
    }
  }

  return $pids | Select-Object -Unique
}

Write-Host "[one-click] Project: $projectRoot" -ForegroundColor Cyan
Write-Host "[one-click] Resetting port $Port" -ForegroundColor Cyan

$listenerPids = Get-PortPids -TargetPort $Port
foreach ($procId in $listenerPids) {
  Write-Host "[one-click] Stopping PID $procId" -ForegroundColor Yellow
  cmd /c "taskkill /PID $procId /F" | Out-Null
}

$cacheDirs = @('.next', '.next-dev')
foreach ($cache in $cacheDirs) {
  $cachePath = Join-Path $projectRoot $cache
  if (Test-Path $cachePath) {
    Write-Host "[one-click] Clearing $cache" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $cachePath -ErrorAction SilentlyContinue
  }
}

$devCommand = "Set-Location -LiteralPath '$projectRoot'; npm run dev"
$devProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $devCommand -PassThru
Write-Host "[one-click] Dev terminal started (PID: $($devProcess.Id))" -ForegroundColor Green

$loginUrl = "http://127.0.0.1:$Port$LoginPath"
$ready = $false

for ($i = 1; $i -le 45; $i++) {
  Start-Sleep -Seconds 1
  try {
    $resp = Invoke-WebRequest -Uri $loginUrl -Method Head -TimeoutSec 3 -ErrorAction Stop
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
      $ready = $true
      break
    }
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      if ($status -lt 500) {
        $ready = $true
        break
      }
    }
  }
}

if ($ready) {
  Write-Host "[one-click] App is responding at $loginUrl" -ForegroundColor Green
} else {
  Write-Host "[one-click] App not responding yet. Check the new dev terminal window." -ForegroundColor DarkYellow
}

if (-not $NoBrowser) {
  try {
    Start-Process -FilePath 'msedge.exe' -ArgumentList '--new-window', $loginUrl | Out-Null
    Write-Host "[one-click] Opened Edge: $loginUrl" -ForegroundColor Green
  } catch {
    Start-Process $loginUrl | Out-Null
    Write-Host "[one-click] Opened default browser: $loginUrl" -ForegroundColor Green
  }
}

Write-Host "[one-click] Done" -ForegroundColor Cyan
