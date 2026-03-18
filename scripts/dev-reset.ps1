$port = 3000

function Get-PortPids([int]$p) {
  $rows = netstat -ano | Select-String ":$p\s+" | ForEach-Object { $_.Line.Trim() }
  $pids = @()

  foreach ($row in $rows) {
    $parts = $row -split "\s+"
    if ($parts.Length -ge 5) {
      $state = $parts[3]
      $pid = $parts[4]
      if ($state -eq 'LISTENING' -and $pid -match '^\d+$') {
        $pids += [int]$pid
      }
    }
  }

  return $pids | Select-Object -Unique
}

$pids = @()

try {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listeners) {
    $pids += ($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
  }
} catch {
  Write-Host "Get-NetTCPConnection unavailable, using netstat fallback" -ForegroundColor DarkYellow
}

$pids += Get-PortPids -p $port
$pids = $pids | Where-Object { $_ -and $_ -gt 0 } | Select-Object -Unique

foreach ($pid in $pids) {
  Write-Host "Stopping process on port $port (PID: $pid)" -ForegroundColor Yellow
  cmd /c "taskkill /PID $pid /F" | Out-Null
}

$nextPath = Join-Path $PSScriptRoot "..\.next"
if (Test-Path $nextPath) {
  Write-Host "Clearing .next cache at $nextPath" -ForegroundColor Yellow
  Remove-Item -Recurse -Force $nextPath -ErrorAction SilentlyContinue
}

Write-Host "Starting Next.js on http://127.0.0.1:$port" -ForegroundColor Cyan
npx next dev -H 127.0.0.1 -p $port
